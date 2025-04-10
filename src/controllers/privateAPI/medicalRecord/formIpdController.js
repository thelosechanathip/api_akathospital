const pm = require('../../../config/prisma');
const { msg } = require('../../../utils/message');
const db_h = require('../../../config/db_h');

// Function ในการบันทึกหรืออัพเดทข้อมูล Medical Record Audit ไปยัง Database
exports.upsertFormIpd = async (req, res) => {
    try {
        const userFullname = {
            created_by: req.user.fullname_thai,
            updated_by: req.user.fullname_thai
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
        if(insertPatient) {
            // บันทึกข้อมูลไปยังตาราง form_ipds ใน Database akathospital
            const insertFormIpd = await pm.form_ipds.create({
                data: {
                    patient_id: Number(insertPatient.patient_id),
                    ...userFullname
                }
            });
            if(insertFormIpd) {
                const { patient_an, content } = formIpdData;

                // คีย์ที่ไม่ต้องการให้รวมในการคำนวณ (ยกเว้น point_deducted ที่จะลบทีหลัง)
                const excludedKeys = [
                    "content_of_medical_record_id",
                    "comment",
                    "total_score", // ถ้ามีอยู่ในข้อมูลเดิม จะไม่รวม
                    "point_deducted" // จะแยกไปลบทีหลัง
                ];

                const result = content.map(item => {
                    // ดึงทุก key จาก item และกรองเอาเฉพาะที่ไม่ใช่ excludedKeys
                    const itemSum = Object.keys(item)
                        .filter(key => !excludedKeys.includes(key))
                        .reduce((acc, key) => acc + (Number(item[key]) || 0), 0);
                    
                    // ลบด้วย point_deducted (ถ้ามีค่า ถ้าไม่มีให้เป็น 0)
                    const totalScore = itemSum - (Number(item.point_deducted) || 0);
                    
                    // คืนค่า item พร้อม totalScore
                    return {
                        ...item,
                        total_score: totalScore
                    };
                });

                return msg(res, 200, { data: result });
                
            }
        }

        return msg(res, 200, { message: 'Upsert successfully!' });
    } catch(err) {
        console.error("upsertFormIpd error:", err.message);
        return msg(res, 500, `Internal server`);
    }
};
