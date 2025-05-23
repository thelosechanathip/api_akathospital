const pm = require('../../config/prisma');

// บันทึกข้อมูลไปยัง Log
exports.createLog = async (logData) => {
    return await pm.accessibilities_log.create({ data: { ...logData } });
};

// Fetch ข้อมูลทั้งหมด
exports.fetchAllData = async () => {
    return await pm.accessibilities.findMany({
        include: {
            route_fronts: {
                select: {
                    route_front_id: true,
                    route_front_name: true
                }
            },
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
            route_front_id: false,
            department_id: false,
            user_id: false
        }
    });
};

// Fetch One route_fronts
exports.fetchOneRouteFront = async (key, value) => {
    return await pm.route_fronts.findFirst({ where: { [key]: value } });
};

// Fetch One departments
exports.fetchOneDepartment = async (key, value) => {
    return await pm.departments.findFirst({ where: { [key]: value } });
};

// Fetch One useres
exports.fetchOneUser = async (key, value) => {
    return await pm.users.findFirst({ where: { [key]: value } });
};

// บันทึกข้อมูล
exports.createData = async (data) => {
    return await pm.accessibilities.create({ data: { ...data } });
};