const pm = require('../../config/prisma');

exports.createLog = async (logData) => {
    return await pm.main_vision_mission_statements_log.create({ data: { ...logData } });
};

exports.fetchOneData = async (id) => {
    return await pm.main_vision_mission_statements.findFirst({ where: { main_vision_mission_statement_id: Number(id) } });
};

exports.fetchAllData = async () => {
    return await pm.main_vision_mission_statements.findMany();
};

exports.fetchDataInput = async (data) => {
    return await pm.main_vision_mission_statements.findFirst({ where: { main_vision_mission_statement_name: data } });
}

exports.createData = async (data) => {
    return await pm.main_vision_mission_statements.create({ data: { ...data } });
};

exports.updateData = async (id, data) => {
    return await pm.main_vision_mission_statements.update({ where: { main_vision_mission_statement_id: Number(id) }, data: { ...data } });
}

exports.removeData = async (id) => {
    await pm.main_vision_mission_statements.delete({ where: { main_vision_mission_statement_id: Number(id) } });

    const maxIdFormIpdResult = await pm.$queryRaw`SELECT COALESCE(MAX(main_vision_mission_statement_id), 0) + 1 AS nextId FROM main_vision_mission_statements`;

    // รีเซ็ตค่า AUTO_INCREMENT
    return await pm.$executeRawUnsafe(`ALTER TABLE main_vision_mission_statements AUTO_INCREMENT = ${maxIdFormIpdResult[0].nextId}`);
};
