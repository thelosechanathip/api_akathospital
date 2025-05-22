const models = require('../../models/private/mraIPD.model');
const bcrypt = require('bcryptjs');
const moment = require('moment');

// Function สำหรับจัดการข้อมูลเมื่อ insert ไม่สําเร็จ
exports.cleanupFailInsert = async (...agrs) => {
    const [an, form_ipd_id] = agrs;
    await models.removeFormIpdReviewStatusResult(form_ipd_id);
    await models.removeFormIpdOverallFindingResult(form_ipd_id);
    await models.removeFormIpdContentOfMedicalRecordResult(form_ipd_id);
    await models.removeFormIpd(form_ipd_id);
    await models.removePatient(an);
};

exports.fetchData = async (logPayload) => {
    try {
        const startTime = Date.now();
        const fadResult = await models.fetchAllData();
        if (!fadResult || fadResult.length === 0) {
            logPayload.execution_time = Date.now() - startTime;
            logPayload.row_count = 0;
            logPayload.status = 'No Data';
            await models.createLog(logPayload);
            return { status: 404, message: 'ไม่มีข้อมูลใน Database!' };
        }

        const resultsWithDefaultSum = [];

        for (const data of fadResult) {
            let totalDefaultSum = 0;
            let totalScoreSum = 0;
            for (const content of data.form_ipd_content_of_medical_record_results) {
                if (content.na === false && content.missing === false && content.no === false) {
                    const comrId = content.content_of_medical_records.content_of_medical_record_id;

                    const checkType = await models.fetchTypeContentOfMedicalRecordId(comrId);
                    const comrKeys = Object.keys(checkType).filter(k => k.startsWith("criterion_number_"));
                    const itemSum = comrKeys.reduce((acc, key) => {
                        const value = checkType[key];
                        if (value === true) {
                            return acc + 1;
                        }
                        return acc;
                    }, 0);
                    totalDefaultSum += itemSum;

                    if (typeof content.total_score === 'number') {
                        totalScoreSum += content.total_score;
                    }
                }
            }
            data.totalDefaultSum = totalDefaultSum;
            data.totalScoreSum = totalScoreSum;
            const resultSum = totalScoreSum / totalDefaultSum * 100;
            const formattedResultSum = resultSum.toFixed(2);
            data.formattedResultSum = parseFloat(formattedResultSum);
            resultsWithDefaultSum.push(data);
        }

        const endTime = Date.now() - startTime;
        logPayload.execution_time = endTime;
        logPayload.row_count = fadResult.length; // Correct row count
        logPayload.status = 'Success';
        await models.createLog(logPayload);

        return { status: 200, data: resultsWithDefaultSum };
    } catch (err) {
        throw err;
    }
};

exports.fetchOneData = async (...agrs) => {
    const [an, logPayload] = agrs;
    try {
        const patientResult = await models.fetchOnePatientIdInPatientAn(an);
        if (!patientResult || patientResult.length === 0) return { status: 400, message: `${an} ไม่มีข้อมูลอยู่ในระบบ` }

        const startTime = Date.now();
        const fadResult = await models.fetchOneData(patientResult.patient_id);
        if (!fadResult || fadResult.length === 0) return { status: 404, message: `ไม่มีข้อมูลใน Database กรุณาตรวจสอบ!` };
        const endTime = Date.now() - startTime;

        const resultsWithDefaultSum = [];

        for (const data of fadResult) {
            let totalDefaultSum = 0;
            let totalScoreSum = 0;
            for (const content of data.form_ipd_content_of_medical_record_results) {
                if (content.na === false && content.missing === false && content.no === false) {
                    const comrId = content.content_of_medical_records.content_of_medical_record_id;

                    const checkType = await models.fetchTypeContentOfMedicalRecordId(comrId);
                    const comrKeys = Object.keys(checkType).filter(k => k.startsWith("criterion_number_"));
                    const itemSum = comrKeys.reduce((acc, key) => {
                        const value = checkType[key];
                        if (value === true) {
                            return acc + 1;
                        }
                        return acc;
                    }, 0);
                    totalDefaultSum += itemSum;

                    if (typeof content.total_score === 'number') {
                        totalScoreSum += content.total_score;
                    }
                }
            }
            data.totalDefaultSum = totalDefaultSum;
            data.totalScoreSum = totalScoreSum;
            const resultSum = totalScoreSum / totalDefaultSum * 100;
            const formattedResultSum = resultSum.toFixed(2);
            data.formattedResultSum = parseFloat(formattedResultSum);
            resultsWithDefaultSum.push(data);
        }

        logPayload.execution_time = endTime;
        logPayload.row_count = fadResult ? 1 : 0;
        logPayload.status = fadResult ? 'Success' : 'No Data';

        await models.createLog(logPayload);

        return { status: 200, data: resultsWithDefaultSum };
    } catch (err) {
        throw err;
    }
};

