const pm = require('../../config/prisma');
const db_h = require('../../config/db_h');

exports.checkNationalId = async (nationalId) => {
    return await pm.users.findUnique({ where: { national_id: nationalId }, select: { fullname_thai: true } });
};

exports.fetchCountAllData = async () => {
    const [result] = await db_h.query(`
        SELECT 
            (SELECT COUNT(*) FROM ovst WHERE vstdate = CURRENT_DATE()) as ovst_count,
            (SELECT COUNT(*) FROM opdscreen WHERE vstdate = CURRENT_DATE() AND screen_dep = '027' AND cc IS NOT NULL AND cc != '') as opdscreen_count,
            (SELECT COUNT(*) FROM er_regist WHERE vstdate = CURRENT_DATE()) as er_regist_count,
            (SELECT COUNT(*) FROM referout WHERE refer_date = CURRENT_DATE()) as refer_out_count,
            (SELECT COUNT(*) FROM referin WHERE refer_date = CURRENT_DATE()) as refer_in_count,
            (SELECT COUNT(*) FROM ipt WHERE regdate = CURRENT_DATE() AND dchdate IS NULL) as ipt_count,
            (SELECT COUNT(*) FROM health_med_service WHERE service_date = CURRENT_DATE()) as health_med_service_count,
            (SELECT COUNT(CASE WHEN vstdate = CURRENT_DATE() THEN 1 END) FROM physic_main) + (SELECT COUNT(CASE WHEN vstdate = CURRENT_DATE() THEN 1 END) FROM physic_main_ipd) AS physic_count    
    `);
    return result[0]
};

exports.fetchHnInPatient = async (nationalId) => {
    const [result] = await db_h.query(`
        SELECT hn FROM patient WHERE cid = ?    
    `, [nationalId]);

    return result[0] ? result[0].hn : null;
};

exports.fetchLastDepInOvst = async (hn) => {
    const [result] = await db_h.query(`
        SELECT 
            kskd.department 
        FROM ovst AS o 
        INNER JOIN kskdepartment AS kskd ON o.last_dep = kskd.depcode 
        WHERE 
            o.vstdate = CURDATE() AND o.hn = ?
    `, [hn]);

    return result[0] ? result[0].department : null;
};