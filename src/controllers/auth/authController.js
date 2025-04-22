const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const { msg } = require("../../utils/message");
require("dotenv").config();
const CryptoJS = require("crypto-js");
const moment = require('moment');
const pm = require('../../config/prisma');
const db_b = require('../../config/db_b');
const os = require('os');
const axios = require("axios"); // เพิ่ม axios สำหรับเรียก Telegram API
const NodeCache = require("node-cache");
const otpCache = new NodeCache({ stdTTL: 300 }); // รหัส OTP หมดอายุใน 5 นาที (300 วินาที)
const { isBase64Png } = require('../../utils/allCheck');
const sharp = require('sharp');

// Generate OTP
const generateOtp = async (identifier) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // สร้างตัวเลข 6 หลัก
    otpCache.set(identifier, otp);
    return otp;
};

// Send Message To Application Telegram
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
        const bytes = CryptoJS.AES.decrypt(req.body.national_id, process.env.PASS_KEY);
        const national_id = bytes.toString(CryptoJS.enc.Utf8);

        const fetchUser = await pm.users.findFirst({
            where: { national_id: national_id },
            select: { user_id: true }
        });
        if (fetchUser) return msg(res, 404, { message: `มีข้อมูล ${national_id} อยู่ในระบบแล้ว!` });

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
                    AND hp.HR_CID = ?
            `,
            [national_id]
        );

        if (!fetchAllDataInBackOffice || fetchAllDataInBackOffice.length === 0) return msg(res, 404, { message: 'ไม่ใช่เจ้าหน้าที่ภายในโรงพยาบาลหรือไม่มีข้อมูลในระบบ BackOffice!' });

        const fetchPrefix = await pm.prefixes.findFirst({
            where: { prefix_name: fetchAllDataInBackOffice[0].prefix_name },
            select: { prefix_id: true }
        });
        if (!fetchPrefix) return msg(res, 404, { message: `ไม่มีข้อมูล ${fetchAllDataInBackOffice[0].prefix_name} อยู่ใน Database!` });

        const fetchPosition = await pm.positions.findFirst({
            where: { position_name: fetchAllDataInBackOffice[0].position },
            select: { position_id: true }
        });
        if (!fetchPosition) return msg(res, 404, { message: `ไม่มีข้อมูล ${fetchAllDataInBackOffice[0].position} อยู่ใน Database!` });

        const fetchDepartment = await pm.departments.findFirst({
            where: { department_name: fetchAllDataInBackOffice[0].department_subsub },
            select: { department_id: true }
        });
        if (!fetchDepartment) return msg(res, 404, { message: `ไม่มีข้อมูล ${fetchAllDataInBackOffice[0].department_subsub} อยู่ใน Database!` });

        const startTime = Date.now();
        const generateUserInUsers = await pm.users.create({
            data: {
                username: fetchAllDataInBackOffice[0].username,
                email: fetchAllDataInBackOffice[0].email,
                password: fetchAllDataInBackOffice[0].password,
                prefix_id: fetchPrefix.prefix_id, // ใช้ค่าโดยตรง ไม่ต้องแปลงเป็น Number
                fullname_thai: fetchAllDataInBackOffice[0].fullname,
                fullname_english: fetchAllDataInBackOffice[0].fullname_eng,
                national_id: fetchAllDataInBackOffice[0].HR_CID,
                position_id: fetchPosition.position_id, // ใช้ค่าโดยตรง
                department_id: fetchDepartment.department_id, // ใช้ค่าโดยตรง
                status: fetchAllDataInBackOffice[0].status
            }
        });

        if (generateUserInUsers) {
            const fetchUserId = await pm.users.findFirst({
                where: { national_id: fetchAllDataInBackOffice[0].HR_CID }, select: { user_id: true }
            });
            const generateNotify = await pm.notify_users.upsert({
                where: { user_id: Number(fetchUserId.user_id) },
                update: {
                    notify_user_service: fetchAllDataInBackOffice[0].service,
                    notify_user_token: fetchAllDataInBackOffice[0].chat_id,
                    updated_by: os.hostname()
                },
                create: {
                    notify_user_service: fetchAllDataInBackOffice[0].service,
                    notify_user_token: fetchAllDataInBackOffice[0].chat_id,
                    user_id: fetchUserId.user_id,
                    created_by: os.hostname(),
                    updated_by: os.hostname()
                }
            });
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
                row_count: generateUserInUsers ? 1 : 0,
                status: generateUserInUsers ? 'Success' : 'Failed'
            }
        });

        return msg(res, 200, { message: 'Generate user successfully!' });
    } catch (err) {
        console.log('authRegister : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function Login
exports.authLogin = async (req, res) => {
    try {
        const { username, password } = req.body;

        if (!username || !password) return msg(res, 400, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน!' });

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
        if (!checkUsername) return msg(res, 404, { message: 'ไม่มี User นี้อยู่ในระบบกรุณา Register ก่อนใช้งานระบบขอบคุณครับ/คะ!' });

        const isMath = await bcrypt.compare(password, checkUsername.password);
        if (!isMath) return msg(res, 400, { message: 'รหัสผ่านไม่ถูกต้องกรุณาตรวจสอบรหัสผ่าน!' });

        const fullname = checkUsername.fullname_thai;
        const userId = checkUsername.user_id;

        const fetchToken = await pm.notify_users.findFirst({ where: { user_id: userId }, select: { notify_user_token: true } });

        const telegramChatId = fetchToken.notify_user_token;

        const token = await jwt.sign(
            { userId, telegramChatId, expiresIn: "8h" },
            process.env.SECRET_KEY,
            { expiresIn: "8h" }
        );

        // สร้างและส่ง OTP ไปยัง Telegram
        const otpCode = await generateOtp(telegramChatId);
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

                if (insertDataToauthToken) return msg(res, 200, { token: token });
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
        console.log(cachedOtp);
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
                // Fields from users table
                email: true,
                prefixes: { select: { prefix_id: true, prefix_name: true } },
                fullname_thai: true,
                fullname_english: true,
                status: true,
                // Relations
                positions: { select: { position_id: true, position_name: true } },
                departments: { select: { department_id: true, department_name: true } }
            }
        });
        const endTime = Date.now() - startTime;
        if (!fetchOneDataUser) return msg(res, 404, { message: 'Data not found!' });

        let status = false;
        const fetchSignature = await pm.signature_users.findFirst({
            where: { user_id: Number(req.user.user_id) },
            select: { signature_user_id: true, expired: true }
        });
        if (fetchSignature) {
            const currentDate = moment().format('YYYY-MM-DD HH:mm:ss');
            const expired = moment(fetchSignature.expired).format('YYYY-MM-DD HH:mm:ss');

            if (currentDate <= expired) {
                status = true;
            } else {
                await pm.signature_users.delete({
                    where: { signature_user_id: fetchSignature.signature_user_id }
                });

                // ดึงค่า MAX(signature_user_id)
                const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(signature_user_id), 0) + 1 AS nextId FROM signature_users`;

                // รีเซ็ตค่า AUTO_INCREMENT
                await pm.$executeRawUnsafe(`ALTER TABLE signature_users AUTO_INCREMENT = ${maxIdResult[0].nextId}`);
            }
        }
        fetchOneDataUser.signature_status = status;

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

