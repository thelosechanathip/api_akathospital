const model = require('../../models/publicAPI/employeeSystemRequestModel');

exports.fetchAllData = () => {
    // const fetchAllData = model.fetchAllData();
    return {status: 200, message: 'Welcome to employeeSystemRequestService!'};
}