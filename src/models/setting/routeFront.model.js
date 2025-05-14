const pm = require('../../config/prisma');

// บันทึกข้อมูลไปยัง Log
exports.createLog = async (logData) => {
    return await pm.route_fronts_log.create({ data: { ...logData } });
};

// Fetch ข้อมูลทั้งหมด
exports.fetchAllData = async () => {
    return await pm.route_fronts.findMany();
};

exports.fetchNamePath = async (key, value) => {
    return await pm.route_fronts.findFirst({ where: { [key]: value } });
};

// บันทึกข้อมูล
exports.createData = async (data) => {
    return await pm.route_fronts.createMany(data);
};

// Fetch ข้อมูล RouteFront ด้วย ID ที่ถูกส่งมา
exports.fetchOneData = async (id) => {
    return await pm.route_fronts.findFirst({ where: { route_front_id: Number(id) } });
};

// Update ข้อมูลของ ID ที่ถูกส่งมา
exports.updateData = async (id, data) => {
    return await pm.route_fronts.update({ where: { route_front_id: Number(id) }, data: { ...data } });
};

exports.checkForeignKey = async () => {
    return await pm.$queryRaw`
        SELECT TABLE_NAME, COLUMN_NAME
        FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
        WHERE REFERENCED_TABLE_NAME = 'route_fronts'
        AND REFERENCED_COLUMN_NAME = 'route_front_id'
        AND EXISTS (
            SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = KEY_COLUMN_USAGE.TABLE_NAME
        )
    `;
};

exports.checkForeignKeyData = async (tableName, columnName, id) => {
    return await pm.$queryRawUnsafe(`
        SELECT 1 FROM ${tableName} WHERE ${columnName} = ${Number(id)} LIMIT 1
    `);
};

// Delete ข้อมูลของ ID ที่ถูกส่งมา
exports.removeData = async (id) => {
    await pm.route_fronts.delete({ where: { route_front_id: Number(id) } });

    // ดึงค่า MAX(route_front_id)
    const maxIdFormIpdResult = await pm.$queryRaw`SELECT COALESCE(MAX(route_front_id), 0) + 1 AS nextId FROM route_fronts`;

    // รีเซ็ตค่า AUTO_INCREMENT
    return await pm.$executeRawUnsafe(`ALTER TABLE route_fronts AUTO_INCREMENT = ${maxIdFormIpdResult[0].nextId}`);
};