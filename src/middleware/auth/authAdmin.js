const CryptoJS = require("crypto-js");
const { msg } = require('../../utils/message');
const jwt = require("jsonwebtoken");
const pm = require('../../config/prisma');

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

// สำหรับตรวจสอบสิทธิ์การเข้าใช้งานระบบโดยทั่วไป
exports.authCheckToken = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return msg(res, 400, { message: 'ไม่มี Token ถูกส่งมา!' });

    const token = authHeader.split(' ')[1];
    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (!decoded) return msg(res, 401, { message: 'Token ไม่ถูกต้อง!' });

        const fetchOneDataBlackListToken = await pm.token_blacklist.findFirst({
            where: {
                token: token
            },
            select: {
                token_blacklist_id: true
            }
        });
        if(fetchOneDataBlackListToken) return msg(res, 401, { message: 'Tokenไม่อนุญาติให้ใช้งาน!' });

        const fetchOneDataAuthToken = await pm.auth_tokens.findFirst({
            where: {
                token: token
            },
            select: {
                otp_verified: true,
                is_active: true
            }
        });
        if(!fetchOneDataAuthToken.otp_verified) return msg(res, 401, { message: 'ไม่มีการยืนยันตัวตนด้วย OTP กรุณายืนยันตัวตนก่อนใช้งานระบบ!' }); 
        if(!fetchOneDataAuthToken.is_active) return msg(res, 401, { message: 'Tokenไม่อนุญาติให้ใช้งาน!' });

        const fetchOneDataUser = await pm.users.findFirst({
            where: {
                user_id: decoded.userId
            },
            select: {
                user_id: true,
                fullname_thai: true,
                password: true,
                status: true
            }
        });
        req.data = {
            token: token,
            expires_at: decoded.exp
        };
        
        req.user = fetchOneDataUser;

        next();

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return msg(res, 401, { message: 'TokenExpiredError!' });
        } else if (err.name === 'JsonWebTokenError') {
            return msg(res, 401, { message: 'JsonWebTokenError!' });
        }
        console.error('Error verifying token:', err);
        return msg(res, 500, { message: 'Internal Server Error!' });
    }
}

// สำหรับตรวจสอบสิทธิ์การเข้าใช้งานระบบโดยทั่วไป
exports.authCheckTokenAdmin = async (req, res, next) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return msg(res, 400, { message: 'ไม่มี Token ถูกส่งมา!' });

    const token = authHeader.split(' ')[1];
    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (!decoded) return msg(res, 401, { message: 'Token ไม่ถูกต้อง!' });

        const fetchOneDataBlackListToken = await pm.token_blacklist.findFirst({
            where: {
                token: token
            },
            select: {
                token_blacklist_id: true
            }
        });
        if(fetchOneDataBlackListToken) return msg(res, 401, { message: 'Tokenไม่อนุญาติให้ใช้งาน!' });

        const fetchOneDataAuthToken = await pm.auth_tokens.findFirst({
            where: {
                token: token
            },
            select: {
                otp_verified: true,
                is_active: true
            }
        });
        if(!fetchOneDataAuthToken.otp_verified) return msg(res, 401, { message: 'ไม่มีการยืนยันตัวตนด้วย OTP กรุณายืนยันตัวตนก่อนใช้งานระบบ!' }); 
        if(!fetchOneDataAuthToken.is_active) return msg(res, 401, { message: 'Tokenไม่อนุญาติให้ใช้งาน!' });

        const fetchOneDataUser = await pm.users.findFirst({
            where: {
                user_id: decoded.userId
            },
            select: {
                user_id: true,
                fullname_thai: true,
                password: true,
                status: true
            }
        });
        req.user = fetchOneDataUser;

        if(fetchOneDataUser.status != 'ADMIN') return(res, 403, { message: 'ไม่มีสิทธิ์การใช้งานในส่วนของระบบนี้!' });

        next();

    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return msg(res, 401, { message: 'TokenExpiredError!' });
        } else if (err.name === 'JsonWebTokenError') {
            return msg(res, 401, { message: 'JsonWebTokenError!' });
        }
        console.error('Error verifying token:', err);
        return msg(res, 500, { message: 'Internal Server Error!' });
    }
}