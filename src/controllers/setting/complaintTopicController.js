const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataComplaintTopics = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.complaint_topics.findMany();
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง complaint_topics_log
        await pm.complaint_topics_log.create({
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
        console.log('getAllDataComplaintTopics : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataComplaintTopic = async (req, res) => {
    try {
        const { complaint_topic_name } = req.body;
        const fullname = req.user.fullname_thai;

        if(!complaint_topic_name) return msg(res, 400, 'กรุณากรอกข้อมูลให้ครบถ้วน!');

        // Check complaint_topic_name ว่ามีซ้ำอยู่ใน Database หรือไม่?
        const checkComplaintTopicNameResult = await pm.complaint_topics.findFirst({
            where: {
                complaint_topic_name: complaint_topic_name
            }
        });
        if(checkComplaintTopicNameResult) return msg(res, 404, 'มี (complaint_topic_name) อยู่ในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!');

        const startTime = Date.now();
        const insertData = await pm.complaint_topics.create({
            data: {
                complaint_topic_name: complaint_topic_name,
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง complaint_topics_log
        await pm.complaint_topics_log.create({
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

        return msg(res, 200, { message: 'Insert data successfully!' });
    } catch(err) {
        console.log('insertDataComplaintTopic : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Update ข้อมูลไปยัง Database
exports.updateDataComplaintTopic = async (req, res) => {
    try {
        const { id } = req.params;

        // Check id ที่ส่งมาว่ามีข้อมูลใน complaint_topics หรือไม่?
        const checkIdComplaintTopic = await pm.complaint_topics.findFirst({
            where: {
                complaint_topic_id: Number(id)
            }
        });
        if(!checkIdComplaintTopic) return msg(res, 400, { message: 'ไม่มี complaint_topic_id อยู่ในระบบ!' });

        const { complaint_topic_name } = req.body;
        const fullname = req.user.fullname_thai;

        // Check complaint_topic_name ว่ามีซ้ำอยู่ใน Database หรือไม่?
        const checkComplaintTopicNameResult = await pm.complaint_topics.findFirst({
            where: {
                complaint_topic_name: complaint_topic_name
            }
        });
        if(checkComplaintTopicNameResult) return msg(res, 404, 'มี (complaint_topic_name) อยู่ในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!');

        const startTime = Date.now();
        const updateData = await pm.complaint_topics.update({
            where: {
                complaint_topic_id: Number(id)
            },
            data: {
                complaint_topic_name: complaint_topic_name,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง complaint_topics_log
        await pm.complaint_topics_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: updateData ? 1 : 0,
                status: updateData ? 'Success' : 'Failed'
            }
        });

        return msg(res, 200, { message: 'Updated successfully!' });
    } catch(err) {
        console.log('updateDataComplaintTopic : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataComplaintTopic = async (req, res) => {
    try {
        const { id } = req.params;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่า ID มีอยู่จริงหรือไม่
        const checkIdComplaintTopic = await pm.complaint_topics.findFirst({
            where: {
                complaint_topic_id: Number(id)
            }
        });
        if (!checkIdComplaintTopic) return msg(res, 404, { message: 'ไม่มี complaint_topic_id อยู่ในระบบ!' });

        const checkFkComplaint = await pm.complaints.findFirst({
            where: {
                complaint_topic_id: Number(id)
            }
        });
        if (checkFkComplaint) return msg(res, 400, { message: 'ไม่สามารถลบข้อมูลหัวข้อร้องเรียนได้ เนื่องจากมีการเรียกใช้งานหัวข้อร้องเรียนแล้ว!' });

        // ลบข้อมูล
        const startTime = Date.now();
        const removeData = await pm.complaint_topics.delete({
            where: {
                complaint_topic_id: Number(id)
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง complaint_topics_log
        await pm.complaint_topics_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: removeData ? 1 : 0,
                status: removeData ? 'Success' : 'Failed'
            }
        });

        // ดึงค่า MAX(complaint_topic_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(complaint_topic_id), 0) + 1 AS nextId FROM complaint_topics`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE complaint_topics AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataComplaintTopic : ', err);
        return msg(res, 500, { message: err.message });
    }
};
