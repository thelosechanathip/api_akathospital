const services = require('../../services/setting/accessibilityService');
const { msg } = require('../../utils/message');
const { buildLogPayload } = require('../../utils/settingLog');

// fetchAllData on accessibilities
exports.fetchAccessibilitiesController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.fetchAllData(logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// CreateData on accessibilities
exports.createAccessibilityController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.createData(req.body, req.user.fullname_thai, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};