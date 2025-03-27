const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataAkathospitalVersionDetails = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.akathospital_version_details.findMany({
            include: {
                akathospital_version_id: false,
                akathospital_versions: {
                    select: {
                        akathospital_version_name: true
                    }
                }
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง akathospital_version_details_log
        await pm.akathospital_version_details_log.create({
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
        console.log('getAllDataAkathospitalVersionDetails : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataAkathospitalVersionDetail = async (req, res) => {
    try {
        const akathospitalVersionDetailData = req.body; // ดึงข้อมูลทั้งหมดจาก req.body
        const fullname = req.user.fullname_thai;

        // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        await Promise.all(
            Object.entries(akathospitalVersionDetailData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (['akathospital_version_detail_comment'].includes(key) && !value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (['akathospital_version_detail_comment'].includes(key) && value) {
                    const existingRecord = await pm.akathospital_version_details.findFirst({
                        where: { [key]: value },
                        select: { akathospital_version_detail_id: true }
                    });

                    if (existingRecord) {
                        deplicateStatus.push(409);
                        duplicateMessages.push(`( ${value} ) มีข้อมูลในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!`);
                    }
                }

                // ตรวจสอบว่ามี AkathospitalVersionId นี้อยู่ใน Table akathospital_versions จริงหรือไม่?
                if(['akathospital_version_id'].includes(key) && value) {
                    const existingRecord = await pm.akathospital_versions.findFirst({
                        where: { [key]: value },
                        select: { akathospital_version_id: true }
                    });

                    if (!existingRecord) {
                        deplicateStatus.push(404);
                        duplicateMessages.push(`ไม่มี ( ID: ${value}) อยู่ใน akathospitalVersion!`);
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
        const insertData = await pm.akathospital_version_details.create({
            data: {
                ...akathospitalVersionDetailData, // กระจายค่าทั้งหมดจาก req.body
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.akathospital_version_details_log.create({
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
        console.error('insertDataAkathospitalVersionDetail : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function สำหรับ Update ข้อมูลไปยัง Database
exports.updateDataAkathospitalVersionDetail = async (req, res) => {
    try {
        const akathospitalVersionDetailId = req.params.id;
        const akathospitalVersionDetailData = req.body; // ข้อมูลที่ต้องการอัปเดต
        const fullname = req.user.fullname_thai;

        const fetchOneAkathospitalVersionDetailById = await pm.akathospital_version_details.findFirst({
            where: { akathospital_version_detail_id: Number(akathospitalVersionDetailId) },
            select: { akathospital_version_detail_id: true }
        });
        if (!fetchOneAkathospitalVersionDetailById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${akathospitalVersionDetailId} ) อยู่ในระบบ!` });

        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        await Promise.all(
            Object.entries(akathospitalVersionDetailData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (['akathospital_version_detail_comment'].includes(key) && !value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (['akathospital_version_detail_comment'].includes(key) && value) {
                    const existingRecord = await pm.akathospital_version_details.findFirst({
                        where: { [key]: value },
                        select: { akathospital_version_detail_id: true }
                    });

                    if (existingRecord) {
                        deplicateStatus.push(409);
                        duplicateMessages.push(`( ${value} ) มีข้อมูลในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!`);
                    }
                }

                // ตรวจสอบว่ามี AkathospitalVersionId นี้อยู่ใน Table akathospital_versions จริงหรือไม่?
                if(['akathospital_version_id'].includes(key) && value) {
                    const existingRecord = await pm.akathospital_versions.findFirst({
                        where: { [key]: value },
                        select: { akathospital_version_id: true }
                    });

                    if (!existingRecord) {
                        deplicateStatus.push(404);
                        duplicateMessages.push(`ไม่มี ( ID: ${value}) อยู่ใน akathospitalVersion!`);
                    }
                }
            })
        );

        // อัปเดตข้อมูล
        const startTime = Date.now();
        const updateData = await pm.akathospital_version_details.update({
            where: { akathospital_version_detail_id: Number(akathospitalVersionDetailId) }, // ระบุ akathospitalVersionDetailId ที่ต้องการอัปเดต
            data: {
                ...akathospitalVersionDetailData, // กระจายค่าทั้งหมดจาก req.body
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.akathospital_version_details_log.create({
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
        console.error('updateDataAkathospitalVersionDetail : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataAkathospitalVersionDetail = async (req, res) => {
    try {
        const akathospitalVersionDetailId = req.params.id;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่ามี ID นี้ในระบบหรือไม่
        const fetchOneAkathospitalVersionDetailById = await pm.akathospital_version_details.findFirst({
            where: { akathospital_version_detail_id: Number(akathospitalVersionDetailId) },
            select: { akathospital_version_detail_id: true }
        });

        if (!fetchOneAkathospitalVersionDetailById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${akathospitalVersionDetailId} ) อยู่ในระบบ!` });

        // ลบข้อมูล
        const startTime = Date.now();
        const removeData = await pm.akathospital_version_details.delete({
            where: { akathospital_version_detail_id: Number(akathospitalVersionDetailId) }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง akathospital_version_details_log
        await pm.akathospital_version_details_log.create({
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

        // ดึงค่า MAX(akathospital_version_detail_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(akathospital_version_detail_id), 0) + 1 AS nextId FROM akathospital_version_details`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE akathospital_version_details AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataAkathospitalVersionDetail : ', err);
        return msg(res, 500, { message: err.message });
    }
};