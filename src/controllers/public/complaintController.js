const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');
const { validateEmail, validatePhoneNumber } = require('../../utils/allCheck');
const TelegramBot = require('node-telegram-bot-api');
const token = process.env.TELEGRAM_BOT_TOKEN;
const chatId = '-4756441671';

// สร้างอินสแตนซ์ของบอท
const bot = new TelegramBot(token, { polling: false });

// ฟังก์ชันสำหรับส่งข้อความไป Telegram
async function sendToTelegram(message) {
    try {
      await bot.sendMessage(chatId, message);
      console.log('ส่งข้อความไป Telegram สำเร็จ:', message);
    } catch (error) {
      console.error('เกิดข้อผิดพลาดในการส่งไป Telegram:', error.message);
    }
}

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataComplaints = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.complaints.findMany({
            include: {
                complaint_topics: true
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง complaints_log
        await pm.complaints_log.create({
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
        console.log('getAlldataComplaints : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataComplaint = async (req, res) => {
    try {
        const { fullname, email, telephone_number, complaint_topic_id, detail } = req.body;

        if(!fullname || !email || !telephone_number || !complaint_topic_id || !detail) return msg(res, 400, 'กรุณากรอกข้อมูลให้ครบถ้วน!');

        // Function ในการตรวจสอบรูปแบบของ E-mail
        const checkEmail = await validateEmail(email);
        if(!checkEmail) return msg(res, 400, { message: 'รูปแบบ Email ไม่ถูกต้องกรุณาตรวจสอบ!' });

        // Function ในการตรวจสอบรูปแบบของเบอร์โทรศัพท์
        const checkTelephoneNumber = await validatePhoneNumber(telephone_number);
        if(!checkTelephoneNumber) return msg(res, 400, { message: 'รูปแบบเบอร์โทรศัพท์ไม่ถูกต้องกรุณาตรวจสอบ!' });
        
        const startTime = Date.now();
        const insertData = await pm.complaints.create({
            data: {
                fullname: fullname,
                email: email,
                telephone_number: telephone_number,
                complaint_topic_id: complaint_topic_id,
                detail: detail,
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง complaints_log
        await pm.complaints_log.create({
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
        
        if(insertData) {
            const fetchOneResult = await pm.complaints.findFirst({
                where: {
                    complaint_id: Number(insertData.complaint_id)
                },
                include: {
                    complaint_topics: true
                }
            });
            
            const message = `
                📢 *ระบบรายงานการร้องเรียน* 📢 \n👤 *ผู้ร้องเรียน*👤: \n        ${fullname} \n📧 *E-mail ผู้ร้องเรียน*📧: \n          ${email} \n📞 *เบอร์โทรศัพท์ผู้ร้องเรียน*📞: \n          ${telephone_number} \n📋 *หัวข้อที่ร้องเรียน*📋: \n         ${fetchOneResult.complaint_topics.complaint_topic_name} \n💬 *รายละเอียดการร้องเรียน*💬: \n       ${detail.split('\n').map(line => `   ${line}`).join('\n')}
            `;

            // ส่งข้อความไป Telegram
            await sendToTelegram(message);
            return msg(res, 200, { message: 'Insert data successfully!' });
        }
    } catch(err) {
        console.log('insertdataComplaints : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Delete ข้อมูลออกจาก Database
exports.removeDataComplaint = async (req, res) => {
    try {
        const { id } = req.params;

        // Check ID ว่ามีอยู่จริงในระบบหรือไม่
        const checkIdComplaint = await pm.complaints.findFirst({
            where: {
                complaint_id: Number(id)
            }
        });
        if (!checkIdComplaint) return msg(res, 404, { message: 'ไม่มี complaint_id อยู่ในระบบ!' });

        const startTime = Date.now();
        // ลบข้อมูล
        const removeData = await pm.complaints.delete({
            where: {
                complaint_id: Number(id)
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง complaints_log
        await pm.complaints_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: req.user.fullname_thai,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: removeData ? 1 : 0,
                status: removeData ? 'Success' : 'Failed'
            }
        });

        // ดึงค่า MAX(complaint_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(complaint_id), 0) + 1 AS nextId FROM complaints`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE complaints AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });
    } catch(err) {
        console.log('removeDataComplaints : ', err);
        return msg(res, 500, { message: err.message });
    }
}