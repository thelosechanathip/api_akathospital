const db = require('../../config/prisma');
const { msg } = require('../../utils/message');

exports.getAlldataComplaints = async (req, res) => {
    try {

    } catch(err) {
        console.log(err);
        return msg(res, 500, { message: err.message });
    }
}