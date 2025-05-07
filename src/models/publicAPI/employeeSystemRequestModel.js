const pm = require('../../config/prisma');

// Fetch all employeeSystemRequests
exports.fetchAllData = () => {
    return pm.employee_system_requests.findMany();
};

// Check national_id to employee_system_requests
exports.checkToEmployeeSystemRequest = async (key, value) => {
    return await pm.employee_system_requests.findFirst({
        where: { [key]: value }
    });
};

// Check national_id to users
exports.checkToUser = async (key, value) => {
    return await pm.users.findFirst({
        where: { [key]: value }
    });
};

// Fetch prefix_name to prefixes
exports.fetchPrefixName = async (value) => {
    const result = await pm.prefixes.findFirst({
        where: { prefix_id: Number(value) }, select: { prefix_name: true }
    });
    return result.prefix_name;
};

// Fetch department_name to departments
exports.fetchDepartmentName = async (value) => {
    const result = await pm.departments.findFirst({
        where: { department_id: Number(value) }, select: { department_name: true }
    });
    return result.department_name;
};

// Fetch position_name to positions
exports.fetchPositionName = async (value) => {
    const result = await pm.positions.findFirst({
        where: { position_id: Number(value) }, select: { position_name: true }
    });
    return result.position_name;
};

// Create data in employee_system_requests
exports.createData = async (data) => {
    return await pm.employee_system_requests.create({ data: { ...data } });
};

// Check id To employee_system_requests
exports.checkIdInEmployeeSystemRequest = async (id) => {
    return await pm.employee_system_requests.findFirst({
        where: { employee_system_request_id: Number(id) },
    });
};

// Remove data in employee_system_requests
exports.removeData = async (id) => {
    const removeData = await pm.employee_system_requests.delete({
        where: { employee_system_request_id: Number(id) }
    });

    // ดึงค่า MAX(employee_system_request_id)
    const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(employee_system_request_id), 0) + 1 AS nextId FROM employee_system_requests`;

    // รีเซ็ตค่า AUTO_INCREMENT
    await pm.$executeRawUnsafe(`ALTER TABLE employee_system_requests AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

    return true;
};