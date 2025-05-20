const pm = require('../../config/prisma');
const db_h = require('../../config/db_h');

// บันทึกข้อมูลไปยัง Log
exports.createLog = async (logData) => {
    return await pm.forms_log.create({ data: { ...logData } });
};

// ดึงข้อมูลทั้งหมด
exports.fetchAllData = async () => {
    return await pm.form_ipds.findMany({
        include: {
            patient_id: false,
            patients: {
                include: {
                    hcode_id: false,
                    hcodes: {
                        select: {
                            hcode_id: true,
                            hcode_name: true
                        }
                    }
                }
            },
            form_ipd_content_of_medical_record_results: {
                include: {
                    content_of_medical_record_id: false,
                    content_of_medical_records: {
                        select: {
                            content_of_medical_record_id: true,
                            content_of_medical_record_name: true
                        }
                    }
                }
            },
            form_ipd_overall_finding_results: {
                include: {
                    overall_finding_id: false,
                    overall_finding: {
                        select: {
                            overall_finding_id: true,
                            overall_finding_name: true
                        }
                    }
                }
            },
            form_ipd_review_status_results: {
                include: {
                    review_status_id: false,
                    review_status: {
                        select: {
                            review_status_id: true,
                            review_status_name: true
                        }
                    }
                }
            }
        }
    });
};

exports.fetchTypeContentOfMedicalRecordId = async (id) => {
    return await pm.content_of_medical_records.findFirst({
        where: { content_of_medical_record_id: Number(id) }
    })
};

// ดึงข้อมูล patient_id ด้วย an ที่ส่งเข้ามา ในตาราง patients
exports.fetchOnePatientIdInPatientAn = async (an) => {
    return await pm.patients.findFirst({ where: { patient_an: an }, select: { patient_id: true } })
};

exports.fetchOneFormIpdIdInPatientId = async (patient_id) => {
    return await pm.form_ipds.findFirst({ where: { patient_id: Number(patient_id) }, select: { form_ipd_id: true } });
};

// ดึงข้อมูลจาก patient_id ที่ส่งเข้ามา
exports.fetchOneData = async (patient_id) => {
    return await pm.form_ipds.findMany({
        where: {
            patient_id: patient_id
        },
        include: {
            patient_id: false,
            patients: {
                include: {
                    hcode_id: false,
                    hcodes: {
                        select: {
                            hcode_id: true,
                            hcode_name: true
                        }
                    }
                }
            },
            form_ipd_content_of_medical_record_results: {
                include: {
                    content_of_medical_record_id: false,
                    content_of_medical_records: {}
                }
            },
            form_ipd_overall_finding_results: {
                include: {
                    overall_finding_id: false,
                    overall_finding: {}
                }
            },
            form_ipd_review_status_results: {
                include: {
                    review_status_id: false,
                    review_status: {}
                }
            }
        }
    });
};

// ดึงข้อมูล hcode_id ในตาราง hcodes
exports.fetchHcode = async () => {
    return await pm.hcodes.findFirst({ select: { hcode_id: true } });
};

// ดึงข้อมูล patient_id ในตาราง patients
exports.fetchPatientInAkatData = async (key, value) => {
    return await pm.patients.findFirst({ where: { [key]: value }, select: { patient_id: true } });
};

exports.fetchFormIRSRInAkatData = async (form_ipd_id) => {
    return await pm.form_ipd_review_status_results.findFirst({
        where: { form_ipd_id: form_ipd_id },
        select: { review_status_id: true }
    })
};

// ดึงข้อมูลคนไข้จากระบบ HoSXP ด้วย AN ที่ส่ง Request เข้ามา
exports.fetchPatientInHos = async (patient_an) => {
    return await db_h.query(
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
        [patient_an]
    );
};

exports.fetchPatientInMra = async (patient_an) => {
    return await pm.patients.findFirst({ where: { patient_an: patient_an }, select: { patient_id: true } });
};

// บันทึกข้อมูลไปยังตาราง patients
exports.createPatient = async (data) => {
    return await pm.patients.create({ data: { ...data } });
};

// บันทึกข้อมูลไปยังตาราง form_ipds
exports.createFormIpd = async (data) => {
    return await pm.form_ipds.create({ data: { ...data } });
};

