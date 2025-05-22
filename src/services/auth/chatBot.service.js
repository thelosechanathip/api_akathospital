const models = require('../../models/auth/chatBot.model');

exports.hosxpSystem = async (nationalId) => {
    try {
        const checkNationalId = await models.checkNationalId(nationalId);
        if (!checkNationalId) return `คุณไม่ใช่เจ้าหน้าที่โรงพยาบาลไม่สามารถใช้งานได้ ขอบคุณครับ/คะ`;

        let userMessage = `ยินดีต้อนรับคุณ: "${checkNationalId.fullname_thai}" \n`;
        userMessage += `พิมพ์ตัวเลขด้านหน้าเพื่อเลือกรายการ: \n`;
        userMessage += `1: จำนวนค้นไข้ที่มารับบริการ \n`;
        userMessage += `0: ออกจากระบบ HoSXP \n`;

        return userMessage;
    } catch (err) {
        console.error(err);
    }
};

exports.fetchCountPatient = async () => {
    try {
        const resCount = await models.fetchCountAllData();

        let message = `1. จำนวนคนไข้ที่มารับบริการทั้งหมดภายในวันนี้มีจำนวน ${resCount.ovst_count} Visit \n`
        message += `    1.1. จำนวนคนไข้ที่มารับบริการจุด OPD ทั้งหมดภายในวันนี้มีจำนวน ${resCount.opdscreen_count} Visit \n`
        message += `    1.2. จำนวนคนไข้ที่มารับบริการจุด ER ทั้งหมดภายในวันนี้มีจำนวน ${resCount.er_regist_count} Visit \n`
        message += `    1.3. จำนวนคนไข้ที่ ReferOut ทั้งหมดภายในวันนี้มีจำนวน ${resCount.refer_out_count} Visit \n`
        message += `    1.4. จำนวนคนไข้ที่ ReferIn ทั้งหมดภายในวันนี้มีจำนวน ${resCount.refer_in_count} Visit \n`
        message += `    1.5. จำนวนคนไข้ที่ Admit ทั้งหมดภายในวันนี้มีจำนวน ${resCount.ipt_count} Visit \n`
        message += `    1.6. จำนวนคนไข้ที่มารับบริการ แพทย์แผนไทย ทั้งหมดภายในวันนี้มีจำนวน ${resCount.health_med_service_count} Visit \n`
        message += `    1.7. จำนวนคนไข้ที่มารับบริการ กายภาพบำบัด ทั้งหมดภายในวันนี้มีจำนวน ${resCount.physic_count} Visit \n`
        return message;
    } catch (err) {
        console.error(err);
    }
};

exports.checkQueue = async (nationalId) => {
    try {
        const patientHn = await models.fetchHnInPatient(nationalId);
        if(patientHn === null) return `คุณไม่มีข้อมูลภายในระบบของโรงพยาบาลอากาศอำนวย ขอบคุณครับ/คะ`;

        const resLastDep = await models.fetchLastDepInOvst(patientHn);
        if(resLastDep === null) return `คุณไม่ได้มารับบริการในวันนี้ ขอบคุณครับ/คะ`;

        return resLastDep;
    } catch (err) {
        console.error(err);
    }
};