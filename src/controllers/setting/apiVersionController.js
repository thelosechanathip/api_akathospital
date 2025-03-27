const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataApiVersions = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.api_versions.findMany();
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง api_versions_log
        await pm.api_versions_log.create({
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
        console.log('getAllDataApiVersions : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataApiVersion = async (req, res) => {
    try {
        const apiVersionData = req.body; // ดึงข้อมูลทั้งหมดจาก req.body
        const fullname = req.user.fullname_thai;

        // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        await Promise.all(
            Object.entries(apiVersionData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (!value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (value) {
                    const existingRecord = await pm.api_versions.findFirst({
                        where: { [key]: value },
                        select: { api_version_id: true }
                    });

                    if (existingRecord) {
                        deplicateStatus.push(409);
                        duplicateMessages.push(`( ${value} ) มีข้อมูลในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!`);
                    }
                }
            })
        );

        // ถ้ามีค่าที่ว่าง ให้เพิ่มข้อความแค่ครั้งเดียว
        if (hasEmptyValue) {
            duplicateMessages.unshift("กรุณากรอกข้อมูลให้ครบถ้วน!");
            return msg(res, 400, { message: duplicateMessages[0] });
        }

        // ถ้ามีข้อมูลซ้ำหรือค่าที่ว่าง ให้ส่ง response กลับครั้งเดียว
        if (duplicateMessages.length > 0) return msg(res, Math.max(...deplicateStatus), { message: duplicateMessages.join(" AND ") });

        // เพิ่มข้อมูลใหม่
        const startTime = Date.now();
        const insertData = await pm.api_versions.create({
            data: {
                ...apiVersionData, // กระจายค่าทั้งหมดจาก req.body
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.api_versions_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: insertData ? 1 : 0,
                status: insertData ? 'Success' : 'Failed'
            }
        });

        return msg(res, 200, { message: 'Insert data successfully!' });

    } catch (err) {
        console.error('insertDataApiVersion : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function สำหรับ Update ข้อมูลไปยัง Database
exports.updateDataApiVersion = async (req, res) => {
    try {
        const apiVersionId = req.params.id;
        const apiVersionData = req.body; // ข้อมูลที่ต้องการอัปเดต
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่ามี ID นี้ในระบบหรือไม่
        const fetchOneApiVersionById = await pm.api_versions.findFirst({
            where: { api_version_id: Number(apiVersionId) },
            select: { api_version_id: true }
        });
        if (!fetchOneApiVersionById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${apiVersionId} ) อยู่ในระบบ!` });

        // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        await Promise.all(
            Object.entries(apiVersionData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (!value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (value) {
                    const existingRecord = await pm.api_versions.findFirst({
                        where: { [key]: value },
                        select: { api_version_id: true }
                    });

                    if (existingRecord) {
                        deplicateStatus.push(409);
                        duplicateMessages.push(`( ${value} ) มีข้อมูลในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!`);
                    }
                }
            })
        );

        // ถ้ามีค่าที่ว่าง ให้เพิ่มข้อความแค่ครั้งเดียว
        if (hasEmptyValue) {
            duplicateMessages.unshift("กรุณากรอกข้อมูลให้ครบถ้วน!");
            return msg(res, 400, { message: duplicateMessages[0] });
        }

        // ถ้ามีข้อมูลซ้ำหรือค่าที่ว่าง ให้ส่ง response กลับครั้งเดียว
        if (duplicateMessages.length > 0) return msg(res, Math.max(...deplicateStatus), { message: duplicateMessages.join(" AND ") });

        // อัปเดตข้อมูล
        const startTime = Date.now();
        const updateData = await pm.api_versions.update({
            where: { api_version_id: Number(apiVersionId) }, // ระบุ apiVersionId ที่ต้องการอัปเดต
            data: {
                ...apiVersionData, // กระจายค่าทั้งหมดจาก req.body
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.api_versions_log.create({
            data: {
                ip_address: req.headers["x-forwarded-for"] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: updateData ? 1 : 0,
                status: updateData ? "Success" : "Failed"
            }
        });

        return msg(res, 200, { message: "Update data successfully!" });
    } catch (err) {
        console.error("updateDataApiVersion : ", err);
        return msg(res, 500, { message: err.message });
    }
};

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataApiVersion = async (req, res) => {
    try {
        const apiVersionId = req.params.id;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่ามี ID นี้ในระบบหรือไม่
        const fetchOneApiVersionById = await pm.api_versions.findFirst({
            where: { api_version_id: Number(apiVersionId) },
            select: { api_version_id: true }
        });
        if (!fetchOneApiVersionById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${apiVersionId} ) อยู่ในระบบ!` });

        // ตรวจสอบว่ามี Foreign Key หรือไม่
        const checkForeignKey = await pm.$queryRaw`
            SELECT TABLE_NAME, COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_NAME = 'api_versions'
            AND REFERENCED_COLUMN_NAME = 'api_version_id'
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
                    message: `ไม่สามารถลบได้ เนื่องจาก api_version_id ถูกใช้งานอยู่ในตาราง: ${referencedTables.join(', ')} กรุณาลบข้อมูลที่เกี่ยวข้องก่อน!` 
                });
            }
        }

        // ลบข้อมูล
        const startTime = Date.now();
        const removeData = await pm.api_versions.delete({
            where: { api_version_id: Number(apiVersionId) }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง api_versions_log
        await pm.api_versions_log.create({
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

        // ดึงค่า MAX(api_version_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(api_version_id), 0) + 1 AS nextId FROM api_versions`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE api_versions AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataApiVersion : ', err);
        return msg(res, 500, { message: err.message });
    }
};