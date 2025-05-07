const pm = require('../../config/prisma');

// บันทึกข้อมูลไปยัง Log
exports.createLog = async (logData) => {
    return await pm.fiscal_years_log.create({ data: { ...logData } });
};

// Fetch ข้อมูลทั้งหมด
exports.fetchAllData = async () => {
    return await pm.fiscal_years.findMany();
};

// Fetch => fiscal_year_name
exports.fetchFiscalYearName = async (field, value) => {
    return await pm.fiscal_years.findFirst({ where: { [field]: value } })
};

// บันทึกข้อมูล
exports.createData = async (data) => {
    return await pm.fiscal_years.create({ data: { ...data } });
};

// Fetch => fiscal_year_id ด้วย ID ที่ถูกส่งมา
exports.fetchOneData = async (id) => {
    return await pm.fiscal_years.findFirst({ where: { fiscal_year_id: Number(id) } });
};

// Update ข้อมูลของ ID ที่ถูกส่งมา
exports.updateData = async (id, data) => {
    return await pm.fiscal_years.update({ where: { fiscal_year_id: Number(id) }, data: { ...data } });
};

// Delete ข้อมูลของ ID ที่ถูกส่งมา
exports.removeData = async (id) => {
    await pm.fiscal_years.delete({ where: { fiscal_year_id: Number(id) } });

    // ดึงค่า MAX(fiscal_year_id)
    const maxIdFormIpdResult = await pm.$queryRaw`SELECT COALESCE(MAX(fiscal_year_id), 0) + 1 AS nextId FROM fiscal_years`;

    // รีเซ็ตค่า AUTO_INCREMENT
    return await pm.$executeRawUnsafe(`ALTER TABLE fiscal_years AUTO_INCREMENT = ${maxIdFormIpdResult[0].nextId}`);
};