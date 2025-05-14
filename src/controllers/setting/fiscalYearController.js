const services = require('../../services/setting/fiscalYear.service');
const { msg } = require('../../utils/message');
const { buildLogPayload } = require('../../utils/settingLog');

// fetchAllData on fiscal_years
exports.fetchFiscalYearsController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.fetchAllData(logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// CreateData on fiscal_years
exports.createFiscalYearController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.createData(req.body, req.user.fullname_thai, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// UpdateData on fiscal_years
exports.updateFiscalYearController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.updateData(req.params.id, req.body, req.user.fullname_thai, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message };
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// RemoveData on fiscal_years
exports.removeFiscalYearController = async (req, res, next) => {
    try {
        const logPayload = await buildLogPayload(req, req.user);
        const result = await services.removeData(req.params.id, logPayload);
        const payload = result.data ? { data: result.data } : { message: result.message };
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};