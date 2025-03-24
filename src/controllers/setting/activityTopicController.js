const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataActivityTopics = async (req, res) => {
    try {
        const resultData = await pm.activity_topics.findMany();

        if(resultData.length === 0) return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });

        return msg(res, 200, { data: resultData });
    } catch(err) {
        console.log('getAllDataActivityTopics : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataActivityTopic = async (req, res) => {
    try {
        const { 
            activity_topic_name, 
            activity_topic_date_time_start, 
            activity_topic_date_time_end,
            activity_topic_detail
        } = req.body;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบข้อมูลที่จำเป็น
        if (
            !activity_topic_name || 
            !activity_topic_date_time_start || 
            !activity_topic_date_time_end
        ) return msg(res, 400, 'กรุณากรอกข้อมูลให้ครบถ้วน!');

        // แปลงวันที่และเวลาให้เป็น ISO-8601
        const startDateTime = new Date(activity_topic_date_time_start);
        const endDateTime = new Date(activity_topic_date_time_end);

        // ตรวจสอบว่ารูปแบบวันที่ถูกต้องหรือไม่
        if (isNaN(startDateTime.getTime()) || isNaN(endDateTime.getTime())) {
            return msg(res, 400, 'รูปแบบวันที่ไม่ถูกต้อง กรุณาใช้รูปแบบ YYYY-MM-DD HH:mm:ss หรือ ISO-8601');
        }

        await pm.activity_topics.create({
            data: {
                activity_topic_name: activity_topic_name,
                activity_topic_date_time_start: startDateTime, // ส่ง Date object
                activity_topic_date_time_end: endDateTime,     // ส่ง Date object
                activity_topic_detail: activity_topic_detail,
                created_by: fullname,
                updated_by: fullname
            }
        });

        return msg(res, 200, { message: 'Insert data successfully!' });
    } catch (err) {
        console.log('insertDataActivityTopic : ', err);
        return msg(res, 500, { message: err.message });
    }
};