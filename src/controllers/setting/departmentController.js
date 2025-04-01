const pm = require('../../config/prisma');
const moment = require("moment");
const { msg } = require('../../utils/message');
const db_b = require('../../config/db_b');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataDepartments = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.departments.findMany();
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง departments_log
        await pm.departments_log.create({
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
        console.log('getAllDataDepartments : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function Sync ข้อมูลจากระบบ HoSXP มาบันทึกในระบบ Akathospital
exports.syncDataDepartments = async (req, res) => {
    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const fullname = req.user.fullname_thai;
        const [fetchDataDepartmentInBackOffice] = await db_b.query(`
            SELECT 
                HR_DEPARTMENT_SUB_SUB_ID, 
                HR_DEPARTMENT_SUB_SUB_NAME 
            FROM hrd_department_sub_sub     
        `);
  
        if (!fetchDataDepartmentInBackOffice || fetchDataDepartmentInBackOffice.length === 0) {
            res.write(`data: {"status": 404, "progress": "error", "message": "ไม่พบข้อมูลวันหยุดจากระบบ BackOffice!"}\n\n`);
            return res.end();
        }
  
        await pm.departments.deleteMany();
  
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(department_id), 0) + 1 AS nextId FROM departments`;
        const nextId = maxIdResult[0].nextId || 1;
  
        await pm.$executeRawUnsafe(`ALTER TABLE departments AUTO_INCREMENT = ${nextId}`);
  
        // ** นับจำนวนทั้งหมด **
        const totalRecords = fetchDataDepartmentInBackOffice.length;
        let currentProgress = 0;
  
        const startTime = Date.now();
        let updatedRows = 0; // นับจำนวนข้อมูลที่ถูกอัปเดตหรือเพิ่ม

        for (const departmentBackOffice of fetchDataDepartmentInBackOffice) {
            const { HR_DEPARTMENT_SUB_SUB_ID, HR_DEPARTMENT_SUB_SUB_NAME } = departmentBackOffice;

            const syncData = await pm.departments.create({
                data: { 
                    department_id: HR_DEPARTMENT_SUB_SUB_ID, 
                    department_name: HR_DEPARTMENT_SUB_SUB_NAME, 
                    created_by: fullname, 
                    updated_by: fullname }
            });

            if (syncData) updatedRows++; // นับจำนวนที่ถูกอัปเดตหรือเพิ่ม

            // ** อัปเดต Progress และส่งข้อมูลกลับไปที่ Frontend **
            currentProgress++;
            console.log(`Syncing: ${currentProgress}/${totalRecords}`);

            res.write(`data: {"status": 200, "progress": "${currentProgress}/${totalRecords}"}\n\n`);
        }

        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง departments_log
        await pm.departments_log.create({
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
        console.log('syncDataDepartment : ', err);
        res.write(`data: {"status": 500, "progress": "error", "message": "${err.message}"}\n\n`);
        res.end();
    }
};