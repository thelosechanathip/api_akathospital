const pm = require('../../config/prisma')
const { msg } = require('../../utils/message');
const db_b = require('../../config/db_b');
const moment = require('moment')

exports.AddTraining = async (req, res) => {
    try {
        const { national_id } = req.body

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
        return msg(res, 200, { training_name: fetchFullnameByNationalId[0].fullname })
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