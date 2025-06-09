const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');
const db_b = require('../../config/db_b');
const moment = require('moment')
const fs = require('fs');
const path = require('path');
const { validateThaiID } = require('../../utils/allCheck');
const fetch = require('node-fetch');
const { off } = require('process');

function getPersistentSequentialNumbers(count, max) {
    const fileName = 'temp-data.json';
    const filePath = path.join(__dirname, fileName);
    const currentDate = moment().format('YYYY-MM-DD');
    // const currentDate = '2025-06-10';
    let payload;

    // --- ส่วนที่แก้ไข ---
    try {
        // 1. พยายามอ่านและแปลงไฟล์ JSON
        const dataFromFile = fs.readFileSync(filePath, 'utf-8');
        const parsedData = JSON.parse(dataFromFile);

        // 2. ตรวจสอบวันที่จากข้อมูลในไฟล์
        if (parsedData.dataNow === currentDate) {
            // ถ้าเป็นวันเดียวกัน ให้ใช้ข้อมูลเดิม
            payload = parsedData;
        } else {
            // ถ้าเป็นวันใหม่ ให้รีเซ็ต payload
            payload = { dataNow: currentDate, numbers: [] };
        }
    } catch (err) {
        // 3. หากเกิด Error (เช่น ไฟล์ยังไม่มี, ไฟล์ว่าง) ให้สร้าง payload ใหม่
        payload = { dataNow: currentDate, numbers: [] };
    }
    // --- สิ้นสุดส่วนที่แก้ไข ---

    try {
        if (payload.numbers.length >= max) {
            return { success: false, message: 'หมายเลขถูกใช้งานครบแล้ว', numbers: [] };
        }

        // สร้างหมายเลขใหม่ (ส่วนนี้ถูกต้องอยู่แล้ว)
        const result = [];
        const startNumber = payload.numbers.length + 1;
        for (let i = 0; i < count; i++) {
            const nextNumber = startNumber + i;
            if (nextNumber > max) break;
            result.push(nextNumber);
        }

        // Update Payload และบันทึกไฟล์
        if (result.length > 0) {
            payload.numbers.push(...result);
            // บันทึก payload ที่อัปเดตแล้วลงไฟล์
            fs.writeFileSync(filePath, JSON.stringify(payload, null, 2));
        }

        // ต้อง return ค่าที่ถูกต้องหลังการทำงาน
        return { success: true, message: 'สร้างหมายเลขสำเร็จ', numbers: result };

    } catch (err) {
        // เปลี่ยนการโยน Error ให้คืนค่าเป็น object ที่มีความหมายแทน
        return { success: false, message: err.message, numbers: [] };
    }
}

exports.clearRandomStateJson = (req, res) => {
    const filePath = path.join(__dirname, 'randomState.json');
    state = {}
    fs.writeFileSync(filePath, JSON.stringify(state))
    return msg(res, 200, { message: 'ลบค่าในไฟล์ randomState.json สําเร็จ' })
}

exports.fetchAllDataSum = async (req, res) => {
    try {
        const dateNow = moment().startOf('day'); // เริ่มต้นของวัน (เวลา 00:00:00)
        const dateTomorrow = moment(dateNow).add(1, 'day'); // วันถัดไป (สำหรับเงื่อนไขน้อยกว่า)

        const result = await pm.training.count({
            where: {
                created_at: {
                    gte: dateNow.toISOString(), // มากกว่าหรือเท่ากับวันนี้เวลา 00:00:00
                    lt: dateTomorrow.toISOString() // น้อยกว่าวันพรุ่งนี้เวลา 00:00:00
                }
            }
        });

        return msg(res, 200, { sumResult: result });
    } catch (err) {
        console.error("Internal error: ", err.message);
        return msg(res, 500, { message: "Internal server error" });
    }
}

