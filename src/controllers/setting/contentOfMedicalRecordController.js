const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');
const { capitalizeFirstLetter } = require('../../utils/allCheck');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataContentOfMedicalRecords = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.content_of_medical_records.findMany({
            include: {
                patient_service_id: false,
                patient_services: {
                    select: {
                        patient_service_id: true,
                        patient_service_name_english: true,
                        patient_service_name_thai: true
                    }
                }
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง content_of_medical_records_log
        await pm.content_of_medical_records_log.create({
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
        console.log('getAllDataContentOfMedicalRecords : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataContentOfMedicalRecord = async (req, res) => {
    try {
        const contentOfMedicalRecordData = req.body; // ดึงข้อมูลทั้งหมดจาก req.body
        const fullname = req.user.fullname_thai;
        contentOfMedicalRecordData.content_of_medical_record_name = await capitalizeFirstLetter(contentOfMedicalRecordData.content_of_medical_record_name);

        // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        await Promise.all(
            Object.entries(contentOfMedicalRecordData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (['content_of_medical_record_name'].includes(key) && !value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (['content_of_medical_record_name'].includes(key) && value) {
                    const existingRecord = await pm.content_of_medical_records.findFirst({
                        where: { [key]: value },
                        select: { content_of_medical_record_id: true }
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
        const insertData = await pm.content_of_medical_records.create({
            data: {
                ...contentOfMedicalRecordData, // กระจายค่าทั้งหมดจาก req.body
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.content_of_medical_records_log.create({
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
        console.error('insertDataContentOfMedicalRecord : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function สำหรับ Update ข้อมูลไปยัง Database
exports.updateDataContentOfMedicalRecord = async (req, res) => {
    try {
        const contentOfMedicalRecordId = req.params.id;
        const contentOfMedicalRecordData = req.body; // ข้อมูลที่ต้องการอัปเดต
        const fullname = req.user.fullname_thai;

        const fetchOneContentOfMedicalRecordById = await pm.content_of_medical_records.findFirst({
            where: { content_of_medical_record_id: Number(contentOfMedicalRecordId) },
            select: { content_of_medical_record_id: true }
        });
        if (!fetchOneContentOfMedicalRecordById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${contentOfMedicalRecordId} ) อยู่ในระบบ!` });

        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        await Promise.all(
            Object.entries(contentOfMedicalRecordData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (['content_of_medical_record_name'].includes(key) && !value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (['content_of_medical_record_name'].includes(key) && value) {
                    const existingRecord = await pm.content_of_medical_records.findFirst({
                        where: { [key]: value },
                        select: { content_of_medical_record_id: true }
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
        const updateData = await pm.content_of_medical_records.update({
            where: { content_of_medical_record_id: Number(contentOfMedicalRecordId) }, // ระบุ contentOfMedicalRecordId ที่ต้องการอัปเดต
            data: {
                ...contentOfMedicalRecordData, // กระจายค่าทั้งหมดจาก req.body
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.content_of_medical_records_log.create({
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
        console.error('updateDataContentOfMedicalRecord : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataContentOfMedicalRecord = async (req, res) => {
    try {
        const contentOfMedicalRecordId = req.params.id;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่ามี ID นี้ในระบบหรือไม่
        const fetchOneContentOfMedicalRecordById = await pm.content_of_medical_records.findFirst({
            where: { content_of_medical_record_id: Number(contentOfMedicalRecordId) },
            select: { content_of_medical_record_id: true }
        });

        if (!fetchOneContentOfMedicalRecordById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${contentOfMedicalRecordId} ) อยู่ในระบบ!` });

        // ลบข้อมูล
        const startTime = Date.now();
        const removeData = await pm.content_of_medical_records.delete({
            where: { content_of_medical_record_id: Number(contentOfMedicalRecordId) }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง content_of_medical_records_log
        await pm.content_of_medical_records_log.create({
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

        // ดึงค่า MAX(content_of_medical_record_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(content_of_medical_record_id), 0) + 1 AS nextId FROM content_of_medical_records`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE content_of_medical_records AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataContentOfMedicalRecord : ', err);
        return msg(res, 500, { message: err.message });
    }
};