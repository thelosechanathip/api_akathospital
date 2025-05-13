const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');
const db_b = require('../../config/db_b');
const os = require('os');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataPrefixes = async (req, res) => {
    try {
        const startTime = Date.now();
        const resultData = await pm.prefixes.findMany();
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง prefixes_log
        await pm.prefixes_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: os.hostname(),
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
        console.log('getAllDataPrefixes : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function Sync ข้อมูลจากระบบ HoSXP มาบันทึกในระบบ Akathospital
exports.syncDataPrefixes = async (req, res) => {
    try {
        await pm.prefixes.deleteMany();
  
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(prefix_id), 0) + 1 AS nextId FROM prefixes`;
        const nextId = maxIdResult[0].nextId || 1;
  
        await pm.$executeRawUnsafe(`ALTER TABLE prefixes AUTO_INCREMENT = ${nextId}`);

        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const [fetchDataPrefixInBackOffice] = await db_b.query(`
            SELECT 
                HR_PREFIX_ID, 
                HR_PREFIX_NAME 
            FROM hrd_prefix     
            WHERE HR_PREFIX_ID IS NOT NULL AND HR_PREFIX_ID != ''
        `);
  
        if (!fetchDataPrefixInBackOffice || fetchDataPrefixInBackOffice.length === 0) {
            res.write(`data: {"status": 404, "progress": "error", "message": "ไม่พบข้อมูลคำนำหน้าจากระบบ BackOffice!"}\n\n`);
            return res.end();
        }
  
        // ** นับจำนวนทั้งหมด **
        const totalRecords = fetchDataPrefixInBackOffice.length;
        let currentProgress = 0;
  
        const startTime = Date.now();
        let updatedRows = 0; // นับจำนวนข้อมูลที่ถูกอัปเดตหรือเพิ่ม

        for (const prefixBackOffice of fetchDataPrefixInBackOffice) {
            const { HR_PREFIX_NAME } = prefixBackOffice;

            const syncData = await pm.prefixes.create({
                data: { 
                    prefix_name: HR_PREFIX_NAME, 
                    created_by: os.hostname(), 
                    updated_by: os.hostname() }
            });

            if (syncData) updatedRows++; // นับจำนวนที่ถูกอัปเดตหรือเพิ่ม

            // ** อัปเดต Progress และส่งข้อมูลกลับไปที่ Frontend **
            currentProgress++;
            console.log(`Syncing: ${currentProgress}/${totalRecords}`);

            res.write(`data: {"status": 200, "progress": "${currentProgress}/${totalRecords}"}\n\n`);
        }

        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง prefixes_log
        await pm.prefixes_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: os.hostname(),
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
        console.log('syncDataPrefixes : ', err);
        res.write(`data: {"status": 500, "progress": "error", "message": "${err.message}"}\n\n`);
        res.end();
    }
};