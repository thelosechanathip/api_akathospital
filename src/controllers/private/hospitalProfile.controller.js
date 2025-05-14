const services = require('../../services/private/hospitalProfile.service');
const { msg } = require('../../utils/message');
const { buildLogPayload } = require('../../utils/settingLog');

// fetchAllData on hospital_profiles
exports.fetchHospitalProfileController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.fetchAllData(logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// CreateData on hospital_profiles
exports.createHospitalProfileController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.createData(req.body, req.user.fullname_thai, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// UpdateData on hospital_profiles
exports.updateHospitalProfileController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.updateData(req.params.id, req.body, req.user.fullname_thai, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message };
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// RemoveData on hospital_profiles
exports.removeHospitalProfileController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.removeData(req.params.id, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message };
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};