exports.fetchContentOfMedicalRecordId = async () => {
    return await pm.content_of_medical_records.findMany({
        where: { patient_service_id: Number(2) },
        select: { content_of_medical_record_id: true },
        orderBy: { content_of_medical_record_id: 'asc' }
    })
};

exports.fetchOverallFindingId = async () => {
    return await pm.overall_finding.findMany({
        where: { patient_service_id: Number(2) },
        select: { overall_finding_id: true },
        orderBy: { overall_finding_id: 'asc' }
    })
};

// Fetchข้อมูล จากตาราง content_of_medical_records
exports.fetchComrId = async (value) => {
    return await pm.content_of_medical_records.findFirst({
        where: { content_of_medical_record_id: Number(value) },
        select: { content_of_medical_record_id: true }
    });
};

// บันทึกข้อมูลไปยังตาราง form_ipd_content_of_medical_record_results
exports.createFormIpdContentOfMedicalRecordResult = async (data) => {
    return await pm.form_ipd_content_of_medical_record_results.createMany({ data: data });
};

exports.updateFormIpdContentOfMedicalRecordResult = async (row, formIpdId) => {
    // เตรียม payload ตัด field ที่อาจเป็น undefined ออก
    const data = {
        na: row.na,
        missing: row.missing,
        no: row.no,
        criterion_number_1: row.criterion_number_1,
        criterion_number_2: row.criterion_number_2,
        criterion_number_3: row.criterion_number_3,
        criterion_number_4: row.criterion_number_4,
        criterion_number_5: row.criterion_number_5,
        criterion_number_6: row.criterion_number_6,
        criterion_number_7: row.criterion_number_7,
        criterion_number_8: row.criterion_number_8,
        criterion_number_9: row.criterion_number_9,
        point_deducted: row.point_deducted,
        total_score: row.total_score,
        comment: row.comment,
        updated_by: row.updated_by,
    };

    // ลบ key ที่เป็น undefined
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    return pm.form_ipd_content_of_medical_record_results.update({
        where: {
            form_ipd_id: Number(formIpdId),
            content_of_medical_record_id: Number(row.content_of_medical_record_id),
            form_ipd_content_of_medical_record_result_id: Number(row.form_ipd_content_of_medical_record_result_id),
        },
        data: data,
    });
};

// บันทึกข้อมูลไปยังตาราง form_ipd_overall_finding_results
exports.createFormIpdOverallFindingResult = async (data) => {
    return await pm.form_ipd_overall_finding_results.createMany({ data: data });
};

exports.updateFormIpdOverallFindingResult = async (row, formIpdId) => {
    const data = {
        overall_finding_result: row.overall_finding_result,
        updated_by: row.updated_by,
    };

    // ลบ key ที่เป็น undefined
    Object.keys(data).forEach(k => data[k] === undefined && delete data[k]);

    return pm.form_ipd_overall_finding_results.update({
        where: {
            form_ipd_id: Number(formIpdId),
            overall_finding_id: Number(row.overall_finding_id),
            form_ipd_overall_finding_result_id: Number(row.form_ipd_overall_finding_result_id),
        },
        data,
    });
};

exports.checkTypeReviewStatusResult = async (rsId) => {
    return await pm.review_status.findFirst({ where: { review_status_id: Number(rsId) }, select: { review_status_type: true } });
};

exports.checkUniqueFormIpdId = async (fiId) => {
    return await pm.form_ipd_review_status_results.findFirst({ where: { form_ipd_id: Number(fiId) }, select: { form_ipd_id: true } });
};

// บันทึกหรืออัพเดทข้อมูลไปยังตาราง form_ipd_review_status_results
exports.creatFormIpdReviewStatusResult = async (data) => {
    return await pm.form_ipd_review_status_results.create({ data: data })
};

// ดึงข้อมูล password ในตาราง users
exports.fetchPasswordInUser = async (user_id) => {
    return await pm.users.findFirst({ where: { user_id: Number(user_id) }, select: { password: true } });
};

// ดึงข้อมูล patient_id ในตาราง patients
exports.fetchAnInPatient = async (an) => {
    return await pm.patients.findFirst({ where: { patient_an: an }, select: { patient_id: true } })
};