// Function Generate Signature
exports.generateSignature = async (req, res) => {
    try {
        const { signature_user_token } = req.body;
        if (!signature_user_token) return msg(res, 200, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน!' });
        if (!isBase64Png(signature_user_token)) return msg(res, 400, { message: `${signature_user_token} ไม่ใช่รูปแบบ PNG base64 ที่ถูกต้อง` });

        const dateNow = moment(); // Current date
        const futureDate = dateNow.add(2, 'years'); // Add 2 years for expiration
        const fullname = req.user.fullname_thai;

        // Remove the data URI prefix if it exists
        const base64String = signature_user_token.replace(/^data:image\/\w+;base64,/, '');

        const startTime = Date.now();
        const generateSignature = await pm.signature_users.upsert({
            where: { user_id: req.user.user_id },
            update: {
                signature_user_token: base64String, // Use the cleaned base64 string
                expired: futureDate.toDate(), // Convert moment object to JS Date
                updated_by: fullname
            },
            create: {
                signature_user_token: base64String, // Use the cleaned base64 string
                user_id: req.user.user_id,
                expired: futureDate.toDate(), // Convert moment object to JS Date
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.signature_users_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: generateSignature ? 1 : 0,
                status: generateSignature ? 'Success' : 'Failed'
            }
        });

        return msg(res, 200, { message: 'Generate signature successfully!' });
    } catch (error) {
        console.error("Error generateSignature:", error.message);
        return msg(res, 500, { message: "Internal Server Errors" });
    }
};

// Function สำหรับ Fetch Signature ที่เป็นรูปภาพไปให้ FrontEnd
exports.fetchSignature = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const fetchSignature = await pm.signature_users.findUnique({
            where: { user_id: userId },
            select: { signature_user_token: true }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง signature_users_log
        await pm.signature_users_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: fetchSignature ? 1 : 0,
                status: fetchSignature ? 'Success' : 'No Data'
            }
        });

        if (!fetchSignature || !fetchSignature.signature_user_token) return msg(res, 404, { message: "Signature not found" });

        const resizedImage = await sharp(fetchSignature.signature_user_token)
            .resize(1000)  // ปรับขนาดความกว้างของภาพเป็น 1000px
            .sharpen()  // เพิ่มความชัดให้กับภาพ
            .toBuffer();  // เปลี่ยนเป็น buffer ที่สามารถส่งกลับไปได้

        // ตั้งค่า Content-Type เป็น image/jpeg หรือ image/png ขึ้นอยู่กับประเภทของภาพ
        res.setHeader('Content-Type', 'image/jpeg');  // หรือ 'image/png' ขึ้นอยู่กับประเภทของภาพ
        res.send(resizedImage);  // ส่งภาพที่มีขนาดใหม่ไปยัง Client
    } catch (error) {
        console.error("Error fetchSignature:", error.message);
        return msg(res, 500, { message: "Internal Server Errors" });
    }
};

