const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataHcodes = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.hcodes.findMany();
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง hcodes_log
        await pm.hcodes_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: resultData.length,
                status: resultData.length > 0 ? 'Success' : 'No Data'
            }
        });

        if(resultData.length === 0) return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });

        return msg(res, 200, { data: resultData });
    } catch(err) {
        console.log('getAllDataHcodes : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.upsertDataHcode = async (req, res) => {
    try {
        const hcodeData = req.body; // ดึงข้อมูลทั้งหมดจาก req.body
        const fullname = req.user.fullname_thai;
        let hcodeId = null

        if(!hcodeData.hcode || !hcodeData.hcode_name) return msg(res, 400, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน!' });

        const fetchHcode = await pm.hcodes.findMany();
        if(fetchHcode.length > 0) {
            hcodeId = fetchHcode.map(i => i.hcode_id);
        }

        // เพิ่มข้อมูลใหม่
        const startTime = Date.now();
        const upsertData = await pm.hcodes.upsert({
            where: { hcode_id: Number(hcodeId) },
            update: {
                ...hcodeData, // กระจายค่าทั้งหมดจาก req.body
                updated_by: fullname
            },
            create: {
                ...hcodeData, // กระจายค่าทั้งหมดจาก req.body
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.hcodes_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: upsertData ? 1 : 0,
                status: upsertData ? 'Success' : 'Failed'
            }
        });

        return msg(res, 200, { message: 'Upsert data successfully!' });

    } catch (err) {
        console.error('upsertDataHcode : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataHcode = async (req, res) => {
    try {
        const hcodeId = req.params.id;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่ามี ID นี้ในระบบหรือไม่
        const fetchOneHcodeById = await pm.hcodes.findFirst({
            where: { hcode_id: Number(hcodeId) },
            select: { hcode_id: true }
        });
        if (!fetchOneHcodeById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${hcodeId} ) อยู่ในระบบ!` });

        // ตรวจสอบว่ามี Foreign Key หรือไม่
        const checkForeignKey = await pm.$queryRaw`
            SELECT TABLE_NAME, COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_NAME = 'hcodes'
            AND REFERENCED_COLUMN_NAME = 'hcode_id'
            AND EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = KEY_COLUMN_USAGE.TABLE_NAME
            )
        `;

        if (checkForeignKey.length > 0) {
            let hasReference = false;
            let referencedTables = [];

            // ตรวจสอบแต่ละตารางว่ามีข้อมูลอ้างอิงอยู่หรือไม่
            for (const row of checkForeignKey) {
                const tableName = row.TABLE_NAME;
                const columnName = row.COLUMN_NAME;

                const checkData = await pm.$queryRawUnsafe(`
                    SELECT 1 FROM ${tableName} WHERE ${columnName} = ${Number(req.params.id)} LIMIT 1
                `);

                if (checkData.length > 0) {
                    hasReference = true;
                    referencedTables.push(tableName);
                }
            }

            // ถ้ามีตารางที่อ้างอิงอยู่ → ห้ามลบ
            if (hasReference) {
                return msg(res, 400, { 
                    message: `ไม่สามารถลบได้ เนื่องจาก hcode_id ถูกใช้งานอยู่ในตาราง: ${referencedTables.join(', ')} กรุณาลบข้อมูลที่เกี่ยวข้องก่อน!` 
                });
            }
        }

        // ลบข้อมูล
        const startTime = Date.now();
        const removeData = await pm.hcodes.delete({
            where: { hcode_id: Number(hcodeId) }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง hcodes_log
        await pm.hcodes_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: removeData ? 1 : 0,
                status: removeData ? 'Success' : 'Failed'
            }
        });

        // ดึงค่า MAX(hcode_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(hcode_id), 0) + 1 AS nextId FROM hcodes`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE hcodes AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataHcode : ', err);
        return msg(res, 500, { message: err.message });
    }
};