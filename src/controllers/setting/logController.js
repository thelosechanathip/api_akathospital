const pm = require('../../config/prisma');
const bcrypt = require('bcryptjs');
const { msg } = require('../../utils/message');

// Clear ข้อมูล Log ทั้งหมดออกจาก Table ที่มี _log ต่อท้าย
exports.clearLog = async(req, res) => {
    try {
        const { password } = req.body;
        if(!password) return msg(res, 400, { message: 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบข้อมูล!' });

        const fetchPassword = await pm.users.findFirst({
            where: { user_id: req.user.user_id },
            select: { password: true }
        });
        const isMath = await bcrypt.compare(password, fetchPassword.password);
        if(!isMath) return msg(res, 400, { message: 'รหัสผ่านไม่ถูกต้องกรุณาตรวจสอบรหัสผ่าน!' });

        const tables = await pm.$queryRawUnsafe(
            `
                SELECT table_name
                FROM information_schema.tables
                WHERE table_schema = DATABASE()
                    AND table_name LIKE '%\\_log'
            `
        );

        for (const table of tables) {
            const tableName = table.table_name;
            console.log(`Clearing table: ${tableName}`);

            await pm.$executeRawUnsafe(`DELETE FROM \`${tableName}\``);
            await pm.$executeRawUnsafe(`ALTER TABLE \`${tableName}\` AUTO_INCREMENT = 1`);
        }
 
        return msg(res, 200, { message: 'Clear log successfully!' });
    } catch(err) {
        console.log('clearLog : ', err);
        return msg(res, 500, { message: err.message });
    } finally {
        await pm.$disconnect();
    }
};