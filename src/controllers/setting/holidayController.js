const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataHolidays = async (req, res) => {
    try {
        const resultData = await pm.holidays.findMany();

        if(resultData.length === 0) return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });

        return msg(res, 200, { data: resultData });
    } catch(err) {
        console.log('getAllDataHolidays : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataHoliday = async (req, res) => {
    try {
        const { holiday_name, holiday_date } = req.body;
        const fullname = req.user.fullname_thai;

        if(!holiday_name || !holiday_date) return msg(res, 400, 'กรุณากรอกข้อมูลให้ครบถ้วน!');

        // ตรวจสอบรูปแบบวันที่ (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(holiday_date)) return msg(res, 400, 'รูปแบบวันที่ไม่ถูกต้อง! กรุณาใช้รูปแบบ YYYY-MM-DD!');

        // ตรวจสอบว่าเป็นวันที่ที่ถูกต้องหรือไม่ (เช่น 2025-02-30 ไม่ถูกต้อง)
        const date = new Date(holiday_date);
        if (isNaN(date.getTime()) || date.toISOString().split('T')[0] !== holiday_date) return msg(res, 400, 'วันที่ไม่ถูกต้อง! กรุณาตรวจสอบวันที่!');

        // Check holiday_name ว่ามีซ้ำอยู่ใน Database หรือไม่?
        const checkHolidayNameResult = await pm.holidays.findFirst({
            where: {
                holiday_name: holiday_name
            }
        });
        if(checkHolidayNameResult) return msg(res, 409, 'มี (holiday_name) อยู่ในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!');

        await pm.holidays.create({
            data: {
                holiday_name: holiday_name,
                holiday_date: holiday_date,
                created_by: fullname,
                updated_by: fullname
            }
        });

        return msg(res, 200, { message: 'Insert data successfully!' });
    } catch(err) {
        console.log('insertDataHoliday : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Update ข้อมูลไปยัง Database
exports.updateDataHoliday = async (req, res) => {
    try {
        const { id } = req.params;

        // Check id ที่ส่งมาว่ามีข้อมูลใน holidays หรือไม่?
        const checkIdHoliday = await pm.holidays.findFirst({
            where: {
                holiday_id: Number(id)
            }
        });
        if(!checkIdHoliday) return msg(res, 404, { message: 'ไม่มี holiday_id อยู่ในระบบ!' });

        const { holiday_name, holiday_date } = req.body;
        const fullname = req.user.fullname_thai;

        if(!holiday_name || !holiday_date) return msg(res, 400, 'กรุณากรอกข้อมูลให้ครบถ้วน!');

        // ตรวจสอบรูปแบบวันที่ (YYYY-MM-DD)
        const dateRegex = /^\d{4}-\d{2}-\d{2}$/;
        if (!dateRegex.test(holiday_date)) return msg(res, 400, 'รูปแบบวันที่ไม่ถูกต้อง! กรุณาใช้รูปแบบ YYYY-MM-DD!');

        // ตรวจสอบว่าเป็นวันที่ที่ถูกต้องหรือไม่ (เช่น 2025-02-30 ไม่ถูกต้อง)
        const date = new Date(holiday_date);
        if (isNaN(date.getTime()) || date.toISOString().split('T')[0] !== holiday_date) return msg(res, 400, 'วันที่ไม่ถูกต้อง! กรุณาตรวจสอบวันที่!');

        // Check holiday_name ว่ามีซ้ำอยู่ใน Database หรือไม่?
        const checkHolidayNameResult = await pm.holidays.findFirst({
            where: {
                holiday_name: holiday_name
            }
        });
        if(checkHolidayNameResult) return msg(res, 409, 'มี (holiday_name) อยู่ในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!');

        await pm.holidays.update({
            where: {
                holiday_id: Number(id)
            },
            data: {
                holiday_name: holiday_name,
                holiday_date: holiday_date,
                updated_by: fullname
            }
        });

        return msg(res, 200, { message: 'Updated successfully!' });
    } catch(err) {
        console.log('updateDataHoliday : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataHoliday = async (req, res) => {
    try {
        const { id } = req.params;

        // ตรวจสอบว่า ID มีอยู่จริงหรือไม่
        const checkIdHoliday = await pm.holidays.findFirst({
            where: {
                holiday_id: Number(id)
            }
        });
        if (!checkIdHoliday) return msg(res, 404, { message: 'ไม่มี holiday_id อยู่ในระบบ!' });

        // ลบข้อมูล
        await pm.holidays.delete({
            where: {
                holiday_id: Number(id)
            }
        });

        // ดึงค่า MAX(holiday_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(holiday_id), 0) + 1 AS nextId FROM holidays`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE holidays AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataHoliday : ', err);
        return msg(res, 500, { message: err.message });
    }
};