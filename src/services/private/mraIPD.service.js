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
        if (!fadResult || fadResult.length === 0) return { status: 404, message: 'ไม่มีข้อมูลใน Database!' };
        const endTime = Date.now() - startTime;

        logPayload.execution_time = endTime;
        logPayload.row_count = fadResult ? 1 : 0;
        logPayload.status = fadResult ? 'Success' : 'No Data';

        await models.createLog(logPayload);

        return { status: 200, data: fadResult };
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
        const fodResult = await models.fetchOneData(patientResult.patient_id);
        if (!fodResult || fodResult.length === 0) return { status: 404, message: `ไม่มีข้อมูลใน Database กรุณาตรวจสอบ!` };
        const endTime = Date.now() - startTime;

        logPayload.execution_time = endTime;
        logPayload.row_count = fodResult ? 1 : 0;
        logPayload.status = fodResult ? 'Success' : 'No Data';

        await models.createLog(logPayload);

        return { status: 200, data: fodResult };
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
                const existingRecord = await models.fetchPatientInAkatData(key, value);

                if (existingRecord) {
                    duplicateStatus.push(409);
                    duplicateMessages.push(`( ${value} ) มีข้อมูลในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!`);
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
                const createPromissesFICOMRR = setComPayload.map(i =>
                    models.createFormIpdContentOfMedicalRecordResult(i)
                );

                const createFICOMRRResult = await Promise.all(createPromissesFICOMRR);
                if (createFICOMRRResult) {
                    const fetchOf = await models.fetchOverallFindingId();
                    const setOfPayload = fetchOf.map(item => {
                        return {
                            form_ipd_id: cfiResult.form_ipd_id,
                            ...item,
                            ...fullnamePayload
                        };
                    })
                    const createPromissesFIOF = setOfPayload.map(i =>
                        models.createFormIpdOverallFindingResult(i)
                    );
                    await Promise.all(createPromissesFIOF);
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

exports.createData = async (...agrs) => {
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
                const existingRecord = await models.fetchPatientInAkatData(key, value);

                if (existingRecord) {
                    duplicateStatus.push(409);
                    duplicateMessages.push(`( ${value} ) มีข้อมูลในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!`);
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
            // บันทึกข้อมูลไปยังตาราง form_ipds ใน Database akathospital
            const fiPayload = {
                patient_id: Number(cpResult.patient_id),
                ...fullnamePayload
            };

            const cfiResult = await models.createFormIpd(fiPayload);

            if (cfiResult) {
                const { content } = data;

                // ตรวจสอบว่า content_of_medical_record_id ซ้ำกันหรือไม่
                const contentIds = content.map(item => item.content_of_medical_record_id);
                const uniqueContentIds = new Set(contentIds);
                if (uniqueContentIds.size !== contentIds.length) {
                    // ถ้าจำนวน unique IDs ไม่เท่ากับจำนวนทั้งหมด แปลว่ามีซ้ำ
                    await this.cleanupFailInsert(data.patient_an, cfiResult.form_ipd_id);
                    return { status: 400, message: `ไม่สามารถบันทึก content_of_medical_record ซ้ำกันได้ใน 1 Form` };
                }
                // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
                const contentduplicateStatus = [];
                const contentDuplicateMessages = [];

                // เริ่มตรวจสอบ Request ที่ส่งเข้ามา
                for (const [key, value] of Object.entries(contentIds)) {
                    const existingRecord = await models.fetchComrId(value);

                    if (!existingRecord) {
                        contentduplicateStatus.push(404);
                        contentDuplicateMessages.push(`( ${value} ) ไม่มีข้อมูลในระบบ!`);
                        await this.cleanupFailInsert(data.patient_an, cfiResult.form_ipd_id);
                    }
                }

                // ถ้ามีข้อมูลซ้ำหรือค่าที่ว่าง ให้ส่ง response กลับครั้งเดียว
                if (contentDuplicateMessages.length > 0) return { status: Math.max(...contentduplicateStatus), message: contentDuplicateMessages.join(" AND ") }

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
                        form_ipd_id: cfiResult.form_ipd_id,
                        ...item,
                        total_score: totalScore,
                        ...fullnamePayload
                    };
                });

                // Insert ข้อมูลทั้งหมดพร้อมกัน
                const createPromissesFICOMRR = resultFormIpdContentOfMedicalRecord.map(i =>
                    models.createFormIpdContentOfMedicalRecordResult(i)
                );

                await Promise.all(createPromissesFICOMRR);

                if (createPromissesFICOMRR) {
                    const { overall } = data;

                    // ตรวจสอบว่า content_of_medical_record_id ซ้ำกันหรือไม่
                    const overallIds = overall.map(item => item.overall_finding_id);
                    const uniqueOverallIds = new Set(overallIds);
                    if (uniqueOverallIds.size !== overallIds.length) {
                        // ถ้าจำนวน unique IDs ไม่เท่ากับจำนวนทั้งหมด แปลว่ามีซ้ำ
                        await this.cleanupFailInsert(data.patient_an, cfiResult.form_ipd_id);
                        return { status: 400, message: `ไม่สามารถบันทึก overall_finding ซ้ำกันได้ใน 1 Form` };
                    }

                    const resultFormIpdOverallFinding = overall.map(item => {
                        return {
                            form_ipd_id: cfiResult.form_ipd_id,
                            ...item,
                            ...fullnamePayload
                        };
                    });

                    const createPromisesFIOF = resultFormIpdOverallFinding.map(i =>
                        models.createFormIpdOverallFindingResult(i)
                    );

                    await Promise.all(createPromisesFIOF);

                    if (createPromisesFIOF) {
                        const { patient_an, content, overall, ...reviewStatusData } = data;

                        reviewStatusData.form_ipd_id = cfiResult.form_ipd_id;

                        const FIRSRPayload = {
                            ...reviewStatusData,
                            ...fullnamePayload
                        }

                        await models.createFormIpdReviewStatusResult(FIRSRPayload);
                    }
                }
            }
        }

        const endTime = Date.now() - startTime;
        // บันทึก Log
        logPayload.execution_time = endTime;
        logPayload.row_count = cpResult ? 1 : 0;
        logPayload.status = cpResult ? 'Success' : 'No Data';

        await models.createLog(logPayload);

        return { status: 200, message: "บันทึกข้อมูลเรียบร้อย!" };
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

            // // ตรวจสอบว่า content_of_medical_record_id ซ้ำกันหรือไม่
            // const contentIds = content.map(item => item.content_of_medical_record_id);
            // const uniqueContentIds = new Set(contentIds);
            // if (uniqueContentIds.size !== contentIds.length) {
            //     // ถ้าจำนวน unique IDs ไม่เท่ากับจำนวนทั้งหมด แปลว่ามีซ้ำ
            //     await this.cleanupFailInsert(an, formIpdData.form_ipd_id);
            //     return { status: 400, message: `ไม่สามารถบันทึก content_of_medical_record ซ้ำกันได้ใน 1 Form` };
            // }
            // // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
            // const contentduplicateStatus = [];
            // const contentDuplicateMessages = [];

            // // เริ่มตรวจสอบ Request ที่ส่งเข้ามา
            // for (const [key, value] of Object.entries(contentIds)) {
            //     const existingRecord = await models.fetchComrId(value);

            //     if (!existingRecord) {
            //         contentduplicateStatus.push(404);
            //         contentDuplicateMessages.push(`( ${value} ) ไม่มีข้อมูลในระบบ!`);
            //         await this.cleanupFailInsert(an, formIpdData.form_ipd_id);
            //     }
            // }

            // // ถ้ามีข้อมูลซ้ำหรือค่าที่ว่าง ให้ส่ง response กลับครั้งเดียว
            // if (contentDuplicateMessages.length > 0) return { status: Math.max(...contentduplicateStatus), message: contentDuplicateMessages.join(" AND ") }

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
                    ...item,
                    total_score: totalScore,
                    ...fullnamePayload
                };
            });
            console.log(resultFormIpdContentOfMedicalRecord);

            // const updatePromisesFICOMR = resultFormIpdContentOfMedicalRecord.map(i =>
            //     models.updateFormIpdContentOfMedicalRecordResult(i, content.content_of_medical_record_id, formIpdData.form_ipd_id)
            // );

            // await Promise.all(updatePromisesFICOMR);

            // if (updatePromisesFICOMR) {
            //     const { overall } = data;

            //     // ตรวจสอบว่า content_of_medical_record_id ซ้ำกันหรือไม่
            //     const overallIds = overall.map(item => item.overall_finding_id);
            //     const uniqueOverallIds = new Set(overallIds);
            //     if (uniqueOverallIds.size !== overallIds.length) {
            //         // ถ้าจำนวน unique IDs ไม่เท่ากับจำนวนทั้งหมด แปลว่ามีซ้ำ
            //         await this.cleanupFailInsert(an, formIpdData.form_ipd_id);
            //         return { status: 400, message: `ไม่สามารถบันทึก overall_finding ซ้ำกันได้ใน 1 Form` };
            //     }

            //     const resultFormIpdOverallFinding = overall.map(item => {
            //         return {
            //             form_ipd_id: formIpdData.form_ipd_id,
            //             ...item,
            //             ...fullnamePayload
            //         };
            //     });

            //     const createPromisesFIOF = resultFormIpdOverallFinding.map(i =>
            //         models.createFormIpdOverallFindingResult(i)
            //     );

            //     await Promise.all(createPromisesFIOF);

            //     if (createPromisesFIOF) {
            //         const { patient_an, content, overall, ...reviewStatusData } = data;

            //         reviewStatusData.form_ipd_id = formIpdData.form_ipd_id;

            //         const FIRSRPayload = {
            //             ...reviewStatusData,
            //             ...fullnamePayload
            //         }

            //         await models.createFormIpdReviewStatusResult(FIRSRPayload);
            //     }
            // }
        }

        // const endTime = Date.now() - startTime;
        // // บันทึก Log
        // logPayload.execution_time = endTime;
        // logPayload.row_count = cpResult ? 1 : 0;
        // logPayload.status = cpResult ? 'Success' : 'No Data';

        // await models.createLog(logPayload);

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
    if (!faipResult) return msg(res, 404, { message: `ไม่มีข้อมูล ${an} อยู่ในระบบกรุณาตรวจสอบ ${an} เพื่อความถูกต้อง!` });

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