exports.fetchOnePatientData = async (an) => {
    try {
        const [patientResult] = await models.fetchPatientInHos(an);
        if (!patientResult || patientResult.length === 0) return { status: 400, message: `${an} นี้ไม่มีข้อมูลอยู่ในระบบ!` }

        const patientInMraResult = await models.fetchPatientInMra(an);
        if (patientInMraResult) return { status: 409, message: `${an} นี้มีข้อมูลอยู่ในระบบ MRA แล้วไม่สามารถบันทึกซ้ำได้` }

        patientResult[0].vstdate = moment(patientResult[0].vstdate).format('YYYY-MM-DD');
        patientResult[0].regdate = moment(patientResult[0].vstdate).format('YYYY-MM-DD');
        patientResult[0].dchdate = moment(patientResult[0].vstdate).format('YYYY-MM-DD');

        return { status: 200, data: patientResult };
    } catch (err) {
        throw err;
    }
};

exports.generateForm = async (...agrs) => {
    const [data, fullname, logPayload] = agrs;
    try {
        const fhResult = await models.fetchHcode();
        const fullnamePayload = {
            created_by: fullname,
            updated_by: fullname
        }

        // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
        const duplicateStatus = [];
        const duplicateMessages = [];
        let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

        // เริ่มตรวจสอบ Request ที่ส่งเข้ามา
        for (const [key, value] of Object.entries(data)) {
            // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
            if (['patient_an'].includes(key) && !value) hasEmptyValue = true;

            // ตรวจสอบค่าซ้ำเฉพาะ field ที่ไม่ว่าง
            if (['patient_an'].includes(key) && value) {
                const patientData = await models.fetchPatientInAkatData(key, value);
                if (patientData) {
                    const formData = await models.fetchOneFormIpdIdInPatientId(patientData.patient_id);
                    const formIRSR = await models.fetchFormIRSRInAkatData(formData.form_ipd_id);

                    if (formIRSR) {
                        duplicateStatus.push(409);
                        duplicateMessages.push(`( ${value} ) มีข้อมูลในระบบที่สมบูรณ์แล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!`);
                    } else if (formIRSR === null || formIRSR === '') {
                        const result = await models.fetchOneData(patientData.patient_id);
                        return { status: 200, data: result };
                    }
                }
            }
        }

        // ถ้ามีค่าที่ว่าง ให้เพิ่มข้อความแค่ครั้งเดียว
        if (hasEmptyValue) {
            duplicateMessages.unshift("กรุณากรอกข้อมูลให้ครบถ้วน!");
            return { status: 400, message: duplicateMessages[0] };
        }
        if (duplicateMessages.length > 0) return { status: Math.max(...duplicateStatus), message: duplicateMessages.join(" AND ") }

        // ดึงข้อมูลคนไข้มาจาก Database ของ HoSXP
        const [fetchPatient] = await models.fetchPatientInHos(data.patient_an);

        // บันทึกข้อมูลไปยังตาราง patients ใน Database akathospital
        const patientPayload = {
            hcode_id: Number(fhResult.hcode_id),
            patient_fullname: fetchPatient[0].fullname,
            patient_hn: fetchPatient[0].hn,
            patient_vn: fetchPatient[0].vn,
            patient_an: fetchPatient[0].an,
            patient_date_service: fetchPatient[0].vstdate,
            patient_date_admitted: fetchPatient[0].regdate,
            patient_date_discharged: fetchPatient[0].dchdate,
            ...fullnamePayload
        };

        const startTime = Date.now();
        const cpResult = await models.createPatient(patientPayload);
        if (cpResult) {
            const fiPayload = {
                patient_id: Number(cpResult.patient_id),
                ...fullnamePayload
            };

            const cfiResult = await models.createFormIpd(fiPayload);
            if (cfiResult) {
                const fetchCom = await models.fetchContentOfMedicalRecordId();
                const setComPayload = fetchCom.map(item => {
                    return {
                        form_ipd_id: cfiResult.form_ipd_id,
                        ...item,
                        ...fullnamePayload
                    };
                })
                const createFICOMRResult = await models.createFormIpdContentOfMedicalRecordResult(setComPayload)

                if (createFICOMRResult) {
                    const fetchOf = await models.fetchOverallFindingId();
                    const setOfPayload = fetchOf.map(item => {
                        return {
                            form_ipd_id: cfiResult.form_ipd_id,
                            ...item,
                            ...fullnamePayload
                        };
                    })
                    models.createFormIpdOverallFindingResult(setOfPayload)
                }
            }
        }

        const endTime = Date.now() - startTime;
        // บันทึก Log
        logPayload.execution_time = endTime;
        logPayload.row_count = cpResult ? 1 : 0;
        logPayload.status = cpResult ? 'Success' : 'No Data';

        await models.createLog(logPayload);

        const fodResult = await models.fetchOneData(cpResult.patient_id);

        return { status: 200, data: fodResult };
    } catch (err) {
        throw err;
    }
};