// Function สำหรับ Fetch Image ที่เป็นรูปภาพไปให้ FrontEnd
exports.fetchImage = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const fullname = req.user.fullname_thai;

        // วัดเวลาการดึงข้อมูล
        const start = Date.now();
        const record = await pm.users.findUnique({
            where: { user_id: userId },
            select: { image: true }
        });
        const execTime = Date.now() - start;

        // บันทึก log
        await pm.auth_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: execTime,
                row_count: record && record.image ? 1 : 0,
                status: record && record.image ? 'Success' : 'No Data'
            }
        });

        if (!record || !record.image) {
            return msg(res, 404, { message: "Image not found" });
        }

        const buf = record.image;
        const image = sharp(buf);
        const meta = await image.metadata();
        let outBuffer;

        switch (meta.format) {
            case 'gif':
                // ไม่ resize เพื่อรักษา animation
                outBuffer = buf;
                break;
            case 'jpeg':
            case 'jpg':
            case 'png':
                // resize + sharpen
                outBuffer = await image
                    .resize({ width: 1000 })
                    .sharpen()
                    .toBuffer();
                break;
            default:
                // กรณีอื่น ๆ ส่งเดิมไปก่อน
                outBuffer = buf;
        }

        // map 'jpg' -> 'jpeg' สำหรับ Content-Type
        const fmt = meta.format === 'jpg' ? 'jpeg' : meta.format;
        res.setHeader('Content-Type', `image/${fmt}`);
        return res.send(outBuffer);

    } catch (err) {
        console.error("Error fetchImage:", err);
        return msg(res, 500, { message: "Internal Server Error" });
    }
};

// Function ในการแก้ไขข้อมูลของผู้ใช้งานระบบ
exports.editUser = async (req, res) => {
    try {
        const userId = req.user.user_id;
        const fullname = req.user.fullname_thai;
        const { image, position_id, department_id, ...userData } = req.body;

        if (!isBase64Png(userData.image)) return msg(res, 400, { message: `${image} ไม่ใช่รูปแบบ PNG base64 ที่ถูกต้อง` });

        // Remove the data URI prefix if it exists
        const base64String = image.replace(/^data:image\/\w+;base64,/, '');

        const payload = {
            ...userData,
            positions: { connect: { position_id: Number(position_id) } },
            departments: { connect: { department_id: Number(department_id) } },
            image: base64String
        }

        const startTime = Date.now();
        const editData = await pm.users.update({
            where: { user_id: Number(userId) },
            data: { ...payload }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.auth_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: editData ? 1 : 0,
                status: editData ? 'Success' : 'Failed'
            }
        });

        return msg(res, 200, { message: 'Edit user successfully!' });
    } catch (error) {
        console.error("Error editUser:", error.message);
        return msg(res, 500, { message: "Internal Server Errors" });
    }
};

