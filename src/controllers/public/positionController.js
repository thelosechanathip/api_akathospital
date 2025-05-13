const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');
const db_b = require('../../config/db_b');
const os = require('os');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataPositions = async (req, res) => {
    try {
        const startTime = Date.now();
        const resultData = await pm.positions.findMany();
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง positions_log
        await pm.positions_log.create({
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
        console.log('getAllDataPositions : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function Sync ข้อมูลจากระบบ HoSXP มาบันทึกในระบบ Akathospital
exports.syncDataPositions = async (req, res) => {
    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        const [fetchDataPositionInBackOffice] = await db_b.query(`
            SELECT 
                HR_POSITION_ID,
                HR_POSITION_NAME
            FROM hrd_position  
        `);
  
        if (!fetchDataPositionInBackOffice || fetchDataPositionInBackOffice.length === 0) {
            res.write(`data: {"status": 404, "progress": "error", "message": "ไม่พบข้อมูลตำแหน่งจากระบบ BackOffice!"}\n\n`);
            return res.end();
        }
  
        await pm.positions.deleteMany();
  
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(position_id), 0) + 1 AS nextId FROM positions`;
        const nextId = maxIdResult[0].nextId || 1;
  
        await pm.$executeRawUnsafe(`ALTER TABLE positions AUTO_INCREMENT = ${nextId}`);
  
        // ** นับจำนวนทั้งหมด **
        const totalRecords = fetchDataPositionInBackOffice.length;
        let currentProgress = 0;
  
        const startTime = Date.now();
        let updatedRows = 0; // นับจำนวนข้อมูลที่ถูกอัปเดตหรือเพิ่ม

        for (const positionBackOffice of fetchDataPositionInBackOffice) {
            const { HR_POSITION_NAME } = positionBackOffice;

            const syncData = await pm.positions.create({
                data: { 
                    position_name: HR_POSITION_NAME, 
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

        // บันทึกข้อมูลไปยัง positions_log
        await pm.positions_log.create({
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
        console.log('syncDataPositions : ', err);
        res.write(`data: {"status": 500, "progress": "error", "message": "${err.message}"}\n\n`);
        res.end();
    }
};