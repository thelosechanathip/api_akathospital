const {
    checkNationalIdOnBackOffice
} = require('../../models/auth/authModel');
const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const { msg } = require("../../utils/message");
require("dotenv").config();
const CryptoJS = require("crypto-js");
const axios = require("axios"); // เพิ่ม axios สำหรับเรียก Telegram API
const NodeCache = require("node-cache");
const otpCache = new NodeCache({ stdTTL: 300 }); // รหัส OTP หมดอายุใน 5 นาที (300 วินาที)
const moment = require('moment');
const pm = require('../../config/prisma');

// ฟังก์ชันสร้างรหัส OTP (เฉพาะตัวเลข)
const generateOtp = (identifier) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // สร้างตัวเลข 6 หลัก
    otpCache.set(identifier, otp);
    return otp;
};

// ฟังก์ชันส่งข้อความผ่าน Telegram
const sendTelegramMessage = async (chatId, otpCode) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        await axios.post(telegramApiUrl, {
            chat_id: chatId, // Chat ID ของผู้ใช้
            text: `รหัส OTP สำหรับเข้าสู่ระบบของคุณคือ: ${otpCode} รหัสจะหมดอายุภายใน 5 นาที.`,
        });
        console.log("Telegram message sent successfully");
    } catch (error) {
        console.error("Error sending Telegram message:", error.message);
        throw new Error("Failed to send Telegram message");
    }
};

