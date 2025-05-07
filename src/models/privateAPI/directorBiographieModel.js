const pm = require('../../config/prisma');

// บันทึกข้อมูลไปยัง Log
exports.createLog = async (logData) => {
    return await pm.director_biographies_log.create({ data: { ...logData } });
};

// Fetch ข้อมูลทั้งหมด
exports.fetchAllData = async () => {
    return await pm.director_biographies.findMany();
};

// Fetch ข้อมูล User ด้วย ID ของ User ที่ถูกส่งมา
exports.fetchOneUser = async (id) => {
    return await pm.users.findFirst({ where: { user_id: Number(id) } });
};

// Fetch ข้อมูล DirectorBiographie ด้วย ID ของ UserID ที่ถูกส่งมา
exports.fetchOneDirectorBiographie = async (id) => {
    return await pm.director_biographies.findFirst({ where: { user_id: Number(id) } });
};

// บันทึกข้อมูล
exports.createData = async (data) => {
    return await pm.director_biographies.create({ data: { ...data } });
};

// Fetch ข้อมูล DirectorBiographie ด้วย ID ที่ถูกส่งมา
exports.fetchOneData = async (id) => {
    return await pm.director_biographies.findFirst({ where: { director_biographie_id: Number(id) } });
};

// Update ข้อมูลของ ID ที่ถูกส่งมา
exports.updateData = async (id, data) => {
    return await pm.director_biographies.update({ where: { director_biographie_id: Number(id) }, data: { ...data } });
};

// Delete ข้อมูลของ ID ที่ถูกส่งมา
exports.removeData = async (id) => {
    await pm.director_biographies.delete({ where: { director_biographie_id: Number(id) } });

    // ดึงค่า MAX(director_biographie_id)
    const maxIdFormIpdResult = await pm.$queryRaw`SELECT COALESCE(MAX(director_biographie_id), 0) + 1 AS nextId FROM director_biographies`;

    // รีเซ็ตค่า AUTO_INCREMENT
    return await pm.$executeRawUnsafe(`ALTER TABLE director_biographies AUTO_INCREMENT = ${maxIdFormIpdResult[0].nextId}`);
};