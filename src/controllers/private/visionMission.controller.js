const services = require('../../services/private/visionMission.service');
const { msg } = require('../../utils/message');
const { buildLogPayload } = require('../../utils/settingLog');

// fetchAllData on director_biographies
exports.fetchVisionMissionsController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req?.user?.fullname_thai);
        const result = await services.fetchAllData(logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

exports.createVisionMissionsController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req?.user?.fullname_thai);
        const result = await services.createData(req.body, req?.user?.fullname_thai, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

exports.updateVisionMissionsController = async (req, res, next) => {
    let fullname = req?.user?.fullname_thai;
    try {
        const logPayload = await buildLogPayload(req, fullname);
        const result = await services.updateData(req.params.id, req.body, fullname, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message };
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// RemoveData on director_biographies
exports.removeVisionMissionsController = async (req, res, next) => {
    let fullname = req?.user?.fullname_thai;
    try {
        const logPayload = await buildLogPayload(req, fullname);
        const result = await services.removeData(req.params.id, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message };
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};