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
const db_b = require('../../config/db_b');
const os = require('os');

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
    try {
        res.setHeader('Content-Type', 'text/event-stream');
        res.setHeader('Cache-Control', 'no-cache');
        res.setHeader('Connection', 'keep-alive');

        await pm.notify_users.deleteMany();
  
        const maxIdResult_1 = await pm.$queryRaw`SELECT COALESCE(MAX(user_id), 0) + 1 AS nextId FROM notify_users`;
        const nextId_1 = maxIdResult_1[0].nextId_1 || 1;
  
        await pm.$executeRawUnsafe(`ALTER TABLE notify_users AUTO_INCREMENT = ${nextId_1}`);

        await pm.users.deleteMany();
  
        const maxIdResult_2 = await pm.$queryRaw`SELECT COALESCE(MAX(user_id), 0) + 1 AS nextId FROM users`;
        const nextId_2 = maxIdResult_2[0].nextId_2 || 1;
  
        await pm.$executeRawUnsafe(`ALTER TABLE users AUTO_INCREMENT = ${nextId_2}`);

        const [fetchAllDataInBackOffice] = await db_b.query(
            `
                SELECT 
                    u.email,
                    u.username,
                    u.password,
                    hpr.HR_PREFIX_NAME AS prefix_name,
                    u.name AS fullname,
                    hp.HR_EN_NAME AS fullname_eng,
                    hp.HR_CID,
                    u.status,
                    hpo.HR_POSITION_NAME AS position,
                    hdss.HR_DEPARTMENT_SUB_SUB_NAME AS department_subsub,
                    ns.service,
                    ns.chat_id
                FROM users AS u
                INNER JOIN hrd_person AS hp ON u.PERSON_ID = hp.id
                INNER JOIN hrd_prefix AS hpr ON hp.HR_PREFIX_ID = hpr.HR_PREFIX_ID
                INNER JOIN hrd_position AS hpo ON hp.HR_POSITION_ID = hpo.HR_POSITION_ID
                INNER JOIN hrd_department_sub_sub AS hdss ON hp.HR_DEPARTMENT_SUB_SUB_ID = hdss.HR_DEPARTMENT_SUB_SUB_ID
                INNER JOIN notify_user AS ns ON u.PERSON_ID = ns.person_id
                WHERE 
                    ns.service = 'telegram'
            `
        );

        if (!fetchAllDataInBackOffice || fetchAllDataInBackOffice.length === 0) {
            res.write(`data: {"status": 400, "progress": "error", "message": "ไม่สามารถ Generate User ได้เนื่องจากไม่ใช่เจ้าหน้าที่ของโรงพยาบาล!!"}\n\n`);
            return res.end();
        }

        // ** นับจำนวนทั้งหมด **
        const totalRecords = fetchAllDataInBackOffice.length;
        let currentProgress = 0;
  
        const startTime = Date.now();
        let updatedRows = 0; // นับจำนวนข้อมูลที่ถูกอัปเดตหรือเพิ่ม

        for (const u of fetchAllDataInBackOffice) {
            // ดึง prefix_id
            const fetchPrefix = await pm.prefixes.findFirst({
                where: { prefix_name: u.prefix_name },
                select: { prefix_id: true }
            });
            if (!fetchPrefix) {
                // return msg(res, 404, { message: `ไม่มีข้อมูล ${u.prefix_name} อยู่ใน Database!` });
                res.write(`data: {"status": 404, "progress": "error", "message": "ไม่มีข้อมูล ${u.prefix_name} อยู่ใน Database!"}\n\n`);
                return res.end();
            }

            // ดึง position_id
            const fetchPosition = await pm.positions.findFirst({
                where: { position_name: u.position },
                select: { position_id: true }
            });
            if (!fetchPosition) {
                res.write(`data: {"status": 404, "progress": "error", "message": "ไม่มีข้อมูล ${u.position} อยู่ใน Database!"}\n\n`);
                return res.end();
            }

            // ดึง department_id
            const fetchDepartment = await pm.departments.findFirst({
                where: { department_name: u.department_subsub },
                select: { department_id: true }
            });
            if (!fetchDepartment) {
                res.write(`data: {"status": 404, "progress": "error", "message": "ไม่มีข้อมูล ${u.department_subsub} อยู่ใน Database!"}\n\n`);
                return res.end();
            }

            // สร้างผู้ใช้ในตาราง users
            const generateUserInUsers = await pm.users.create({
                data: {
                    username: u.username,
                    email: u.email,
                    password: u.password,
                    prefix_id: fetchPrefix.prefix_id, // ใช้ค่าโดยตรง ไม่ต้องแปลงเป็น Number
                    fullname_thai: u.fullname,
                    fullname_english: u.fullname_eng,
                    national_id: u.HR_CID,
                    position_id: fetchPosition.position_id, // ใช้ค่าโดยตรง
                    department_id: fetchDepartment.department_id, // ใช้ค่าโดยตรง
                    status: u.status
                }
            });

            const fetchUserId = await pm.users.findFirst({ where: { username: u.username }, select: {user_id: true } });
            
                const generateNotifyInNotify = await pm.notify_users.create({
                    data: {
                        notify_user_service: u.service,
                        notify_user_token: u.chat_id,
                        user_id: fetchUserId.user_id,
                        created_by: os.hostname(),
                        updated_by: os.hostname()
                    }
                });

            if (generateUserInUsers) updatedRows++; // นับจำนวนที่ถูกอัปเดตหรือเพิ่ม

            // ** อัปเดต Progress และส่งข้อมูลกลับไปที่ Frontend **
            currentProgress++;
            console.log(`Syncing: ${currentProgress}/${totalRecords}`);

            res.write(`data: {"status": 200, "progress": "${currentProgress}/${totalRecords}"}\n\n`);
        }

        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง auth_log
        await pm.auth_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: os.hostname(),
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: updatedRows,  // ใช้ค่าที่สะสมไว้
                status: updatedRows > 0 ? 'Success' : 'No Data'
            }
        });

        // ** เมื่อเสร็จแล้วให้ส่งข้อความสุดท้าย และปิดการเชื่อมต่อ **
        res.write(`data: {"status": 200, "progress": "complete", "message": "Sync user data successfully!"}\n\n`);
        res.end();
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
                password: true
            }
        });
        if(!checkUsername) return msg(res, 404, { message: 'ไม่มี User นี้อยู่ในระบบกรุณา Register ก่อนใช้งานระบบขอบคุณครับ/คะ!' });

        const isMath = await bcrypt.compare(password, checkUsername.password);
        if(!isMath) return msg(res, 400, { message: 'รหัสผ่านไม่ถูกต้องกรุณาตรวจสอบรหัสผ่าน!' });

        const fullname = checkUsername.fullname_thai;
        const userId = checkUsername.user_id;

        const fetchToken = await pm.notify_users.findFirst({ where: { user_id: userId }, select: { notify_user_token: true } });

        const telegramChatId = fetchToken.notify_user_token;

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