const service = require('../../services/publicAPI/employeeSystemRequestService');
const { msg } = require('../../utils/message');

exports.getEmployeeSystemRequests = async (req, res, next) => {
    try {
        const result = service.fetchAllData();
        return msg(res, result.status, { message: result.message });
    } catch (err) {
        next(err);
    }
};