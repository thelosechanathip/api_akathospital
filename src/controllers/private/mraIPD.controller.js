const services = require('../../services/private/mraIPD.service');
const { msg } = require('../../utils/message');
const { buildLogPayload } = require('../../utils/settingLog');

// Function ในการดึงข้อมูลทั้งหมด Medical Record Audit จาก Database
exports.fetchMraIpdController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.fetchData(logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// Function ในการดึงข้อมูล 1 Record => Medical Record Audit จาก Database
exports.fetchOneMraIpdController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.fetchOneData(req.params.an, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// Function ในการตรวจสอบข้อมูลก่อนบันทึก Medical Record Audit ไปยัง Database
exports.fetchPatientDataController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.fetchOnePatientData(req.params.an, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message };
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

exports.generateFormMraIpdController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.generateForm(req.body, req.user.fullname_thai, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message };
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

exports.updateFormMraIpdController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.updateForm(req.params.an, req.body, req.user.fullname_thai, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message };
        return msg(res, result.status, payload);
    } catch (err) {
        return msg(res, 500, { message: err.message });
    }
}

// Function ในการลบข้อมูล Medical Record Audit บน Database
exports.removeMraIpdController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.removeData(req.params.an, req.body, req.user, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};