// ดึงข้อมูล form_ipd_id ในตาราง form_ipds
exports.fetchPatientIdInFormIpd = async (patient_id) => {
    return await pm.form_ipds.findFirst({ where: { patient_id: Number(patient_id) }, select: { form_ipd_id: true } });
};

// ลบข้อมูลในตาราง form_ipd_review_status_results ด้วย form_ipd_id
exports.removeFormIpdReviewStatusResult = async (form_ipd_id) => {
    await pm.form_ipd_review_status_results.deleteMany({ where: { form_ipd_id: Number(form_ipd_id) } });

    // ดึงค่า MAX(form_ipd_review_status_result_id)
    const maxIdFormIpdReviewStatusResult = await pm.$queryRaw`SELECT COALESCE(MAX(form_ipd_review_status_result_id), 0) + 1 AS nextId FROM form_ipd_review_status_results`;

    // รีเซ็ตค่า AUTO_INCREMENT
    return await pm.$executeRawUnsafe(`ALTER TABLE form_ipd_review_status_results AUTO_INCREMENT = ${maxIdFormIpdReviewStatusResult[0].nextId}`);
};

// ลบข้อมูลในตาราง form_ipd_overall_finding_results ด้วย form_ipd_id
exports.removeFormIpdOverallFindingResult = async (form_ipd_id) => {
    await pm.form_ipd_overall_finding_results.deleteMany({ where: { form_ipd_id: Number(form_ipd_id) } });

    // ดึงค่า MAX(form_ipd_overall_finding_result_id)
    const maxIdFormIpdOverallFindingResult = await pm.$queryRaw`SELECT COALESCE(MAX(form_ipd_overall_finding_result_id), 0) + 1 AS nextId FROM form_ipd_overall_finding_results`;

    // รีเซ็ตค่า AUTO_INCREMENT
    return await pm.$executeRawUnsafe(`ALTER TABLE form_ipd_overall_finding_results AUTO_INCREMENT = ${maxIdFormIpdOverallFindingResult[0].nextId}`);
};

// ลบข้อมูลในตาราง form_ipd_content_of_medical_record_results ด้วย form_ipd_id
exports.removeFormIpdContentOfMedicalRecordResult = async (form_ipd_id) => {
    await pm.form_ipd_content_of_medical_record_results.deleteMany({ where: { form_ipd_id: Number(form_ipd_id) } });

    // ดึงค่า MAX(form_ipd_content_of_medical_record_result_id)
    const maxIdFormIpdContentOfMedicalRecordResult = await pm.$queryRaw`SELECT COALESCE(MAX(form_ipd_content_of_medical_record_result_id), 0) + 1 AS nextId FROM form_ipd_content_of_medical_record_results`;

    // รีเซ็ตค่า AUTO_INCREMENT
    return await pm.$executeRawUnsafe(`ALTER TABLE form_ipd_content_of_medical_record_results AUTO_INCREMENT = ${maxIdFormIpdContentOfMedicalRecordResult[0].nextId}`);
};

// ลบข้อมูลในตาราง form_ipds ด้วย form_ipd_id
exports.removeFormIpd = async (form_ipd_id) => {
    await pm.form_ipds.delete({ where: { form_ipd_id: form_ipd_id } });

    // ดึงค่า MAX(form_ipd_id)
    const maxIdFormIpdResult = await pm.$queryRaw`SELECT COALESCE(MAX(form_ipd_id), 0) + 1 AS nextId FROM form_ipds`;

    // รีเซ็ตค่า AUTO_INCREMENT
    return await pm.$executeRawUnsafe(`ALTER TABLE form_ipds AUTO_INCREMENT = ${maxIdFormIpdResult[0].nextId}`);
};

// ลบข้อมูลในตาราง patients ด้วย an
exports.removePatient = async (an) => {
    await pm.patients.delete({ where: { patient_an: an }, select: { patient_id: true } });

    // ดึงค่า MAX(patient_id)
    const maxIdPatientResult = await pm.$queryRaw`SELECT COALESCE(MAX(patient_id), 0) + 1 AS nextId FROM patients`;

    // รีเซ็ตค่า AUTO_INCREMENT
    return await pm.$executeRawUnsafe(`ALTER TABLE patients AUTO_INCREMENT = ${maxIdPatientResult[0].nextId}`);
};