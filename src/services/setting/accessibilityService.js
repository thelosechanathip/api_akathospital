const models = require('../../models/setting/accessibilityModel');

exports.fetchAllData = async (logPayload) => {
    const startTime = Date.now();
    const fetchDataResult = await models.fetchAllData();
    const endTime = Date.now() - startTime;

    logPayload.execution_time = endTime;
    logPayload.row_count = fetchDataResult.length;
    logPayload.status = fetchDataResult.length > 0 ? 'Success' : 'No Data';

    await models.createLog(logPayload);
    if (fetchDataResult.length === 0) return { status: 404, message: 'ไม่มีข้อมูลใน Database!' };

    return { status: 200, data: fetchDataResult };
};

exports.createData = async (data, fullname, logPayload) => {
    // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
    const duplicateStatus = [];
    const duplicateMessages = [];
    let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

    for (const [key, value] of Object.entries(data)) {
        // ถ้าพบค่าว่าง ให้ตั้งค่า flag เป็น true
        if (['route_front_id'].includes(key) && !value) hasEmptyValue = true;
        if (['route_front_id'].includes(key) && value) {
            const checkRouteFrontIdResult = await models.fetchOneRouteFront(key, value);
            if (!checkRouteFrontIdResult) {
                duplicateStatus.push(404);
                duplicateMessages.push(`ไม่มีข้อมูล Route path นี้อยู่ในระบบ!`);
            }
            const routeFrontid = Number(value);
            data.route_front_id = routeFrontid;
        }

        if (['department_id'].includes(key) && value) {
            const checkDepartmentIdResult = await models.fetchOneDepartment(key, value);
            if (!checkDepartmentIdResult) {
                duplicateStatus.push(404);
                duplicateMessages.push(`ไม่มีข้อมูลแผนกนี้อยู่ในระบบ!`);
            }
            const departmentId = Number(value);
            data.department_id = departmentId;
        }

        if (['user_id'].includes(key) && value) {
            const checkUserIdResult = await models.fetchOneUser(key, value);
            if (!checkUserIdResult) {
                duplicateStatus.push(404);
                duplicateMessages.push(`ไม่มีข้อมูลผู้ใช้งานนี้อยู่ในระบบ!`);
            }
            const userId = Number(value);
            data.user_id = userId;
        }
    }

    // ถ้ามีค่าที่ว่าง ให้เพิ่มข้อความแค่ครั้งเดียว
    if (hasEmptyValue) {
        duplicateMessages.unshift("กรุณากรอกข้อมูลให้ครบถ้วน!");
        return { status: 400, message: duplicateMessages[0] };
    }
    if (duplicateMessages.length > 0) return { status: Math.max(...duplicateStatus), message: duplicateMessages.join(" AND ") }

    const payload = {
        ...data,
        created_by: fullname,
        updated_by: fullname
    };

    const startTime = Date.now();
    const createData = await models.createData(payload);
    const endTime = Date.now() - startTime;

    logPayload.execution_time = endTime;
    logPayload.row_count = createData ? 1 : 0;
    logPayload.status = createData ? 'Success' : 'No Data';

    await models.createLog(logPayload);
    if (createData) return { status: 200, message: 'Added successfully!' };
};