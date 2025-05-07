const services = require('../../services/publicAPI/employeeSystemRequestService');
const { msg } = require('../../utils/message');

// Fetch all data employeeSystemRequests
exports.getEmployeeSystemRequests = async (req, res, next) => {
    try {
        const result = await services.fetchAllData();
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// Create data employeeSystemRequest
exports.createEmployeeSystemRequest = async (req, res, next) => {
    try {
        const result = await services.createData(req.body);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};

// Remove data employeeSystemRequest
exports.removeEmployeeSystemRequest = async (req, res, next) => {
    try {
        const result = await services.removeData(req.params.id);
        const payload = result.data ? { data: result.data } : { message: result.message }
        return msg(res, result.status, payload);
    } catch (err) {
        next(err);
    }
};