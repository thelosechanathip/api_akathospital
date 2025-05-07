const pm = require('../../config/prisma');

// บันทึกข้อมูลไปยัง Log
exports.createLog = async (logData) => {
    return await pm.route_fronts_log.create({ data: { ...logData } });
};

// Fetch ข้อมูลทั้งหมด
exports.fetchAllData = async () => {
    return await pm.route_fronts.findMany({
        include: {
            departments: {
                select: {
                    department_id: true,
                    department_name: true
                }
            },
            users: {
                select: {
                    user_id: true,
                    fullname_thai: true
                }
            },
            department_id: false,
            user_id: false
        },
        orderBy: { route_front_id: 'desc' }
    });
};

exports.fetchNamePath = async (key, value) => {
    return await pm.route_fronts.findFirst({ where: { [key]: value } });
};

// บันทึกข้อมูล
exports.createData = async (data) => {
    return await pm.route_fronts.create({
        data: { ...data }
    });
};

// Fetch ข้อมูล RouteFront ด้วย ID ที่ถูกส่งมา
exports.fetchOneData = async (id) => {
    return await pm.route_fronts.findFirst({ where: { route_front_id: Number(id) } });
};

// Update ข้อมูลของ ID ที่ถูกส่งมา
exports.updateData = async (id, data) => {
    return await pm.route_fronts.update({ where: { route_front_id: Number(id) }, data: { ...data } });
};

// Delete ข้อมูลของ ID ที่ถูกส่งมา
exports.removeData = async (id) => {
    await pm.route_fronts.delete({ where: { route_front_id: Number(id) } });

    // ดึงค่า MAX(route_front_id)
    const maxIdFormIpdResult = await pm.$queryRaw`SELECT COALESCE(MAX(route_front_id), 0) + 1 AS nextId FROM route_fronts`;

    // รีเซ็ตค่า AUTO_INCREMENT
    return await pm.$executeRawUnsafe(`ALTER TABLE route_fronts AUTO_INCREMENT = ${maxIdFormIpdResult[0].nextId}`);
};