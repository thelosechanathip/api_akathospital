const services = require('../../services/privateAPI/directorBiographieService');
const { msg } = require('../../utils/message');
const { buildLogPayload } = require('../../utils/settingLog');

// fetchAllData on director_biographies
exports.fetchDirectorBiographiesController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.fetchAllData(logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// CreateData on director_biographies
exports.createDirectorBiographieController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.createData(req.body, req.user.fullname_thai, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// UpdateData on director_biographies
exports.updateDirectorBiographieController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.updateData(req.params.id, req.body, req.user.fullname_thai, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message };
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// RemoveData on director_biographies
exports.removeDirectorBiographieController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.removeData(req.params.id, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message };
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};