const CryptoJS = require("crypto-js");
const { msg } = require('../../utils/message');
const jwt = require("jsonwebtoken");

// สำหรับตรวจสอบสิทธิ์การเข้าใช้งาน Document API
exports.authAdminDoc = async (req, res, next) => {
    try {
        // ตรวจสอบว่ามี text ใน params หรือไม่
        const text = req.params.text;
        if (!text) {
            return msg(res, 400, { message: "กรุณาป้อนรหัสผ่าน" });
        }

        // // ถอดรหัส text
        const bytes = CryptoJS.AES.decrypt(text, process.env.PASS_KEY);
        const decryptedText = bytes.toString(CryptoJS.enc.Utf8);

        if(decryptedText != process.env.USER_KEY) return msg(res, 400, { message: 'Key ไม่ถูกต้อง!' });

        next();

    } catch (err) {
        console.error(err.message);
        return msg(res, 401, { message: "การยืนยันตัวตนล้มเหลว กรุณาตรวจสอบข้อมูลที่เข้ารหัส" });
    }
};
