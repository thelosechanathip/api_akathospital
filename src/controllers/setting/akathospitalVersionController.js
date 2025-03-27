const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataAkathospitalVersions = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.akathospital_versions.findMany();
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง akathospital_versions_log
        await pm.akathospital_versions_log.create({
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
        console.log('getAllDataAkathospitalVersions : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataAkathospitalVersion = async (req, res) => {
    try {
        const akathospitalVersionData = req.body; // ดึงข้อมูลทั้งหมดจาก req.body
        const fullname = req.user.fullname_thai;

        // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        await Promise.all(
            Object.entries(akathospitalVersionData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (['akathospital_version_name'].includes(key) && !value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (['akathospital_version_name'].includes(key) && value) {
                    const existingRecord = await pm.akathospital_versions.findFirst({
                        where: { [key]: value },
                        select: { akathospital_version_id: true }
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
        const insertData = await pm.akathospital_versions.create({
            data: {
                ...akathospitalVersionData, // กระจายค่าทั้งหมดจาก req.body
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.akathospital_versions_log.create({
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
        console.error('insertDataAkathospitalVersion : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function สำหรับ Update ข้อมูลไปยัง Database
exports.updateDataAkathospitalVersion = async (req, res) => {
    try {
        const akathospitalVersionId = req.params.id;
        const akathospitalVersionData = req.body; // ข้อมูลที่ต้องการอัปเดต
        const fullname = req.user.fullname_thai;

        const fetchOneAkathospitalVersionById = await pm.akathospital_versions.findFirst({
            where: { akathospital_version_id: Number(akathospitalVersionId) },
            select: { akathospital_version_id: true }
        });
        if (!fetchOneAkathospitalVersionById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${akathospitalVersionId} ) อยู่ในระบบ!` });

        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        await Promise.all(
            Object.entries(akathospitalVersionData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (['akathospital_version_name'].includes(key) && !value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (['akathospital_version_name'].includes(key) && value) {
                    const existingRecord = await pm.akathospital_versions.findFirst({
                        where: { [key]: value },
                        select: { akathospital_version_id: true }
                    });

                    if (existingRecord) {
                        deplicateStatus.push(409);
                        duplicateMessages.push(`( ${value} ) มีข้อมูลในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!`);
                    }
                }
            })
        );

        // อัปเดตข้อมูล
        const startTime = Date.now();
        const updateData = await pm.akathospital_versions.update({
            where: { akathospital_version_id: Number(akathospitalVersionId) }, // ระบุ akathospitalVersionId ที่ต้องการอัปเดต
            data: {
                ...akathospitalVersionData, // กระจายค่าทั้งหมดจาก req.body
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.akathospital_versions_log.create({
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
        console.error('updateDataAkathospitalVersion : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataAkathospitalVersion = async (req, res) => {
    try {
        const akathospitalVersionId = req.params.id;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่ามี ID นี้ในระบบหรือไม่
        const fetchOneAkathospitalVersionById = await pm.akathospital_versions.findFirst({
            where: { akathospital_version_id: Number(akathospitalVersionId) },
            select: { akathospital_version_id: true }
        });
        if (!fetchOneAkathospitalVersionById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${akathospitalVersionId} ) อยู่ในระบบ!` });

        // ตรวจสอบว่ามี Foreign Key หรือไม่
        const checkForeignKey = await pm.$queryRaw
            `
                SELECT TABLE_NAME, COLUMN_NAME
                FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
                WHERE REFERENCED_TABLE_NAME = 'akathospital_versions'
                AND REFERENCED_COLUMN_NAME = 'akathospital_version_id'
                AND EXISTS (
                    SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = KEY_COLUMN_USAGE.TABLE_NAME
                )
            `
        ;

        if (checkForeignKey.length > 0) {
            const tables = checkForeignKey.map(row => row.TABLE_NAME).join(', ');
            return msg(res, 400, { message: `ไม่สามารถลบได้ เนื่องจาก akathospital_version_id ถูกใช้งานอยู่ในตาราง: ${tables} กรุณาลบข้อมูลที่เกี่ยวข้องก่อน!` });
        }

        // ลบข้อมูล
        const startTime = Date.now();
        const removeData = await pm.akathospital_versions.delete({
            where: { akathospital_version_id: Number(akathospitalVersionId) }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง akathospital_versions_log
        await pm.akathospital_versions_log.create({
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

        // ดึงค่า MAX(akathospital_version_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(akathospital_version_id), 0) + 1 AS nextId FROM akathospital_versions`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE akathospital_versions AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataAkathospitalVersion : ', err);
        return msg(res, 500, { message: err.message });
    }
};