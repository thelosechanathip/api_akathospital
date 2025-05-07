const pm = require('../../config/prisma');

// บันทึกข้อมูลไปยัง Log
exports.createLog = async (logData) => {
    return await pm.hospital_profiles_log.create({ data: { ...logData } });
};

// Fetch ข้อมูลทั้งหมด
exports.fetchAllData = async () => {
    return await pm.hospital_profiles.findMany();
};

// บันทึกข้อมูล
exports.createData = async (data) => {
    return await pm.hospital_profiles.create({ data: { ...data } });
};

// Fetch ข้อมูลด้วย ID ที่ถูกส่งมา
exports.fetchOneData = async (id) => {
    return await pm.hospital_profiles.findFirst({ where: { hospital_profile_id: Number(id) } });
};

// Update ข้อมูลของ ID ที่ถูกส่งมา
exports.updateData = async (id, data) => {
    return await pm.hospital_profiles.update({ where: { hospital_profile_id: Number(id) }, data: { ...data } });
};

// Delete ข้อมูลของ ID ที่ถูกส่งมา
exports.removeData = async (id) => {
    await pm.hospital_profiles.delete({ where: { hospital_profile_id: Number(id) } });

    // ดึงค่า MAX(hospital_profile_id)
    const maxIdFormIpdResult = await pm.$queryRaw`SELECT COALESCE(MAX(hospital_profile_id), 0) + 1 AS nextId FROM hospital_profiles`;

    // รีเซ็ตค่า AUTO_INCREMENT
    return await pm.$executeRawUnsafe(`ALTER TABLE hospital_profiles AUTO_INCREMENT = ${maxIdFormIpdResult[0].nextId}`);
};