exports.updateForm = async (...agrs) => {
    const [an, data, fullname, logPayload] = agrs;
    const fullnamePayload = {
        updated_by: fullname
    }
    try {
        const startTime = Date.now();
        const patientData = await models.fetchOnePatientIdInPatientAn(an);
        if (!patientData || patientData.length === 0) return { status: 400, message: `${an} ไม่มีข้อมูลอยู่ในระบบ` };

        const formIpdData = await models.fetchOneFormIpdIdInPatientId(patientData.patient_id);

        if (formIpdData) {
            const { content } = data;

            // คีย์ที่ไม่ต้องการให้รวมในการคำนวณ (ยกเว้น point_deducted ที่จะลบทีหลัง)
            const excludedKeys = [
                "form_ipd_content_of_medical_record_result_id",
                "form_ipd_id",
                "content_of_medical_record_id",
                "na",
                "missing",
                "no",
                "comment",
                "total_score", // ถ้ามีอยู่ในข้อมูลเดิม จะไม่รวม
                "point_deducted" // จะแยกไปลบทีหลัง
            ];

            const resultFormIpdContentOfMedicalRecord = content.map(item => {
                const keys = Object.keys(item).filter(k => !excludedKeys.includes(k));

                let totalScore;

                // 1) ถ้าต้องการเซตทุกค่านอก excludedKeys เป็น 0 เมื่อ na/missing/no เป็น true
                if (item.na || item.missing || item.no) {
                    keys.forEach(k => item[k] = 0);
                    item.point_deducted = 0;
                    totalScore = 0;
                } else {
                    const itemSum = keys.reduce((acc, k) => acc + (Number(item[k]) || 0), 0);
                    // ลบ point_deducted
                    totalScore = itemSum - (Number(item.point_deducted) || 0);
                }

                return {
                    ...item,
                    total_score: totalScore,
                    ...fullnamePayload
                };
            });

            const updatePromisesFICOMR = resultFormIpdContentOfMedicalRecord.map(i =>
                models.updateFormIpdContentOfMedicalRecordResult(i, formIpdData.form_ipd_id)
            );

            await Promise.all(updatePromisesFICOMR);

            if (updatePromisesFICOMR) {
                const { overall } = data;

                const resultFormIpdOverallFinding = overall.map(item => {
                    return {
                        ...item,
                        ...fullnamePayload
                    };
                });

                const createPromisesFIOF = resultFormIpdOverallFinding.map(i =>
                    models.updateFormIpdOverallFindingResult(i, formIpdData.form_ipd_id)
                );

                await Promise.all(createPromisesFIOF);

                if (createPromisesFIOF) {
                    const { content, overall, ...reviewStatusData } = data;
                    if (Object.keys(reviewStatusData).length > 0) {
                        fullnamePayload.created_by = fullname;

                        const checkTypeReviewStatusResult = await models.checkTypeReviewStatusResult(reviewStatusData.review_status_id);
                        if (checkTypeReviewStatusResult.review_status_type) {
                            if (reviewStatusData.review_status_comment === null || reviewStatusData.review_status_comment === '') {
                                return { status: 400, message: 'กรุณากรอกความคิดเห็น' };
                            }
                        }

                        const checkUniqueFormIpdId = await models.checkUniqueFormIpdId(formIpdData.form_ipd_id);
                        if (checkUniqueFormIpdId) return { status: 400, message: 'มีข้อมูลอยู่ในระบบแล้ว ไม่สามารถมีข้อมูลซ้ำได้' };

                        const FIRSRPayload = {
                            form_ipd_id: formIpdData.form_ipd_id,
                            ...reviewStatusData,
                            ...fullnamePayload
                        }

                        await models.creatFormIpdReviewStatusResult(FIRSRPayload);
                    }
                }
            }
        }

        const endTime = Date.now() - startTime;
        // บันทึก Log
        logPayload.execution_time = endTime;
        logPayload.row_count = formIpdData ? 1 : 0;
        logPayload.status = formIpdData ? 'Success' : 'No Data';

        await models.createLog(logPayload);

        return { status: 200, message: 'อัพเดทข้อมูลเสร็จสิ้น!' };
    } catch (err) {
        throw err;
    }
};