// Function generate User
exports.authRegister = async (req, res) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const getTelegramApiUrl = `https://api.telegram.org/bot${botToken}/getUpdates`;
    try {
        const bytes = CryptoJS.AES.decrypt(req.body.national_id, process.env.PASS_KEY);
        const national_id = bytes.toString(CryptoJS.enc.Utf8);

        const checkNationalIdOnBackOfficeResult = await checkNationalIdOnBackOffice(national_id);
        if(!checkNationalIdOnBackOfficeResult) return msg(res, 400, { message: 'ไม่สามารถ Generate User ได้เนื่องจากไม่ใช่เจ้าหน้าที่ของโรงพยาบาล!' });
        
        const checkTelegramChatIdResult = await axios.get(getTelegramApiUrl);

        // ตัวแปรเก็บ chatId ที่ match (เก็บแค่ตัวแรกที่เจอ)
        let matchedChatId = null;

        for (const i of checkTelegramChatIdResult.data.result) {
            const chatUser = i.message.chat;
            const fullnameEnglish = chatUser.first_name + ' ' + chatUser.last_name;

            if(fullnameEnglish === checkNationalIdOnBackOfficeResult.fullname_eng) {
                const chatId = chatUser.id;

                // ถ้ายังไม่เจอ chatId ที่ match หรือยังไม่ได้เก็บ chatId ใดๆ มาก่อน
                if (matchedChatId === null) {
                    matchedChatId = chatId;
                }
            }
        }

        const checkNationalIdOnAkathospital = await pm.users.findFirst({
            where: {
                national_id: national_id
            }
        });

        // ประกาศ telegramIdAsString นอก if-else เพื่อให้อยู่ใน scope เดียวกัน
        const telegramIdAsString = matchedChatId != null ? matchedChatId.toString() : null;

        if(checkNationalIdOnAkathospital) {
            await pm.users.update({
                where: {
                    national_id: national_id
                },
                data: {
                    password: checkNationalIdOnBackOfficeResult.password,
                    prefix: checkNationalIdOnBackOfficeResult.prefix_name,
                    fullname_thai: checkNationalIdOnBackOfficeResult.fullname,
                    fullname_english: checkNationalIdOnBackOfficeResult.fullname_eng,
                    position: checkNationalIdOnBackOfficeResult.position,
                    department: checkNationalIdOnBackOfficeResult.department_subsub,
                    telegram_chat_id: telegramIdAsString,
                    status: checkNationalIdOnBackOfficeResult.status
                }
            });
            return msg(res, 200, { message: 'Update successfully!' });
        }

        await pm.users.create({
            data: {
                username: checkNationalIdOnBackOfficeResult.username,
                email: checkNationalIdOnBackOfficeResult.email,
                password: checkNationalIdOnBackOfficeResult.password,
                prefix: checkNationalIdOnBackOfficeResult.prefix_name,
                fullname_thai: checkNationalIdOnBackOfficeResult.fullname,
                fullname_english: checkNationalIdOnBackOfficeResult.fullname_eng,
                national_id: national_id,
                position: checkNationalIdOnBackOfficeResult.position,
                department: checkNationalIdOnBackOfficeResult.department_subsub,
                telegram_chat_id: telegramIdAsString,
                status: checkNationalIdOnBackOfficeResult.status
            }
        });

        return msg(res, 200, { message: 'Generate users successfully!!' });
    } catch (error) {
        console.error("Error register data:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
};

// Function Login
exports.authLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if(!username || !password) return msg(res, 400, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน!' });

        // ตรวจสอบ Username
        const checkUsername = await pm.users.findFirst({
            where: {
                username: username
            },
            select: {
                user_id: true,
                fullname_thai: true,
                password: true,
                telegram_chat_id: true
            }
        });
        if(!checkUsername) return msg(res, 404, { message: 'ไม่มี User นี้อยู่ในระบบกรุณา Register ก่อนใช้งานระบบขอบคุณครับ/คะ!' });

        const isMath = await bcrypt.compare(password, checkUsername.password);
        if(!isMath) return msg(res, 400, { message: 'รหัสผ่านไม่ถูกต้องกรุณาตรวจสอบรหัสผ่าน!' });

        if(!checkUsername.telegram_chat_id) return msg(res, 400, { message: 'ไม่มี telegramChatId อยู่ใน User ของท่านกรุณาติดต่อ Admin เพื่อทำการเพิ่มข้อมูลก่อนใช้งานระบบ!' });
        
        const fullname = checkUsername.fullname_thai;
        const userId = checkUsername.user_id;
        const telegramChatId = checkUsername.telegram_chat_id;

        const token = await jwt.sign(
            { userId, telegramChatId, expiresIn: "1h" },
            process.env.SECRET_KEY,
            { expiresIn: "1h" }
        );

        // สร้างและส่ง OTP ไปยัง Telegram
        const otpCode = generateOtp(telegramChatId);
        await sendTelegramMessage(telegramChatId, otpCode); // ส่ง OTP ไปยัง Telegram
        if (token) {
            try {
                const dataToken = await jwt.verify(token, process.env.SECRET_KEY);
                const exp = new Date(dataToken.exp * 1000); // คูณ 1000 เพราะ timestamp เป็นวินาที แต่ Date ใช้มิลลิวินาที

                const startTime = Date.now();
                const insertDataToauthToken = await pm.auth_tokens.create({
                    data: {
                        token: token,
                        user_id: userId,
                        expires_at: exp
                    }
                });
                const endTime = Date.now() - startTime;

                // บันทึกข้อมูลไปยัง auth_log
                await pm.auth_log.create({
                    data: {
                        ip_address: req.headers['x-forwarded-for'] || req.ip,
                        name: fullname,
                        request_method: req.method,
                        endpoint: req.originalUrl,
                        execution_time: endTime,
                        row_count: insertDataToauthToken ? 1 : 0,
                        status: insertDataToauthToken ? 'Login success' : 'Login failed'
                    }
                });

                if(insertDataToauthToken) return msg(res, 200, { token: token });
            } catch (err) {
                console.error("Error token:", err.message);
                return msg(res, 500, { message: "Internal Server Error" });
            }
        }
    } catch (error) {
        console.error("Error login data:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
};

// ฟังก์ชันยืนยัน OTP
exports.authVerifyOtp = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return msg(res, 401, { message: 'ไม่มี Token ถูกส่งมา' });

    const token = authHeader.split(' ')[1];

    try {
        // Verify token
        const decoded = jwt.verify(token, process.env.SECRET_KEY);
        if (!decoded) return msg(res, 401, { message: 'Token ไม่ถูกต้อง' });

        const { otpCode } = req.body;
        const chatId = decoded.telegramChatId; // ดึง chatId จาก decoded
        if (!chatId) return msg(res, 401, { message: 'ไม่มี Chat ID ใน Token' });

        // ตรวจสอบ OTP ที่กรอกเข้ามาว่าถูกต้องหรือไม่
        const cachedOtp = otpCache.get(chatId); // ใช้ chatId จาก decoded
        if (!cachedOtp) return msg(res, 400, { message: "OTP หมดอายุหรือไม่ถูกต้อง" });

        if (cachedOtp === otpCode) {
            const userId = decoded.userId;
            const fetchOneUserData = await pm.users.findFirst({
                where: {
                    user_id: Number(userId)
                },
                select: {
                    fullname_thai: true
                }
            });
            const fullname = fetchOneUserData.fullname_thai;

            // OTP ถูกต้อง, อาจจะทำการสร้าง JWT หรือทำงานต่อ
            const startTime = Date.now();
            const updateData = await pm.auth_tokens.update({
                where: {
                    token: token
                },
                data: {
                    otp_verified: true
                }
            });
            const endTime = Date.now() - startTime;

            // บันทึกข้อมูลไปยัง auth_log
            await pm.auth_log.create({
                data: {
                    ip_address: req.headers['x-forwarded-for'] || req.ip,
                    name: fullname,
                    request_method: req.method,
                    endpoint: req.originalUrl,
                    execution_time: endTime,
                    row_count: updateData ? 1 : 0,
                    status: updateData ? 'Verify OTP successfully' : 'Verify OTP failed'
                }
            });

            return msg(res, 200, { message: "Login successfully!" });
        } else {
            return msg(res, 400, { message: "OTP ไม่ถูกต้อง" });
        }
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            return msg(res, 401, { message: 'TokenExpiredError!' });
        } else if (err.name === 'JsonWebTokenError') {
            return msg(res, 401, { message: 'JsonWebTokenError!' });
        }
        console.error('Error verifyToken :', err);
        return msg(res, 500, { message: 'Internal Server Error!' });
    }
};

