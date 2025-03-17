const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataCheckOutStatus = async (req, res) => {
    try {
        const resultData = await pm.check_out_status.findMany();

        if(resultData.length === 0) return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });

        return msg(res, 200, { data: resultData });
    } catch(err) {
        console.log('getAllDataCheckOutStatus : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataCheckOutStatus = async (req, res) => {
    try {
        const { check_out_status_name } = req.body;
        const fullname = req.user.fullname_thai;

        if(!check_out_status_name) return msg(res, 400, 'กรุณากรอกข้อมูลให้ครบถ้วน!');

        // Check check_out_status_name ว่ามีซ้ำอยู่ใน Database หรือไม่?
        const checkCheckOutStatusNameResult = await pm.check_out_status.findFirst({
            where: {
                check_out_status_name: check_out_status_name
            }
        });
        if(checkCheckOutStatusNameResult) return msg(res, 409, 'มี (check_out_status_name) อยู่ในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!');

        await pm.check_out_status.create({
            data: {
                check_out_status_name: check_out_status_name,
                created_by: fullname,
                updated_by: fullname
            }
        });

        return msg(res, 200, { message: 'Insert data successfully!' });
    } catch(err) {
        console.log('insertDataCheckOutStatus : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Update ข้อมูลไปยัง Database
exports.updateDataCheckOutStatus = async (req, res) => {
    try {
        const { id } = req.params;

        // Check id ที่ส่งมาว่ามีข้อมูลใน check_out_status หรือไม่?
        const checkIdCheckOutStatus = await pm.check_out_status.findFirst({
            where: {
                check_out_status_id: Number(id)
            }
        });
        if(!checkIdCheckOutStatus) return msg(res, 404, { message: 'ไม่มี check_out_status_id อยู่ในระบบ!' });

        const { check_out_status_name } = req.body;
        const fullname = req.user.fullname_thai;

        if(!check_out_status_name) return msg(res, 400, 'กรุณากรอกข้อมูลให้ครบถ้วน!');

        // Check check_out_status_name ว่ามีซ้ำอยู่ใน Database หรือไม่?
        const checkCheckOutStatusNameResult = await pm.check_out_status.findFirst({
            where: {
                check_out_status_name: check_out_status_name
            }
        });
        if(checkCheckOutStatusNameResult) return msg(res, 409, 'มี (check_out_status_name) อยู่ในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!');

        await pm.check_out_status.update({
            where: {
                check_out_status_id: Number(id)
            },
            data: {
                check_out_status_name: check_out_status_name,
                updated_by: fullname
            }
        });

        return msg(res, 200, { message: 'Updated successfully!' });
    } catch(err) {
        console.log('updateDataCheckOutStatus : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataCheckOutStatus = async (req, res) => {
    try {
        const { id } = req.params;

        // ตรวจสอบว่า ID มีอยู่จริงหรือไม่
        const checkIdCheckOutStatus = await pm.check_out_status.findFirst({
            where: {
                check_out_status_id: Number(id)
            }
        });
        if (!checkIdCheckOutStatus) return msg(res, 404, { message: 'ไม่มี check_out_status_id อยู่ในระบบ!' });

        // ลบข้อมูล
        await pm.check_out_status.delete({
            where: {
                check_out_status_id: Number(id)
            }
        });

        // ดึงค่า MAX(check_out_status_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(check_out_status_id), 0) + 1 AS nextId FROM check_out_status`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE check_out_status AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataCheckOutStatus : ', err);
        return msg(res, 500, { message: err.message });
    }
};