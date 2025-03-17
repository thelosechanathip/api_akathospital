const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataShiftTypes = async (req, res) => {
    try {
        const resultData = await pm.shift_types.findMany();

        if(resultData.length === 0) return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });

        return msg(res, 200, { data: resultData });
    } catch(err) {
        console.log('getAllDataShiftTypes : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataShiftType = async (req, res) => {
    try {
        const { shift_type_name } = req.body;
        const fullname = req.user.fullname_thai;

        if(!shift_type_name) return msg(res, 400, 'กรุณากรอกข้อมูลให้ครบถ้วน!');

        // Check shift_type_name ว่ามีซ้ำอยู่ใน Database หรือไม่?
        const checkHolidayNameResult = await pm.shift_types.findFirst({
            where: {
                shift_type_name: shift_type_name
            }
        });
        if(checkHolidayNameResult) return msg(res, 409, 'มี (shift_type_name) อยู่ในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!');

        await pm.shift_types.create({
            data: {
                shift_type_name: shift_type_name,
                created_by: fullname,
                updated_by: fullname
            }
        });

        return msg(res, 200, { message: 'Insert data successfully!' });
    } catch(err) {
        console.log('insertDataShiftType : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Update ข้อมูลไปยัง Database
exports.updateDataShiftType = async (req, res) => {
    try {
        const { id } = req.params;

        // Check id ที่ส่งมาว่ามีข้อมูลใน shift_types หรือไม่?
        const checkIdShiftType = await pm.shift_types.findFirst({
            where: {
                shift_type_id: Number(id)
            }
        });
        if(!checkIdShiftType) return msg(res, 404, { message: 'ไม่มี shift_type_id อยู่ในระบบ!' });

        const { shift_type_name } = req.body;
        const fullname = req.user.fullname_thai;

        if(!shift_type_name) return msg(res, 400, 'กรุณากรอกข้อมูลให้ครบถ้วน!');

        // Check shift_type_name ว่ามีซ้ำอยู่ใน Database หรือไม่?
        const checkHolidayNameResult = await pm.shift_types.findFirst({
            where: {
                shift_type_name: shift_type_name
            }
        });
        if(checkHolidayNameResult) return msg(res, 409, 'มี (shift_type_name) อยู่ในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!');

        await pm.shift_types.update({
            where: {
                shift_type_id: Number(id)
            },
            data: {
                shift_type_name: shift_type_name,
                updated_by: fullname
            }
        });

        return msg(res, 200, { message: 'Updated successfully!' });
    } catch(err) {
        console.log('updateDataShiftType : ', err);
        return msg(res, 500, { message: err.message });
    }
}