// Function ยืนยันตัวตนด้วย Token
exports.authVerifyToken = async (req, res) => {
    try {
        const startTime = Date.now();
        const fetchOneDataUser = await pm.users.findFirst({
            where: {
                user_id: Number(req.user.user_id)
            },
            select: {
                fullname_thai: true,
                fullname_english: true,
                position: true,
                department: true,
                status: true
            }
        });
        const endTime = Date.now() - startTime;
        if(!fetchOneDataUser) return msg(res, 404, { message: 'Data not found!' });

        const fullname = fetchOneDataUser.fullname_thai;

        // บันทึกข้อมูลไปยัง auth_log
        await pm.auth_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: fetchOneDataUser ? 1 : 0,
                status: fetchOneDataUser ? 'Verify Token successfully' : 'Verify Token failed'
            }
        });

        return msg(res, 200, { data: fetchOneDataUser });
    } catch (error) {
        console.error("Error verify OTP:", error.message);
        return msg(res, 500, { message: "Internal Server Errors" });
    }
};

// Function สำหรับ Remove User ออกจาก Database => medical_record_audit
exports.authRemoveUser = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        const { password } = req.body;

        if(!password) return msg(res, 400, { message: 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบข้อมูล!' });

        if(id === req.user.user_id) return msg(res, 400, { message: "ไม่สามารถลบ User ตัวเราเองในขณะที่อยู่ในระบบได้!" });

        const fetchOneDataUser = await pm.users.findFirst({
            where: {
                user_id: req.user.user_id,
            },
            select: {
                user_id: true,
                fullname_thai: true
            }
        });
        if(!fetchOneDataUser) return msg(res, 404, { message: "ไม่มี User นี้ในระบบกรุณาตรวจสอบ!!" });

        const isMath = await bcrypt.compare(password, req.user.password);
        if (!isMath) return msg(res, 400, "รหัสผ่านไม่ถูกต้อง!");

        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const removeData = await pm.users.delete({
            where: {
                user_id: id
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง auth_log
        await pm.auth_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: removeData ? 1 : 0,
                status: removeData ? 'Remove successfully' : 'Remove failed'
            }
        });

        // ดึงค่า MAX(user_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(user_id), 0) + 1 AS nextId FROM users`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE users AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'ลบข้อมูลเสร็จสิ้น!' });
        
    } catch (err) {
        console.error(err.message);
        return msg(res, 500, 'Internel server errors');
    }
};

// Function สำหรับการ Logout ออกจากระบบ
exports.authLogout = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const exp = new Date(req.data.expires_at * 1000); // คูณ 1000 เพราะ timestamp เป็นวินาที แต่ Date ใช้มิลลิวินาที
        const addDataTokenBlackList = await pm.token_blacklist.create({
            data: {
                token: req.data.token,
                expires_at: exp
            }
        });
        if(!addDataTokenBlackList) return msg(res, 400, { message: 'เกิดข้อผิดพลาดระหว่างการทำงานกรุณาติดต่อ Admin ของระบบ!' });

        const startTime = Date.now();
        const updateDataAuthToken = await pm.auth_tokens.update({
            where: {
                token: req.data.token
            },
            data: {
                is_active: false
            }
        });
        if(!updateDataAuthToken) return msg(res, 400, { message: 'เกิดข้อผิดพลาดระหว่างการทำงานกรุณาติดต่อ Admin ของระบบ!' });

        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง auth_log
        await pm.auth_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: updateDataAuthToken ? 1 : 0,
                status: updateDataAuthToken ? 'Logout successfuly' : 'Logout failed'
            }
        });

        return msg(res, 200, { message: "Logout successfully!" });
    } catch (err) {
        console.error('Error verifying token:', err);
        return msg(res, 500, 'Internal Server Error');
    }
};