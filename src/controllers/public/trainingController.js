const pm = require('../../config/prisma')
const { msg } = require('../../utils/message');
const db_b = require('../../config/db_b');
const moment = require('moment')
const fs = require('fs');
const path = require('path');
const { validateThaiID } = require('../../utils/allCheck');

function getPersistentUniqueRandomNumbers(count, max) {
    const filePath = path.join(__dirname, 'randomState.json');
    let state = { lastRun: moment().format('YYYY-MM-DD'), usedNumbers: [] };

    try {
        const fileContent = fs.readFileSync(filePath, 'utf8');
        if (fileContent) {
            state = JSON.parse(fileContent);
        }
    } catch (e) {
        // ไฟล์ยังไม่มีหรืออ่านไม่ได้
    }

    // ตรวจสอบว่าวันที่เปลี่ยนไปหรือไม่
    const currentDate = moment().format('YYYY-MM-DD'); // หรือใช้ moment().format('YYYY-MM-DD') สำหรับวันที่จริง
    if (state.lastRun !== currentDate) {
        // ล้างข้อมูลทั้งหมด
        state = { lastRun: currentDate, usedNumbers: [] };
    }

    // ตรวจสอบว่าสุ่มเลขครบ max แล้วหรือยัง
    if (state.usedNumbers.length >= max) {
        return { success: false, message: 'จำนวนที่นั่งเต็มแล้ว', numbers: [] };
    }

    const usedNumbers = new Set(state.usedNumbers);
    const result = [];

    while (result.length < count && usedNumbers.size < max) {
        const num = Math.floor(Math.random() * max) + 1;
        if (!usedNumbers.has(num)) {
            usedNumbers.add(num);
            result.push(num);
        }
    }

    state.usedNumbers = [...usedNumbers];
    fs.writeFileSync(filePath, JSON.stringify(state));

    return {
        success: true,
        message: usedNumbers.size >= max ? 'จำนวนที่นั่งใกล้เต็มแล้ว' : 'สำเร็จ',
        numbers: result
    };
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

        if (!validateThaiID(national_id))
            return msg(res, 400, { message: 'เลขบัตรประชาชนไม่ถูกต้อง' })

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
        if (checkUserInTrainingByNationalId)
            return msg(res, 409, { message: 'มีการลงทะเบียนเข้าอบรมแล้วไม่สามารถลงทะเบียนซ้ำได้ ขอบคุณครับ/คะ!' })

        const fetchEnrollee = await pm.enrollee.findFirst({
            where: { fullname: fetchFullnameByNationalId[0].fullname }
        })

        let training_break = true
        if (!fetchEnrollee) training_break = false

        payload = {
            training_name: fetchFullnameByNationalId[0].fullname,
            training_break
        }

        await pm.training.create({ data: payload })

        const result = getPersistentUniqueRandomNumbers(1, 80)

        return msg(res, 200, { training_name: fetchFullnameByNationalId[0].fullname, result: result })
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