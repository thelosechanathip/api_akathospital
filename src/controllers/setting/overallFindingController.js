const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataOverallFinding = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.overall_finding.findMany({
            include: {
                patient_service_id: false,
                patient_services: {
                    select: {
                        patient_service_name_english: true,
                        patient_service_name_thai: true
                    }
                }
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง overall_finding_log
        await pm.overall_finding_log.create({
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
        console.log('getAllDataOverallFinding : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataOverallFinding = async (req, res) => {
    try {
        const overallFindingData = req.body; // ดึงข้อมูลทั้งหมดจาก req.body
        const fullname = req.user.fullname_thai;

        // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        await Promise.all(
            Object.entries(overallFindingData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (['overall_finding_name'].includes(key) && !value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (['overall_finding_name'].includes(key) && value) {
                    const existingRecord = await pm.overall_finding.findFirst({
                        where: { [key]: value },
                        select: { overall_finding_id: true }
                    });

                    if (existingRecord) {
                        deplicateStatus.push(409);
                        duplicateMessages.push(`( ${value} ) มีข้อมูลในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!`);
                    }
                }

                // ตรวจสอบว่ามี PatientServiceId นี้อยู่ใน Table patient_services จริงหรือไม่?
                if(['patient_service_id'].includes(key) && value) {
                    const existingRecord = await pm.patient_services.findFirst({
                        where: { [key]: value },
                        select: { patient_service_id: true }
                    });

                    if (!existingRecord) {
                        deplicateStatus.push(404);
                        duplicateMessages.push(`ไม่มี ( ID: ${value}) อยู่ใน patientService!`);
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
        const insertData = await pm.overall_finding.create({
            data: {
                ...overallFindingData, // กระจายค่าทั้งหมดจาก req.body
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.overall_finding_log.create({
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
        console.error('insertDataOverallFinding : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function สำหรับ Update ข้อมูลไปยัง Database
exports.updateDataOverallFinding = async (req, res) => {
    try {
        const overallFindingId = req.params.id;
        const overallFindingData = req.body; // ข้อมูลที่ต้องการอัปเดต
        const fullname = req.user.fullname_thai;

        const fetchOneOverallFindingById = await pm.overall_finding.findFirst({
            where: { overall_finding_id: Number(overallFindingId) },
            select: { overall_finding_id: true }
        });
        if (!fetchOneOverallFindingById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${overallFindingId} ) อยู่ในระบบ!` });

        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        await Promise.all(
            Object.entries(overallFindingData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (['overall_finding_name'].includes(key) && !value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (['overall_finding_name'].includes(key) && value) {
                    const existingRecord = await pm.overall_finding.findFirst({
                        where: { [key]: value },
                        select: { overall_finding_id: true }
                    });

                    if (existingRecord) {
                        deplicateStatus.push(409);
                        duplicateMessages.push(`( ${value} ) มีข้อมูลในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!`);
                    }
                }

                // ตรวจสอบว่ามี PatientServiceId นี้อยู่ใน Table patient_services จริงหรือไม่?
                if(['patient_service_id'].includes(key) && value) {
                    const existingRecord = await pm.patient_services.findFirst({
                        where: { [key]: value },
                        select: { patient_service_id: true }
                    });

                    if (!existingRecord) {
                        deplicateStatus.push(404);
                        duplicateMessages.push(`ไม่มี ( ID: ${value}) อยู่ใน patientService!`);
                    }
                }
            })
        );

        // อัปเดตข้อมูล
        const startTime = Date.now();
        const updateData = await pm.overall_finding.update({
            where: { overall_finding_id: Number(overallFindingId) }, // ระบุ overallFindingId ที่ต้องการอัปเดต
            data: {
                ...overallFindingData, // กระจายค่าทั้งหมดจาก req.body
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.overall_finding_log.create({
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
        console.error('updateDataOverallFinding : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataOverallFinding = async (req, res) => {
    try {
        const overallFindingId = req.params.id;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่ามี ID นี้ในระบบหรือไม่
        const fetchOneOverallFindingById = await pm.overall_finding.findFirst({
            where: { overall_finding_id: Number(overallFindingId) },
            select: { overall_finding_id: true }
        });

        if (!fetchOneOverallFindingById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${overallFindingId} ) อยู่ในระบบ!` });

        // ลบข้อมูล
        const startTime = Date.now();
        const removeData = await pm.overall_finding.delete({
            where: { overall_finding_id: Number(overallFindingId) }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง overall_finding_log
        await pm.overall_finding_log.create({
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

        // ดึงค่า MAX(overall_finding_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(overall_finding_id), 0) + 1 AS nextId FROM overall_finding`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE overall_finding AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataOverallFinding : ', err);
        return msg(res, 500, { message: err.message });
    }
};