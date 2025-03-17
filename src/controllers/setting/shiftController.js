const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataShifts = async (req, res) => {
    try {
        const resultData = await pm.shifts.findMany();

        if(resultData.length === 0) return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });

        return msg(res, 200, { data: resultData });
    } catch(err) {
        console.log('getAllDataShifts : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataShift = async (req, res) => {
    try {
        const { shift_name, shift_starting, shift_ending } = req.body;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่ากรอกข้อมูลครบถ้วนหรือไม่
        if (!shift_name || !shift_starting || !shift_ending)  return msg(res, 400, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน!' });

        // ตรวจสอบรูปแบบเวลา (HH:mm:ss) สำหรับ shift_starting และ shift_ending
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;
        
        if (!timeRegex.test(shift_starting)) return msg(res, 400, { message: 'รูปแบบเวลาเริ่มต้น (shift_starting) ไม่ถูกต้อง! กรุณาใช้รูปแบบ HH:mm:ss!' });
        if (!timeRegex.test(shift_ending)) return msg(res, 400, { message: 'รูปแบบเวลาสิ้นสุด (shift_ending) ไม่ถูกต้อง! กรุณาใช้รูปแบบ HH:mm:ss!' });

        // ตรวจสอบเพิ่มเติมว่าเวลาเป็นไปได้จริงหรือไม่
        const [startHours, startMinutes, startSeconds] = shift_starting.split(':').map(Number);
        const [endHours, endMinutes, endSeconds] = shift_ending.split(':').map(Number);

        if (
            startHours < 0 || startHours > 23 ||
            startMinutes < 0 || startMinutes > 59 ||
            startSeconds < 0 || startSeconds > 59
        ) return msg(res, 400, { message: 'ค่าเวลาเริ่มต้น (shift_starting) ต้องอยู่ในช่วงที่ถูกต้อง (HH: 00-23, mm: 00-59, ss: 00-59)!' });

        if (
            endHours < 0 || endHours > 23 ||
            endMinutes < 0 || endMinutes > 59 ||
            endSeconds < 0 || endSeconds > 59
        ) return msg(res, 400, { message: 'ค่าเวลาสิ้นสุด (shift_ending) ต้องอยู่ในช่วงที่ถูกต้อง (HH: 00-23, mm: 00-59, ss: 00-59)!' });

        // Check shift_name ว่ามีซ้ำอยู่ใน Database หรือไม่
        const checkShiftNameResult = await pm.shifts.findFirst({
            where: {
                shift_name: shift_name
            }
        });
        if (checkShiftNameResult) return msg(res, 409, { message: 'มี (shift_name) อยู่ในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!' });

        // บันทึกข้อมูล
        await pm.shifts.create({
            data: {
                shift_name: shift_name,
                shift_starting: shift_starting,
                shift_ending: shift_ending,
                created_by: fullname,
                updated_by: fullname
            }
        });

        return msg(res, 200, { message: 'Insert data successfully!' });
    } catch (err) {
        console.error('insertDataShift Error: ', err);
        return msg(res, 500, { message: 'เกิดข้อผิดพลาดในการบันทึกข้อมูล', error: err.message });
    }
};

// Function สำหรับ Update ข้อมูลไปยัง Database
exports.updateDataShift = async (req, res) => {
    try {
        const { id } = req.params;

        // Check id ที่ส่งมาว่ามีข้อมูลใน shifts หรือไม่?
        const checkIdShift = await pm.shifts.findFirst({
            where: {
                shift_id: Number(id)
            }
        });
        if(!checkIdShift) return msg(res, 404, { message: 'ไม่มี shift_id อยู่ในระบบ!' });

        const { shift_name, shift_starting, shift_ending } = req.body;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่ากรอกข้อมูลครบถ้วนหรือไม่
        if (!shift_name || !shift_starting || !shift_ending)  return msg(res, 400, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน!' });

        // ตรวจสอบรูปแบบเวลา (HH:mm:ss) สำหรับ shift_starting และ shift_ending
        const timeRegex = /^([0-1]?[0-9]|2[0-3]):([0-5][0-9]):([0-5][0-9])$/;
        
        if (!timeRegex.test(shift_starting)) return msg(res, 400, { message: 'รูปแบบเวลาเริ่มต้น (shift_starting) ไม่ถูกต้อง! กรุณาใช้รูปแบบ HH:mm:ss!' });
        if (!timeRegex.test(shift_ending)) return msg(res, 400, { message: 'รูปแบบเวลาสิ้นสุด (shift_ending) ไม่ถูกต้อง! กรุณาใช้รูปแบบ HH:mm:ss!' });

        // ตรวจสอบเพิ่มเติมว่าเวลาเป็นไปได้จริงหรือไม่
        const [startHours, startMinutes, startSeconds] = shift_starting.split(':').map(Number);
        const [endHours, endMinutes, endSeconds] = shift_ending.split(':').map(Number);

        if (
            startHours < 0 || startHours > 23 ||
            startMinutes < 0 || startMinutes > 59 ||
            startSeconds < 0 || startSeconds > 59
        ) return msg(res, 400, { message: 'ค่าเวลาเริ่มต้น (shift_starting) ต้องอยู่ในช่วงที่ถูกต้อง (HH: 00-23, mm: 00-59, ss: 00-59)!' });

        if (
            endHours < 0 || endHours > 23 ||
            endMinutes < 0 || endMinutes > 59 ||
            endSeconds < 0 || endSeconds > 59
        ) return msg(res, 400, { message: 'ค่าเวลาสิ้นสุด (shift_ending) ต้องอยู่ในช่วงที่ถูกต้อง (HH: 00-23, mm: 00-59, ss: 00-59)!' });

        // Check shift_name ว่ามีซ้ำอยู่ใน Database หรือไม่
        const checkShiftNameResult = await pm.shifts.findFirst({
            where: {
                shift_name: shift_name
            }
        });
        if (checkShiftNameResult) return msg(res, 409, { message: 'มี (shift_name) อยู่ในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!' });

        await pm.shifts.update({
            where: {
                shift_id: Number(id)
            },
            data: {
                shift_name: shift_name,
                shift_starting: shift_starting,
                shift_ending: shift_ending,
                updated_by: fullname
            }
        });

        return msg(res, 200, { message: 'Updated successfully!' });
    } catch(err) {
        console.log('updateDataShift : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataShift = async (req, res) => {
    try {
        const { id } = req.params;

        // ตรวจสอบว่า ID มีอยู่จริงหรือไม่
        const checkIdShift = await pm.shifts.findFirst({
            where: {
                shift_id: Number(id)
            }
        });
        if (!checkIdShift) return msg(res, 404, { message: 'ไม่มี shift_id อยู่ในระบบ!' });

        // ลบข้อมูล
        await pm.shifts.delete({
            where: {
                shift_id: Number(id)
            }
        });

        // ดึงค่า MAX(shift_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(shift_id), 0) + 1 AS nextId FROM shifts`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE shifts AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataShift : ', err);
        return msg(res, 500, { message: err.message });
    }
};