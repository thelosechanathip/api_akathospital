const pm = require('../../../config/prisma');
const { msg } = require('../../../utils/message');
const db_h = require('../../../config/db_h');
const bcrypt = require('bcryptjs');

// Function ในการบันทึกหรืออัพเดทข้อมูล Medical Record Audit ไปยัง Database
exports.insertFormIpd = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;
        const userFullname = {
            created_by: fullname,
            updated_by: fullname
        };

        const formIpdData = req.body;
        const fetchHcode = await pm.hcodes.findFirst({ select: { hcode_id: true } });

        // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
        const deplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        // เริ่มตรวจสอบ Request ที่ส่งเข้ามา
        await Promise.all(
            Object.entries(formIpdData).map(async ([key, value]) => {
                // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
                if (['patient_an'].includes(key) && !value) hasEmptyValue = true;

                // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
                if (['patient_an'].includes(key) && value) {
                    const existingRecord = await pm.patients.findFirst({
                        where: { [key]: value },
                        select: { patient_id: true }
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

        // ดึงข้อมูลคนไข้มาจาก Database ของ HoSXP
        const [fetchPatient] = await db_h.query(
            `
                SELECT 
                    CONCAT(pt.pname, pt.fname, ' ', pt.lname) AS fullname,
                    o.hn,
                    o.vn,
                    i.an,
                    o.vstdate,
                    i.regdate,
                    i.dchdate
                FROM ovst AS o
                LEFT OUTER JOIN ipt AS i ON o.vn = i.vn
                LEFT OUTER JOIN patient AS pt ON i.hn = pt.hn
                WHERE 
                    i.an = ?
            `,
            [formIpdData.patient_an]
        );

        // บันทึกข้อมูลไปยังตาราง patients ใน Database akathospital
        const startTime = Date.now();
        const insertPatient = await pm.patients.create({
            data: {
                hcode_id: Number(fetchHcode.hcode_id),
                patient_fullname: fetchPatient[0].fullname,
                patient_hn: fetchPatient[0].hn,
                patient_vn: fetchPatient[0].vn,
                patient_an: fetchPatient[0].an,
                patient_date_service: fetchPatient[0].vstdate,
                patient_date_admitted: fetchPatient[0].regdate,
                patient_date_discharged: fetchPatient[0].dchdate,
                ...userFullname
            }
        });
        if (insertPatient) {
            // บันทึกข้อมูลไปยังตาราง form_ipds ใน Database akathospital
            const insertFormIpd = await pm.form_ipds.create({
                data: {
                    patient_id: Number(insertPatient.patient_id),
                    ...userFullname
                }
            });
            if (insertFormIpd) {
                const { patient_an, content } = formIpdData;

                // ตรวจสอบว่า content_of_medical_record_id ซ้ำกันหรือไม่
                const contentIds = content.map(item => item.content_of_medical_record_id);
                const uniqueContentIds = new Set(contentIds);
                if (uniqueContentIds.size !== contentIds.length) {
                    // ถ้าจำนวน unique IDs ไม่เท่ากับจำนวนทั้งหมด แปลว่ามีซ้ำ
                    return msg(res, 400, { error: `ไม่สามารถบันทึก content_of_medical_record ซ้ำกันได้ใน 1 Form` });
                }
                // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
                const contentDeplicateStatus = [];
                const contentDuplicateMessages = [];

                // เริ่มตรวจสอบ Request ที่ส่งเข้ามา
                await Promise.all(
                    Object.entries(contentIds).map(async ([key, value]) => {
                        const existingRecord = await pm.content_of_medical_records.findFirst({
                            where: { content_of_medical_record_id: value },
                            select: { content_of_medical_record_id: true }
                        });

                        if (!existingRecord) {
                            contentDeplicateStatus.push(404);
                            contentDuplicateMessages.push(`( ${value} ) ไม่มีข้อมูลในระบบ!`);
                        }
                    })
                );

                // ถ้ามีข้อมูลซ้ำหรือค่าที่ว่าง ให้ส่ง response กลับครั้งเดียว
                if (contentDuplicateMessages.length > 0) return msg(res, Math.max(...contentDeplicateStatus), { message: contentDuplicateMessages.join(" AND ") });

                // คีย์ที่ไม่ต้องการให้รวมในการคำนวณ (ยกเว้น point_deducted ที่จะลบทีหลัง)
                const excludedKeys = [
                    "content_of_medical_record_id",
                    "comment",
                    "total_score", // ถ้ามีอยู่ในข้อมูลเดิม จะไม่รวม
                    "point_deducted" // จะแยกไปลบทีหลัง
                ];

                const resultFormIpdContentOfMedicalRecord = content.map(item => {
                    // ดึงทุก key จาก item และกรองเอาเฉพาะที่ไม่ใช่ excludedKeys
                    const itemSum = Object.keys(item)
                        .filter(key => !excludedKeys.includes(key))
                        .reduce((acc, key) => acc + (Number(item[key]) || 0), 0);

                    // ลบด้วย point_deducted (ถ้ามีค่า ถ้าไม่มีให้เป็น 0)
                    const totalScore = itemSum - (Number(item.point_deducted) || 0);

                    // คืนค่า item พร้อม totalScore
                    return {
                        form_ipd_id: insertFormIpd.form_ipd_id,
                        ...item,
                        total_score: totalScore,
                        ...userFullname
                    };
                });

                // Insert ข้อมูลทั้งหมดพร้อมกัน
                const insertPromisesFormIpdContentOfMedicalRecord = resultFormIpdContentOfMedicalRecord.map(i =>
                    pm.form_ipd_content_of_medical_record_results.create({
                        data: i
                    })
                );

                await Promise.all(insertPromisesFormIpdContentOfMedicalRecord);

                if (insertPromisesFormIpdContentOfMedicalRecord) {
                    const { overall } = req.body;

                    // ตรวจสอบว่า content_of_medical_record_id ซ้ำกันหรือไม่
                    const overallIds = overall.map(item => item.overall_finding_id);
                    const uniqueOverallIds = new Set(overallIds);
                    if (uniqueOverallIds.size !== overallIds.length) {
                        // ถ้าจำนวน unique IDs ไม่เท่ากับจำนวนทั้งหมด แปลว่ามีซ้ำ
                        return msg(res, 400, { error: `ไม่สามารถบันทึก overall_finding ซ้ำกันได้ใน 1 Form` });
                    }

                    const resultFormIpdOverallFinding = overall.map(item => {
                        return {
                            form_ipd_id: insertFormIpd.form_ipd_id,
                            ...item,
                            ...userFullname
                        };
                    });

                    const insertPromisesFormIpdOverallFinding = resultFormIpdOverallFinding.map(i =>
                        pm.form_ipd_overall_finding_results.create({
                            data: i
                        })
                    );

                    await Promise.all(insertPromisesFormIpdOverallFinding);

                    if (insertPromisesFormIpdOverallFinding) {
                        const { patient_an, content, overall, ...reviewStatusData } = req.body;

                        reviewStatusData.form_ipd_id = insertFormIpd.form_ipd_id;

                        await pm.form_ipd_review_status_results.create({
                            data: {
                                ...reviewStatusData,
                                ...userFullname
                            }
                        });
                    }
                }
            }
        }

        const endTime = Date.now() - startTime;
        // บันทึก Log
        await pm.forms_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: insertPatient ? 1 : 0,
                status: insertPatient ? 'Success' : 'Failed'
            }
        });

        return msg(res, 200, { message: 'Upsert successfully!' });
    } catch (err) {
        console.error("upsertFormIpd error:", err.message);
        return msg(res, 500, `Internal server`);
    }
};

// Function ในการลบข้อมูล Medical Record Audit บน Database
exports.removeFormIpd = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;
        const { an } = req.params;
        const { password } = req.body;
        if (!password) return msg(res, 400, { message: 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบข้อมูล!' });

        const fetchPassword = await pm.users.findFirst({
            where: { user_id: req.user.user_id },
            select: { password: true }
        });

        const isMath = await bcrypt.compare(password, fetchPassword.password);
        if (!isMath) return msg(res, 400, { message: 'รหัสผ่านไม่ถูกต้องกรุณาตรวจสอบรหัสผ่าน!' });

        const startTime = Date.now();
        const fetchPatient = await pm.patients.findFirst({
            where: { patient_an: an }, select: { patient_id: true }
        });
        if (!fetchPatient) return msg(res, 404, { message: `ไม่มีข้อมูล ${an} อยู่ในระบบกรุณาตรวจสอบ ${an} เพื่อความถูกต้อง!` });

        const fetchFormIpd = await pm.form_ipds.findFirst({
            where: { patient_id: fetchPatient.patient_id }, select: { form_ipd_id: true }
        });

        if (fetchFormIpd) {
            // Remove Data In form_ipd_review_status_results
            await pm.form_ipd_review_status_results.deleteMany({
                where: { form_ipd_id: Number(fetchFormIpd.form_ipd_id) }
            });

            // ดึงค่า MAX(form_ipd_review_status_result_id)
            const maxIdFormIpdReviewStatusResult = await pm.$queryRaw`SELECT COALESCE(MAX(form_ipd_review_status_result_id), 0) + 1 AS nextId FROM form_ipd_review_status_results`;

            // รีเซ็ตค่า AUTO_INCREMENT
            await pm.$executeRawUnsafe(`ALTER TABLE form_ipd_review_status_results AUTO_INCREMENT = ${maxIdFormIpdReviewStatusResult[0].nextId}`);

            // Remove Data In form_ipd_overall_finding_results
            await pm.form_ipd_overall_finding_results.deleteMany({
                where: { form_ipd_id: Number(fetchFormIpd.form_ipd_id) }
            });

            // ดึงค่า MAX(form_ipd_overall_finding_result_id)
            const maxIdFormIpdOverallFindingResult = await pm.$queryRaw`SELECT COALESCE(MAX(form_ipd_overall_finding_result_id), 0) + 1 AS nextId FROM form_ipd_overall_finding_results`;

            // รีเซ็ตค่า AUTO_INCREMENT
            await pm.$executeRawUnsafe(`ALTER TABLE form_ipd_overall_finding_results AUTO_INCREMENT = ${maxIdFormIpdOverallFindingResult[0].nextId}`);

            // Remove Data In form_ipd_content_of_medical_record_results
            await pm.form_ipd_content_of_medical_record_results.deleteMany({
                where: { form_ipd_id: Number(fetchFormIpd.form_ipd_id) }
            });

            // ดึงค่า MAX(form_ipd_content_of_medical_record_result_id)
            const maxIdFormIpdContentOfMedicalRecordResult = await pm.$queryRaw`SELECT COALESCE(MAX(form_ipd_content_of_medical_record_result_id), 0) + 1 AS nextId FROM form_ipd_content_of_medical_record_results`;

            // รีเซ็ตค่า AUTO_INCREMENT
            await pm.$executeRawUnsafe(`ALTER TABLE form_ipd_content_of_medical_record_results AUTO_INCREMENT = ${maxIdFormIpdContentOfMedicalRecordResult[0].nextId}`);
        }

        // Remove Data In form_ipds
        await pm.form_ipds.delete({
            where: { form_ipd_id: fetchFormIpd.form_ipd_id }
        });

        // ดึงค่า MAX(form_ipd_id)
        const maxIdFormIpdResult = await pm.$queryRaw`SELECT COALESCE(MAX(form_ipd_id), 0) + 1 AS nextId FROM form_ipds`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE form_ipds AUTO_INCREMENT = ${maxIdFormIpdResult[0].nextId}`);

        // Remove Data In patients
        const removePatient = await pm.patients.delete({
            where: { patient_an: an }, select: { patient_id: true }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.forms_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: removePatient ? 1 : 0,
                status: removePatient ? 'Success' : 'Failed'
            }
        });

        // ดึงค่า MAX(patient_id)
        const maxIdPatientResult = await pm.$queryRaw`SELECT COALESCE(MAX(patient_id), 0) + 1 AS nextId FROM patients`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE patients AUTO_INCREMENT = ${maxIdPatientResult[0].nextId}`);

        return msg(res, 200, { message: `Remove ${an} successfully!` });
    } catch (err) {
        console.error("removeFormIpd error:", err.message);
        return msg(res, 500, `Internal server`);
    }
};