exports.addTraining = async (req, res) => {
    try {
        const { national_id } = req.body

        if (!validateThaiID(national_id)) return msg(res, 400, { message: 'เลขบัตรประชาชนไม่ถูกต้อง' })

        const [fetchFullnameByNationalId] = await db_b.query(
            `
                SELECT 
                    u.name AS fullname
                FROM users AS u
                INNER JOIN hrd_person AS hp ON u.PERSON_ID = hp.id
                INNER JOIN hrd_prefix AS hpr ON hp.HR_PREFIX_ID = hpr.HR_PREFIX_ID
                INNER JOIN hrd_position AS hpo ON hp.HR_POSITION_ID = hpo.HR_POSITION_ID
                INNER JOIN hrd_department AS hd ON hp.HR_DEPARTMENT_ID = hd.HR_DEPARTMENT_ID
                INNER JOIN hrd_department_sub AS hds ON hp.HR_DEPARTMENT_SUB_ID = hds.HR_DEPARTMENT_SUB_ID
                INNER JOIN hrd_department_sub_sub AS hdss ON hds.HR_DEPARTMENT_SUB_ID = hdss.HR_DEPARTMENT_SUB_ID
                WHERE hp.HR_CID = ?
                LIMIT 1
            `,
            [national_id]
        )

        const checkUserInTrainingByNationalId = await pm.training.findFirst({
            where: { training_name: fetchFullnameByNationalId[0].fullname }
        })
        if (checkUserInTrainingByNationalId) {
            return msg(res, 200, {
                training_name: checkUserInTrainingByNationalId.training_name,
                number: checkUserInTrainingByNationalId.training_number
            })
        }

        const fetchEnrollee = await pm.enrollee.findFirst({ where: { fullname: fetchFullnameByNationalId[0].fullname } })

        let training_break = true
        if (!fetchEnrollee) training_break = false

        payload = { training_name: fetchFullnameByNationalId[0].fullname, training_break }

        const result = getPersistentSequentialNumbers(1, 80)

        await pm.training.create({ data: { ...payload, training_number: result.numbers[0] } })

        return msg(res, 200, { training_name: fetchFullnameByNationalId[0].fullname, number: result.numbers[0] })
    } catch (err) {
        console.error("Internal error: ", err.message)
    }
}

exports.updateTraining = async (req, res) => {
    try {
        const { training_name } = req.body

        const checkTraining = await pm.training.findFirst({
            where: { training_name }
        })
        if (!checkTraining) return msg(res, 404, { message: "คุณยังไม่ได้ลงทะเบียนเข้าอบรม" })

        if (checkTraining.training_break === false)
            return msg(res, 400, { message: "คุณไม่ได้ลงทะเบียนเข้าอบรมล่วงหน้า จึงไม่สามารถรับ Break ได้!" })

        const timeNow = moment().format('HH:mm:ss')
        // const timeNow = '13:30:00'
        let messageBreak

        if (timeNow >= '08:30:00' && timeNow <= '12:00:00') {
            if (checkTraining.training_morning === true)
                return msg(res, 400, { message: "คุณได้รับ Break ภาคเช้าแล้วไม่สามารถรับซ้ำได้!" })

            await pm.training.update({
                where: { training_name },
                data: { training_morning: true }
            })
            messageBreak = "ลงทะเบียนรับ Break ภาคเช้าเสร็จสิ้น"
        } else if (timeNow >= '12:00:00' && timeNow <= '13:00:00') {
            if (checkTraining.training_noon === true)
                return msg(res, 400, { message: "คุณได้รับอาหารเที่ยงแล้วไม่สามารถรับซ้ำได้!" })

            await pm.training.update({
                where: { training_name },
                data: { training_noon: true }
            })
            messageBreak = "ลงทะเบียนรับอาหารเที่ยงเสร็จสิ้น"
        } else if (timeNow >= '13:30:00' && timeNow <= '16:30:00') {
            if (checkTraining.training_afternoon === true)
                return msg(res, 400, { message: "คุณได้รับ Break ภาคบ่ายแล้วไม่สามารถรับซ้ำได้!" })

            await pm.training.update({
                where: { training_name },
                data: { training_afternoon: true }
            })
            messageBreak = "ลงทะเบียนรับ Break ภาคบ่ายเสร็จสิ้น"
        }

        return msg(res, 200, { message: messageBreak })
    } catch (err) {
        console.error("Internal error: ", err.message)
    }
}