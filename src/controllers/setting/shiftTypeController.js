const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataShiftTypes = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.shift_types.findMany();
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง shift_types_log
        await pm.shift_types_log.create({
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
        const checkShiftTypeNameResult = await pm.shift_types.findFirst({
            where: {
                shift_type_name: shift_type_name
            }
        });
        if(checkShiftTypeNameResult) return msg(res, 409, 'มี (shift_type_name) อยู่ในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!');

        const startTime = Date.now();
        const insertData = await pm.shift_types.create({
            data: {
                shift_type_name: shift_type_name,
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง shift_types_log
        await pm.shift_types_log.create({
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
        const checkShiftTypeNameResult = await pm.shift_types.findFirst({
            where: {
                shift_type_name: shift_type_name
            }
        });
        if(checkShiftTypeNameResult) return msg(res, 409, 'มี (shift_type_name) อยู่ในระบบแล้ว ไม่อนุญาตให้บันทึกข้อมูลซ้ำ!');

        const startTime = Date.now();
        const updateData = await pm.shift_types.update({
            where: {
                shift_type_id: Number(id)
            },
            data: {
                shift_type_name: shift_type_name,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง shift_types_log
        await pm.shift_types_log.create({
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
        console.log('updateDataShiftType : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataShiftType = async (req, res) => {
    try {
        const { id } = req.params;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่า ID มีอยู่จริงหรือไม่
        const checkIdShiftType = await pm.shift_types.findFirst({
            where: {
                shift_type_id: Number(id)
            }
        });
        if (!checkIdShiftType) return msg(res, 404, { message: 'ไม่มี shift_type_id อยู่ในระบบ!' });

        // ลบข้อมูล
        const startTime = Date.now();
        const removeData = await pm.shift_types.delete({
            where: {
                shift_type_id: Number(id)
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง shift_types_log
        await pm.shift_types_log.create({
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

        // ดึงค่า MAX(shift_type_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(shift_type_id), 0) + 1 AS nextId FROM shift_types`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE shift_types AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataShiftType : ', err);
        return msg(res, 500, { message: err.message });
    }
};