exports.removeData = async (...agrs) => {
    const [an, data, { user_id }, logPayload] = agrs;

    const { password } = data;
    if (!password) return { status: 400, message: 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบข้อมูล!' };

    const fpipResult = await models.fetchPasswordInUser(user_id);
    if (!fpipResult) return { status: 400, message: 'ไม่มีข้อมูลผู้ใช้งานอยู่ในระบบกรุณาตรวจสอบข้อมูล!' };

    const isMath = await bcrypt.compare(password, fpipResult.password);
    if (!isMath) return { status: 400, message: 'รหัสผ่านไม่ถูกต้องกรุณาตรวจสอบรหัสผ่าน!' };

    const startTime = Date.now();
    const faipResult = await models.fetchAnInPatient(an);
    if (!faipResult) return { status: 404, message: `ไม่มีข้อมูล ${an} อยู่ในระบบกรุณาตรวจสอบ ${an} เพื่อความถูกต้อง!` };

    const fetchFormIpd = await models.fetchPatientIdInFormIpd(faipResult.patient_id);

    if (fetchFormIpd) {
        // Remove Data In form_ipd_review_status_results
        await models.removeFormIpdReviewStatusResult(fetchFormIpd.form_ipd_id);

        // Remove Data In form_ipd_overall_finding_results
        await models.removeFormIpdOverallFindingResult(fetchFormIpd.form_ipd_id);

        // Remove Data In form_ipd_content_of_medical_record_results
        await models.removeFormIpdContentOfMedicalRecordResult(fetchFormIpd.form_ipd_id);
    }

    // Remove Data In form_ipds
    await models.removeFormIpd(fetchFormIpd.form_ipd_id);

    // Remove Data In patients
    const removePatient = await models.removePatient(an);
    const endTime = Date.now() - startTime;

    // บันทึก Log
    logPayload.execution_time = endTime;
    logPayload.row_count = removePatient ? 1 : 0;
    logPayload.status = removePatient ? 'Success' : 'No Data';

    await models.createLog(logPayload);

    return { status: 200, message: `Remove ${an} successfully!` };
};