// Function Remove User
exports.removeUser = async (req, res) => {
    try {
        const id = parseInt(req.params.id);
        if (id === req.user.user_id) return msg(res, 400, { message: 'ไม่สามารถลบ User ตัวเองได้!' });

        const { password } = req.body;
        if (!password) return msg(res, 400, { message: 'กรุณากรอกรหัสผ่านเพื่อยืนยันการลบข้อมูล!' });

        const fullname = req.user.fullname_thai;

        const fetchPassword = await pm.users.findFirst({
            where: { user_id: req.user.user_id },
            select: { password: true }
        });
        if (!fetchPassword) return msg(res, 404, { message: 'ไม่มี User นี้ในระบบกรุณาตรวจสอบ!' });

        const isMath = await bcrypt.compare(password, fetchPassword.password);
        if (!isMath) return msg(res, 400, { message: 'รหัสผ่านไม่ถูกต้องกรุณาตรวจสอบรหัสผ่าน!' });

        // Check Table signature_users AND Remove Data
        const fetchSignature = await pm.signature_users.findFirst({
            where: { user_id: id },
            select: { signature_user_id: true }
        });
        if (fetchSignature) {
            const startTime = Date.now();
            const removeSignature = await pm.signature_users.delete({
                where: { signature_user_id: fetchSignature.signature_user_id }
            });
            const endTime = Date.now() - startTime;

            // บันทึก Log
            await pm.signature_users_log.create({
                data: {
                    ip_address: req.headers['x-forwarded-for'] || req.ip,
                    name: fullname,
                    request_method: req.method,
                    endpoint: req.originalUrl,
                    execution_time: endTime,
                    row_count: removeSignature ? 1 : 0,
                    status: removeSignature ? 'Success' : 'Failed'
                }
            });

            // ดึงค่า MAX(signature_user_id)
            const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(signature_user_id), 0) + 1 AS nextId FROM signature_users`;

            // รีเซ็ตค่า AUTO_INCREMENT
            await pm.$executeRawUnsafe(`ALTER TABLE signature_users AUTO_INCREMENT = ${maxIdResult[0].nextId}`);
        }

        // Check Table notify_users AND Remove Data
        const fetchNotify = await pm.notify_users.findFirst({
            where: { user_id: id },
            select: { notify_user_id: true }
        });
        if (fetchNotify) {
            const startTime = Date.now();
            const removeNotifyUser = await pm.notify_users.delete({
                where: { notify_user_id: fetchNotify.notify_user_id }
            });
            const endTime = Date.now() - startTime;

            // บันทึก Log
            await pm.notify_users_log.create({
                data: {
                    ip_address: req.headers['x-forwarded-for'] || req.ip,
                    name: fullname,
                    request_method: req.method,
                    endpoint: req.originalUrl,
                    execution_time: endTime,
                    row_count: removeNotifyUser ? 1 : 0,
                    status: removeNotifyUser ? 'Success' : 'Failed'
                }
            });

            // ดึงค่า MAX(notify_user_id)
            const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(notify_user_id), 0) + 1 AS nextId FROM notify_users`;

            // รีเซ็ตค่า AUTO_INCREMENT
            await pm.$executeRawUnsafe(`ALTER TABLE notify_users AUTO_INCREMENT = ${maxIdResult[0].nextId}`);
        }

        // ตรวจสอบว่ามี Foreign Key หรือไม่
        const checkForeignKey = await pm.$queryRaw`
            SELECT TABLE_NAME, COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_NAME = 'users'
            AND REFERENCED_COLUMN_NAME = 'user_id'
            AND EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = KEY_COLUMN_USAGE.TABLE_NAME
            )
        `;

        if (checkForeignKey.length > 0) {
            let hasReference = false;
            let referencedTables = [];

            // ตรวจสอบแต่ละตารางว่ามีข้อมูลอ้างอิงอยู่หรือไม่
            for (const row of checkForeignKey) {
                const tableName = row.TABLE_NAME;
                const columnName = row.COLUMN_NAME;

                const checkData = await pm.$queryRawUnsafe(`
                    SELECT 1 FROM ${tableName} WHERE ${columnName} = ${Number(req.params.id)} LIMIT 1
                `);

                if (checkData.length > 0) {
                    hasReference = true;
                    referencedTables.push(tableName);
                }
            }

            // ถ้ามีตารางที่อ้างอิงอยู่ → ห้ามลบ
            if (hasReference) {
                return msg(res, 400, {
                    message: `ไม่สามารถลบได้ เนื่องจาก user_id ถูกใช้งานอยู่ในตาราง: ${referencedTables.join(', ')} กรุณาลบข้อมูลที่เกี่ยวข้องก่อน!`
                });
            }
        }

        const startTime = Date.now();
        const removeUser = await pm.users.delete({
            where: { user_id: id }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.auth_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: removeUser ? 1 : 0,
                status: removeUser ? 'Success' : 'Failed'
            }
        });

        // ดึงค่า MAX(user_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(user_id), 0) + 1 AS nextId FROM users`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE users AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { data: 'Remove user successfully!' });

    } catch (error) {
        console.error("Error removeUser:", error.message);
        return msg(res, 500, { message: "Internal Server Errors" });
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
        if (!addDataTokenBlackList) return msg(res, 400, { message: 'เกิดข้อผิดพลาดระหว่างการทำงานกรุณาติดต่อ Admin ของระบบ!' });

        const startTime = Date.now();
        const updateDataAuthToken = await pm.auth_tokens.update({
            where: {
                token: req.data.token
            },
            data: {
                is_active: false
            }
        });
        if (!updateDataAuthToken) return msg(res, 400, { message: 'เกิดข้อผิดพลาดระหว่างการทำงานกรุณาติดต่อ Admin ของระบบ!' });

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