const models = require("../../models/private/visionMission.model");

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
        if (['main_vision_mission_statement_name'].includes(key) && !value) hasEmptyValue = true;

        if (['main_vision_mission_statement_name'].includes(key) && value) {

            const checkDataInputUnique = await models.fetchDataInput(value);
            if (checkDataInputUnique) {
                duplicateStatus.push(409);
                duplicateMessages.push(`มีข้อมูลนี้อยู่ในระบบแล้ว!`);
            }
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

exports.updateData = async (id, data, fullname, logPayload) => {
    // ส่ง ID ไปค้นหาข้อมูล
    const resultFetchOne = await models.fetchOneData(id);
    if(!resultFetchOne) return { status: 404, message: 'ไม่มีข้อมูล!' };

    // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
    const duplicateStatus = [];
    const duplicateMessages = [];
    let hasEmptyValue = false; // Flag สำหรับตรวจสอบค่าที่ว่าง

    for (const [key, value] of Object.entries(data)) {
        if (['main_vision_mission_statement_name'].includes(key) && !value) hasEmptyValue = true;
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
    const updateData = await models.updateData(id, payload);
    const endTime = Date.now() - startTime;

    logPayload.execution_time = endTime;
    logPayload.row_count = updateData ? 1 : 0;
    logPayload.status = updateData ? 'Success' : 'No Data';

    await models.createLog(logPayload);
    return { status: 200, message: 'Updated successfully!' };
};

exports.removeData = async (id, logPayload) => {
    // ส่ง ID ไปค้นหาข้อมูล
    const resultFetchOne = await models.fetchOneData(id);
    if(!resultFetchOne) return { status: 404, message: 'ไม่มีข้อมูล!' };

    const startTime = Date.now();
    const removeData = await models.removeData(id);
    const endTime = Date.now() - startTime;

    logPayload.execution_time = endTime;
    logPayload.row_count = removeData ? 1 : 0;
    logPayload.status = removeData ? 'Success' : 'No Data';

    await models.createLog(logPayload);
    return { status: 200, message: 'Deleted successfully!' };
};