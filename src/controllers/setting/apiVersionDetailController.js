const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataApiVersionDetails = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.api_version_details.findMany({
            include: {
                api_version_id: false,
                api_versions: {
                    select: {
                        api_version_name: true
                    }
                }
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง api_version_details_log
        await pm.api_version_details_log.create({
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
        console.log('getAllDataApiVersionDetails : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataApiVersionDetail = async (req, res) => {
    try {
        const apiVersionDetailData = req.body; // ดึงข้อมูลทั้งหมดจาก req.body
        const fullname = req.user.fullname_thai;

        // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        await Promise.all(
            Object.entries(apiVersionDetailData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (['api_version_detail_comment'].includes(key) && !value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (['api_version_detail_comment'].includes(key) && value) {
                    const existingRecord = await pm.api_version_details.findFirst({
                        where: { [key]: value },
                        select: { api_version_detail_id: true }
                    });

                    if (existingRecord) {
                        deplicateStatus.push(409);
                        duplicateMessages.push(`( ${value} ) มีข้อมูลในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!`);
                    }
                }

                // ตรวจสอบว่ามี ApiVersionId นี้อยู่ใน Table api_versions จริงหรือไม่?
                if(['api_version_id'].includes(key) && value) {
                    const existingRecord = await pm.api_versions.findFirst({
                        where: { [key]: value },
                        select: { api_version_id: true }
                    });

                    if (!existingRecord) {
                        deplicateStatus.push(404);
                        duplicateMessages.push(`ไม่มี ( ID: ${value}) อยู่ใน apiVersion!`);
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
        const insertData = await pm.api_version_details.create({
            data: {
                ...apiVersionDetailData, // กระจายค่าทั้งหมดจาก req.body
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.api_version_details_log.create({
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
        console.error('insertDataApiVersionDetail : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function สำหรับ Update ข้อมูลไปยัง Database
exports.updateDataApiVersionDetail = async (req, res) => {
    try {
        const apiVersionDetailId = req.params.id;
        const apiVersionDetailData = req.body; // ข้อมูลที่ต้องการอัปเดต
        const fullname = req.user.fullname_thai;

        const fetchOneApiVersionDetailById = await pm.api_version_details.findFirst({
            where: { api_version_detail_id: Number(apiVersionDetailId) },
            select: { api_version_detail_id: true }
        });
        if (!fetchOneApiVersionDetailById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${apiVersionDetailId} ) อยู่ในระบบ!` });

        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        await Promise.all(
            Object.entries(apiVersionDetailData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (['api_version_detail_comment'].includes(key) && !value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (['api_version_detail_comment'].includes(key) && value) {
                    const existingRecord = await pm.api_version_details.findFirst({
                        where: { [key]: value },
                        select: { api_version_detail_id: true }
                    });

                    if (existingRecord) {
                        deplicateStatus.push(409);
                        duplicateMessages.push(`( ${value} ) มีข้อมูลในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!`);
                    }
                }

                // ตรวจสอบว่ามี ApiVersionId นี้อยู่ใน Table api_versions จริงหรือไม่?
                if(['api_version_id'].includes(key) && value) {
                    const existingRecord = await pm.api_versions.findFirst({
                        where: { [key]: value },
                        select: { api_version_id: true }
                    });

                    if (!existingRecord) {
                        deplicateStatus.push(404);
                        duplicateMessages.push(`ไม่มี ( ID: ${value}) อยู่ใน apiVersion!`);
                    }
                }
            })
        );

        // อัปเดตข้อมูล
        const startTime = Date.now();
        const updateData = await pm.api_version_details.update({
            where: { api_version_detail_id: Number(apiVersionDetailId) }, // ระบุ apiVersionDetailId ที่ต้องการอัปเดต
            data: {
                ...apiVersionDetailData, // กระจายค่าทั้งหมดจาก req.body
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.api_version_details_log.create({
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
        console.error('updateDataApiVersionDetail : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataApiVersionDetail = async (req, res) => {
    try {
        const apiVersionDetailId = req.params.id;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่ามี ID นี้ในระบบหรือไม่
        const fetchOneApiVersionDetailById = await pm.api_version_details.findFirst({
            where: { api_version_detail_id: Number(apiVersionDetailId) },
            select: { api_version_detail_id: true }
        });

        if (!fetchOneApiVersionDetailById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${apiVersionDetailId} ) อยู่ในระบบ!` });

        // ลบข้อมูล
        const startTime = Date.now();
        const removeData = await pm.api_version_details.delete({
            where: { api_version_detail_id: Number(apiVersionDetailId) }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง api_version_details_log
        await pm.api_version_details_log.create({
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

        // ดึงค่า MAX(api_version_detail_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(api_version_detail_id), 0) + 1 AS nextId FROM api_version_details`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE api_version_details AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataApiVersionDetail : ', err);
        return msg(res, 500, { message: err.message });
    }
};