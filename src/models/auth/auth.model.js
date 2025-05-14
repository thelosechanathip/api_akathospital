const db_b = require('../../config/db_b');

exports.checkNationalIdOnBackOffice = async (national_id) => {
    try {
        const [result] = await db_b.query(
            `
                SELECT 
                    u.email,
                    u.username,
                    u.password,
                    hpr.HR_PREFIX_NAME AS prefix_name,
                    u.name AS fullname,
                    hp.HR_EN_NAME AS fullname_eng,
                    u.status,
                    hpo.HR_POSITION_NAME AS position,
                    hdss.HR_DEPARTMENT_SUB_SUB_NAME AS department_subsub
                FROM users AS u
                INNER JOIN hrd_person AS hp ON u.PERSON_ID = hp.id
                INNER JOIN hrd_prefix AS hpr ON hp.HR_PREFIX_ID = hpr.HR_PREFIX_ID
                INNER JOIN hrd_position AS hpo ON hp.HR_POSITION_ID = hpo.HR_POSITION_ID
                INNER JOIN hrd_department AS hd ON hp.HR_DEPARTMENT_ID = hd.HR_DEPARTMENT_ID
                INNER JOIN hrd_department_sub AS hds ON hp.HR_DEPARTMENT_SUB_ID = hds.HR_DEPARTMENT_SUB_ID
                INNER JOIN hrd_department_sub_sub AS hdss ON hds.HR_DEPARTMENT_SUB_ID = hdss.HR_DEPARTMENT_SUB_ID
                WHERE hp.HR_CID = ?
                LIMIT 1
            `,
            [national_id]
        );

        if (result.length > 0) {
            return result[0];
        } else {
            return false;
        }
    } catch (err) {
        console.error("Database error:", err.message);
        throw new Error("Failed to checkNationalIdOnBackOffice");
    }
};