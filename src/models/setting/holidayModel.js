const db_h = require('../../config/db_h');
const moment = require("moment");

exports.fetchAllDataHolidyOnHoSXP = async () => {
    try {
        const date = new Date();
        const dateNow = moment(date).format('YYYY');

        const [result] = await db_h.query('SELECT day_name, holiday_date FROM holiday WHERE YEAR(holiday_date) = ?', [dateNow]);

        if (result.length > 0) {
            return result;
        } else {
            return false;
        }
    } catch (err) {
        console.error("Database error:", err.message);
        throw new Error("Failed to fetchAllDataHolidyOnHoSXP");
    }
}