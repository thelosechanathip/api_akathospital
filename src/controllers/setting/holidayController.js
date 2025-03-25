const pm = require('../../config/prisma');
const moment = require("moment");
const { msg } = require('../../utils/message');
const { fetchAllDataHolidyOnHoSXP } = require('../../models/setting/holidayModel');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataHolidays = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.holidays.findMany();
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง holidays_log
        await pm.holidays_log.create({
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
        console.log('getAllDataHolidays : ', err);
        return msg(res, 500, { message: err.message });
    }
}

// Function Sync ข้อมูลจากระบบ HoSXP มาบันทึกในระบบ Akathospital
exports.syncDataHoliday = async (req, res) => {
    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const fullname = req.user.fullname_thai;
        const fetchData = await fetchAllDataHolidyOnHoSXP();
  
        if (!fetchData || fetchData.length === 0) {
            res.write(`data: {"status": 404, "progress": "error", "message": "ไม่พบข้อมูลวันหยุดจากระบบ HoSXP!"}\n\n`);
            return res.end();
        }
  
        const dateNow = moment().startOf('year').format('YYYY-MM-DD');
  
        await pm.holidays.deleteMany({
            where: { holiday_date: { lt: dateNow } }
        });
  
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(holiday_id), 0) + 1 AS nextId FROM holidays`;
        const nextId = maxIdResult[0].nextId || 1;
  
        await pm.$executeRawUnsafe(`ALTER TABLE holidays AUTO_INCREMENT = ${nextId}`);
  
        // ** นับจำนวนทั้งหมด **
        const totalRecords = fetchData.length;
        let currentProgress = 0;
  
        const startTime = Date.now();
        let updatedRows = 0; // นับจำนวนข้อมูลที่ถูกอัปเดตหรือเพิ่ม

        for (const holidayHos of fetchData) {
            const { day_name, holiday_date } = holidayHos;
            const formattedDate = moment(holiday_date).format('YYYY-MM-DD');

            const syncData = await pm.holidays.upsert({
                where: { holiday_date: formattedDate }, 
                update: { holiday_name: day_name, updated_by: fullname },
                create: { holiday_name: day_name, holiday_date: formattedDate, created_by: fullname, updated_by: fullname }
            });

            if (syncData) updatedRows++; // นับจำนวนที่ถูกอัปเดตหรือเพิ่ม

            // ** อัปเดต Progress และส่งข้อมูลกลับไปที่ Frontend **
            currentProgress++;
            console.log(`Syncing: ${currentProgress}/${totalRecords}`);

            res.write(`data: {"status": 200, "progress": "${currentProgress}/${totalRecords}"}\n\n`);
        }

        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง holidays_log
        await pm.holidays_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: updatedRows,  // ใช้ค่าที่สะสมไว้
                status: updatedRows > 0 ? 'Success' : 'No Data'
            }
        });

        // ** เมื่อเสร็จแล้วให้ส่งข้อความสุดท้าย และปิดการเชื่อมต่อ **
        res.write(`data: {"status": 200, "progress": "complete", "message": "Sync data successfully!"}\n\n`);
        res.end();
  
    } catch (err) {
        console.log('SyncDataHoliday : ', err);
        res.write(`data: {"status": 500, "progress": "error", "message": "${err.message}"}\n\n`);
        res.end();
    }
};
