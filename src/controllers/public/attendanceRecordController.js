const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const { msg } = require("../../utils/message");
const { blobToBase64 } = require("../../utils/allCheck");
require("dotenv").config();
const CryptoJS = require("crypto-js");
const axios = require("axios"); // เพิ่ม axios สำหรับเรียก Telegram API
const NodeCache = require("node-cache");
const otpCache = new NodeCache({ stdTTL: 30 }); // รหัส OTP หมดอายุใน 20 วินาที
const moment = require('moment');
const pm = require('../../config/prisma');
const sharp = require('sharp');

// Function สร้างรหัส OTP (เฉพาะตัวเลข)
const generateOtp = (identifier) => {
    const otp = Math.floor(100000 + Math.random() * 900000).toString(); // สร้างตัวเลข 6 หลัก
    otpCache.set(identifier, otp);
    return otp;
};

// Function ส่งข้อความผ่าน Telegram
const sendTelegramMessage = async (chatId, otpCode) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        await axios.post(telegramApiUrl, {
            chat_id: chatId, // Chat ID ของผู้ใช้
            text: `รหัส OTP สำหรับลงเวลาเข้าทำงานของคุณคือ: ${otpCode} รหัสจะหมดอายุภายใน 20 วินาที.`,
        });
        console.log("Telegram message sent successfully");
    } catch (error) {
        console.error("Error sending Telegram message:", error.message);
        throw new Error("Failed to send Telegram message");
    }
};

// Function ในการแสดง Signature ที่เป็น Image
exports.getSignatureImage = async (req, res) => {
    try {
        const { signature_id } = req.params;

        if (!signature_id || isNaN(signature_id)) {
            return res.status(400).json({ message: 'signature_id ไม่ถูกต้องหรือไม่ได้ระบุ' });
        }

        const signture = await pm.signature_users.findUnique({
            where: { signature_user_id: parseInt(signature_id) }
        });

        if (!signture || !signture.signature_user_token) {
            return res.status(404).json({ message: 'ไม่พบภาพหรือข้อมูลที่เกี่ยวข้อง!' });
        }

        const resizedImage = await sharp(signture.signature_user_token)
            .resize(1000)
            .sharpen()
            .toBuffer();

        res.setHeader('Content-Type', 'image/jpeg');
        res.send(resizedImage);
    } catch (err) {
        console.error('Error getSignatureImage: ', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงภาพ' });
    }
};

// Function ในการ Fetch ข้อมูลทั้งหมด
exports.fetchDataAllAttendanceRecord = async (req, res) => {
    try {
        // คำนวณวันที่เริ่มต้นและสิ้นสุดของเดือนปัจจุบัน
        // สร้างวันเริ่มต้นและวันสิ้นสุดของวันนี้
        const startOfDay = moment().startOf('day').toDate();   // ex. 2025-03-20T00:00:00.000Z
        const endOfDay = moment().endOf('day').toDate();     // ex. 2025-03-20T23:59:59.999Z

        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.attendance_records.findMany({
            where: {
                created_at: {
                    gte: startOfDay,
                    lte: endOfDay
                }
            },
            select: {
                attendance_record_id: true,
                users: {
                    select: {
                        prefixes: { select: { prefix_name: true } },
                        fullname_thai: true
                    }
                },
                shift_types: { select: { shift_type_name: true } },
                shifts: { select: { shift_name: true } },
                starting: true,
                starting_signature_id: true,
                check_in_status: { select: { check_in_status_name: true } },
                ending: true,
                ending_signature_id: true,
                check_out_status: { select: { check_out_status_name: true } },
                location_lat_start: true,
                location_lon_start: true,
                desc_start: true,
                location_lat_end: true,
                location_lon_end: true,
                desc_end: true, 
                created_at: true,
                created_by: true,
                updated_at: true,
                updated_by: true
            }
        });
        const endTime = Date.now() - startTime;

        const resultWithImageUrl = resultData.map((attendanceRecord) => {
            const startImageBlobUrl = `/signatureShowImage/${attendanceRecord.starting_signature_id}`;
            const endImageBlobUrl = `/signatureShowImage/${attendanceRecord.ending_signature_id}`;
            return {
                ...attendanceRecord,
                starting_signature: startImageBlobUrl,
                ending_signature: endImageBlobUrl
            }
        });

        // บันทึกข้อมูลไปยัง attendance_records_log
        await pm.attendance_records_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: resultData.length,
                status: resultData.length > 0 ? 'Fetch data success' : 'No Data'
            }
        });

        if (resultData.length === 0) return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });

        return msg(res, 200, { data: resultWithImageUrl });
    } catch (error) {
        console.error("Error fetchDataAllAttendanceRecord:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
};

// Function สำหรับการค้นหาด้วยวันที่
exports.searchDateAttendanceRecord = async (req, res) => {
    try {
        const { date_start, date_end } = req.params;

        // แปลง date_start และ date_end ให้เป็น Date object
        const startDate = new Date(date_start);
        const endDate = new Date(date_end);

        // ตรวจสอบว่าวันที่ถูกต้องหรือไม่
        if (isNaN(startDate.getTime()) || isNaN(endDate.getTime())) {
            return msg(res, 400, { message: 'วันที่ไม่ถูกต้อง กรุณาระบุในรูปแบบ YYYY-MM-DD!' });
        }

        // ปรับ endDate ให้ครอบคลุมทั้งวัน (ถึง 23:59:59.999)
        endDate.setHours(23, 59, 59, 999);

        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.attendance_records.findMany({
            where: {
                created_at: {
                    gte: startDate, // มากกว่าหรือเท่ากับวันที่เริ่มต้น
                    lte: endDate    // น้อยกว่าหรือเท่ากับวันที่สิ้นสุด
                }
            },
            select: {
                attendance_record_id: true,
                users: { select: { prefixes: { select: { prefix_name: true } }, fullname_thai: true } },
                shift_types: { select: { shift_type_name: true } },
                shifts: { select: { shift_name: true } },
                starting: true,
                starting_signature_id: true,
                check_in_status: { select: { check_in_status_name: true } },
                ending: true,
                ending_signature_id: true,
                check_out_status: { select: { check_out_status_name: true } },
                location_lat_start: true,
                location_lon_start: true,
                desc_start: true,
                location_lat_end: true,
                location_lon_end: true,
                desc_end: true, 
                created_at: true,
                created_by: true,
                updated_at: true,
                updated_by: true
            }
        });
        const endTime = Date.now() - startTime;

        const resultWithImageUrl = resultData.map((attendanceRecord) => {
            const startImageBlobUrl = `/signatureShowImage/${attendanceRecord.starting_signature_id}`;
            const endImageBlobUrl = `/signatureShowImage/${attendanceRecord.ending_signature_id}`;
            return {
                ...attendanceRecord,
                starting_signature: startImageBlobUrl,
                ending_signature: endImageBlobUrl
            }
        });

        // บันทึกข้อมูลไปยัง attendance_records_log
        await pm.attendance_records_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: resultData.length,
                status: resultData.length > 0 ? 'Search data success' : 'No Data'
            }
        });

        if (resultData.length === 0) { return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' }); }

        return msg(res, 200, { data: resultWithImageUrl });
    } catch (error) {
        console.error("Error searchDateAttendanceRecord:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
};

// Function สำหรับค้นหาแบบหลายเงื่อนไข
exports.searchAttendanceRecords = async (req, res) => {
    try {
        const { keyword } = req.params;

        // ตรวจสอบว่า keyword เป็นตัวเลขหรือไม่
        const isNumeric = !isNaN(keyword) && !isNaN(parseInt(keyword));
        const attendanceIdCondition = isNumeric ? { attendance_record_id: { equals: parseInt(keyword) } } : {};

        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.attendance_records.findMany({
            where: {
                OR: [
                    ...(isNumeric ? [attendanceIdCondition] : []),
                    {
                        users: {
                            OR: [
                                { prefixes: { prefix_name: { contains: keyword } } },
                                { fullname_thai: { contains: keyword } }
                            ]
                        }
                    },
                    { shift_types: { shift_type_name: { contains: keyword } } },
                    { shifts: { shift_name: { contains: keyword } } },
                    { starting: { contains: keyword } },
                    { check_in_status: { check_in_status_name: { contains: keyword } } },
                    { ending: { contains: keyword } },
                    { check_out_status: { check_out_status_name: { contains: keyword } } }
                ]
            },
            select: {
                attendance_record_id: true,
                users: { select: { prefixes: { select: { prefix_name: true } }, fullname_thai: true } },
                shift_types: { select: { shift_type_name: true } },
                shifts: { select: { shift_name: true } },
                starting: true,
                starting_signature_id: true,
                check_in_status: { select: { check_in_status_name: true } },
                ending: true,
                ending_signature_id: true,
                check_out_status: { select: { check_out_status_name: true } },
                location_lat_start: true,
                location_lon_start: true,
                desc_start: true,
                location_lat_end: true,
                location_lon_end: true,
                desc_end: true, 
                created_at: true,
                created_by: true,
                updated_at: true,
                updated_by: true
            }
        });
        const endTime = Date.now() - startTime;

        const resultWithImageUrl = resultData.map((attendanceRecord) => {
            const startImageBlobUrl = `/signatureShowImage/${attendanceRecord.starting_signature_id}`;
            const endImageBlobUrl = `/signatureShowImage/${attendanceRecord.ending_signature_id}`;
            return {
                ...attendanceRecord,
                starting_signature: startImageBlobUrl,
                ending_signature: endImageBlobUrl
            }
        });

        // บันทึกข้อมูลไปยัง attendance_records_log
        await pm.attendance_records_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: resultData.length,
                status: resultData.length > 0 ? 'Search data success' : 'No Data'
            }
        });

        if (resultData.length === 0) { return res.status(404).json({ message: 'ไม่มีข้อมูลบน Database!' }); }

        return res.status(200).json({ data: resultWithImageUrl });
    } catch (error) {
        console.error("Error searchAttendanceRecords:", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

exports.fetchGps = async (req, res) => {
    try {
        const fetchGps = await pm.system_locations.findMany({
            select: {
                stl_id: true,
                stl_name: true,
                stl_lat: true,
                stl_lon: true,
                stl_radius: true,
                stl_block: true
            }
        })
        return msg(res, 200, { data: fetchGps });
    } catch (error) {
        console.error("Error fetchHolidays:", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
}

// Function ในการตรวจสอบวันปัจจุบันว่าเป็นวันหยุดหรือไม่?
exports.fetchHolidays = async (req, res) => {
    try {
        const currentMonth = moment().format('MM');

        const fetchHolidays = await pm.$queryRaw`
            SELECT holiday_name, holiday_date
            FROM holidays
            WHERE EXTRACT(MONTH FROM holiday_date) = ${parseInt(currentMonth)}
        `;

        let checkHoliday = "วันปกติ";

        const dateNow = moment().format('YYYY-MM-DD');

        for (const holiday of fetchHolidays) {
            // แปลง holiday_date ให้เป็น string รูปแบบ YYYY-MM-DD
            const holidayDate = moment(holiday.holiday_date).format('YYYY-MM-DD');
            if (dateNow === holidayDate) checkHoliday = "วันหยุดหรือวันหยุดราชการ";
        }

        const fetchShiftType = await pm.shift_types.findFirst({
            where: { shift_type_name: checkHoliday },
            select: { shift_type_id: true, shift_type_name: true }
        });

        return msg(res, 200, { data: fetchShiftType });
    } catch (error) {
        console.error("Error fetchHolidays:", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

// Function ในการลงเวลาเข้าทำงาน
exports.checkIn = async (req, res) => {
    try {
        let timeNow = moment().format('HH:mm:ss'); // ดึงเวลาปัจจุบัน

        if (!req.body.national_id || !req.body.shift_type_id ) return msg(res, 400, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });

        const bytes = CryptoJS.AES.decrypt(req.body.national_id, process.env.PASS_KEY);
        const national_id = bytes.toString(CryptoJS.enc.Utf8);

        const checkUser = await pm.users.findFirst({
            where: { national_id },
            select: { user_id: true, fullname_thai: true }
        });
        if (!checkUser) return msg(res, 404, { message: 'ไม่มี User นี้อยู่ในระบบ กรุณา Register ก่อนใช้งาน!' });

        const fetchNotify = await pm.notify_users.findFirst({
            where: { user_id: checkUser.user_id },
            select: { notify_user_token: true }
        });
        if (!fetchNotify.notify_user_token) return msg(res, 400, { message: 'ไม่มี TelegramChatId ใน User กรุณาติดต่อ Admin เพื่อเพิ่มข้อมูล!' });

        const fullname = checkUser.fullname_thai;

        const checkDataAttendanceRecord = await pm.attendance_records.findFirst({
            where: {
                user_id: checkUser.user_id,
                ending: null,
                check_out_status_id: null
            },
            select: { attendance_record_id: true }
        });
        if (checkDataAttendanceRecord) return msg(res, 409, { message: 'มีข้อมูลซ้ำที่ยังไม่ได้ Check Out กรุณา Check Out ก่อน!' });

        // ตรวจสอบว่า shift_type_id มีอยู่จริงหรือไม่
        const checkShiftTypeId = await pm.shift_types.findFirst({
            where: { shift_type_id: Number(req.body.shift_type_id) },
            select: { shift_type_id: true }
        });
        if (!checkShiftTypeId) return msg(res, 404, { message: 'ไม่มีข้อมูลประเภทกะการทำงาน กรุณาเพิ่มข้อมูลก่อน!' });

        let fetchDataOneCheckInStatus = null;
        let fetchDataOneShift = null;

        if (req.body.shift_type_id === 1) { // เวลาปกติ

            if(!req.body.shift_id || !req.body.latitude || !req.body.longitude || !req.body.desc) return msg(res, 400, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน!' });

            const fetchDataOneShiftResult = await pm.shifts.findFirst({
                where: { shift_id: Number(req.body.shift_id) },
                select: {
                    shift_id: true,
                    shift_name: true,
                    shift_late: true,
                    shift_starting: true,
                    shift_ending: true
                }
            });
            if (!fetchDataOneShiftResult) return msg(res, 400, { message: "ไม่พบกะการทำงานที่ตรงกับเวลาปัจจุบัน" });
            if (timeNow <= fetchDataOneShiftResult.shift_starting) return msg(res, 400, { code: 400, result: false, message: `ยังไม่ถึงเวลากะนี้ กรุณารอเวลา ${fetchDataOneShiftResult.shift_starting.slice(0, 5)}น. เป็นต้นไป`, timeStamp: moment().add(543, "years").format('DD/MM/YYYY HH:mm:ss') });
            fetchDataOneShift = fetchDataOneShiftResult.shift_id

            fetchDataOneCheckInStatus = await pm.check_in_status.findFirst({
                where: { check_in_status_name: timeNow > fetchDataOneShiftResult.shift_late ? 'มาสาย' : 'เข้างาน' },
                select: { check_in_status_id: true, check_in_status_name: true }
            });
        } else if (req.body.shift_type_id === 2) {
            const fetchDataOneShiftResult = await pm.shifts.findFirst({
                where: { shift_id: Number(req.body.shift_id) },
                select: {
                    shift_id: true,
                    shift_name: true,
                    shift_late: true,
                    shift_starting: true,
                    shift_ending: true
                }
            });
            if (!fetchDataOneShiftResult) return msg(res, 400, { message: "ไม่พบกะการทำงานที่ตรงกับเวลาปัจจุบัน" });
            if (timeNow <= fetchDataOneShiftResult.shift_starting) return msg(res, 400, { code: 400, result: false, message: `ยังไม่ถึงเวลากะนี้ กรุณารอเวลา ${fetchDataOneShiftResult.shift_starting.slice(0, 5)}น. เป็นต้นไป`, timeStamp: moment().add(543, "years").format('DD/MM/YYYY HH:mm:ss') });
            fetchDataOneShift = fetchDataOneShiftResult.shift_id

            fetchDataOneCheckInStatus = await pm.check_in_status.findFirst({
                where: { check_in_status_name: timeNow > fetchDataOneShiftResult.shift_late ? 'มาสาย' : 'เข้างาน' },
                select: {
                    check_in_status_id: true,
                    check_in_status_name: true
                }
            });
        } else if (req.body.shift_type_id === 3) {
            fetchDataOneShift = null;

            fetchDataOneCheckInStatus = await pm.check_in_status.findFirst({
                where: { check_in_status_name: 'เข้างาน' },
                select: { check_in_status_id: true, check_in_status_name: true }
            });
        }

        if (!fetchDataOneCheckInStatus) return msg(res, 400, { message: "เกิดข้อผิดพลาดในการดึงข้อมูลกะการทำงานหรือสถานะเช็คอิน" });

        const { user_id, fullname_thai } = checkUser;
        const { notify_user_token } = fetchNotify;

        const fetchSignature = await pm.signature_users.findFirst({
            where: { user_id: user_id },
            select: { signature_user_id: true }
        });
        if (!fetchSignature) return msg(res, 404, { message: 'User ยังไม่มีลายเซ็น Digital กรุณาเพิ่มลายเซ็น Digital ก่อนใช้งานระบบ!' });

        const startTime = Date.now();
        const insertAttendanceRecord = await pm.attendance_records.create({
            data: {
                user_id: user_id,
                shift_type_id: Number(req.body.shift_type_id),
                shift_id: fetchDataOneShift,
                starting: timeNow,
                starting_signature_id: fetchSignature.signature_user_id,
                check_in_status_id: fetchDataOneCheckInStatus.check_in_status_id,
                location_lat_start: parseFloat(req.body.latitude),
                location_lon_start: parseFloat(req.body.longitude),
                desc_start: req.body.desc,
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง attendance_records_log
        await pm.attendance_records_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: insertAttendanceRecord ? 1 : 0,
                status: insertAttendanceRecord ? 'Check in success' : 'Check in failed'
            }
        });

        const token = jwt.sign(
            {
                attendance_record_id: insertAttendanceRecord.attendance_record_id,
                userId: user_id,
                fullname: fullname_thai,
                telegramChatId: notify_user_token,
                expiresIn: "30s"
            },
            process.env.SECRET_KEY,
            { expiresIn: "30s" }
        );

        const otpCode = generateOtp(notify_user_token);
        await sendTelegramMessage(notify_user_token, otpCode);

        if (token) return msg(res, 200, { token: token });

    } catch (error) {
        console.error("Error checkIn:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
};

// Function ในการตรวจสอบ OTP หลังจากลงเวลาเข้าทำงาน
exports.checkInVerifyOtp = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return msg(res, 400, { message: 'การเข้าถึงถูกปฏิเสธ!' });

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
            const fetchOneUserData = await pm.users.findFirst({
                where: {
                    user_id: Number(decoded.userId)
                },
                select: {
                    fullname_thai: true
                }
            });
            const fullname = fetchOneUserData.fullname_thai;

            const startTime = Date.now();
            const updateData = await pm.attendance_records.update({
                where: {
                    attendance_record_id: Number(decoded.attendance_record_id)
                },
                data: {
                    otp_verified: true
                }
            });
            const endTime = Date.now() - startTime;

            // บันทึกข้อมูลไปยัง attendance_records_log
            await pm.attendance_records_log.create({
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

            return msg(res, 200, { message: "ลงทะเบียนเข้างานเสร็จสิ้น!" });
        } else {
            return msg(res, 400, { message: "OTP ไม่ถูกต้อง" });
        }
    } catch (err) {
        if (err.name === 'TokenExpiredError') {
            const fetchDataOneAttendanceRecord = await pm.attendance_records.findMany({
                where: {
                    otp_verified: false
                },
                select: {
                    attendance_record_id: true,
                    starting: true
                }
            });

            const timeNow = new Date();
            const nowInSeconds = timeNow.getHours() * 3600 + timeNow.getMinutes() * 60 + timeNow.getSeconds();

            for (const record of fetchDataOneAttendanceRecord) {
                const [startHours, startMinutes, startSeconds] = record.starting.split(":").map(Number);
                const startInSeconds = startHours * 3600 + startMinutes * 60 + startSeconds;
                const diffInSeconds = Math.abs(nowInSeconds - startInSeconds);

                if (diffInSeconds >= 20) {
                    // ลบข้อมูล
                    await pm.attendance_records.delete({
                        where: {
                            attendance_record_id: record.attendance_record_id
                        }
                    });

                    // ดึงค่า MAX(attendance_record_id)
                    const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(attendance_record_id), 0) + 1 AS nextId FROM attendance_records`;

                    // รีเซ็ตค่า AUTO_INCREMENT
                    await pm.$executeRawUnsafe(`ALTER TABLE attendance_records AUTO_INCREMENT = ${maxIdResult[0].nextId}`);
                }
            }

            return msg(res, 401, { message: 'TokenExpiredError!' });
        } else if (err.name === 'JsonWebTokenError') {
            return msg(res, 401, { message: 'JsonWebTokenError!' });
        }
        console.error('Error verifyToken :', err);
        return msg(res, 500, { message: 'Internal Server Error!' });
    }
};

// Function ในการลงเวลาออกงาน
exports.checkOut = async (req, res) => {
    try {
        let dateNow = moment().format('YYYY-MM-DD');
        let timeNow = moment().format('HH:mm:ss'); // ดึงเวลาปัจจุบัน

        if (!req.body.national_id || !req.body.latitude || !req.body.longitude || !req.body.desc) return msg(res, 400, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน!' });

        const bytes = CryptoJS.AES.decrypt(req.body.national_id, process.env.PASS_KEY);
        const national_id = bytes.toString(CryptoJS.enc.Utf8);

        const checkUser = await pm.users.findFirst({
            where: { national_id },
            select: { user_id: true, fullname_thai: true }
        });

        const fullname = checkUser.fullname_thai;
        if (!checkUser) return msg(res, 404, { message: 'ไม่มี User นี้อยู่ในระบบ กรุณา Register ก่อนใช้งาน!' });

        const checkDataAttendanceRecord = await pm.attendance_records.findFirst({
            where: {
                user_id: Number(checkUser.user_id),
                ending: null,
                check_out_status_id: null,
                otp_verified: true
            },
            include: {
                shifts: {
                    select: {
                        shift_name: true,
                        shift_early: true,
                        shift_ending: true
                    }
                }
            }
        });
        if (!checkDataAttendanceRecord) return msg(res, 404, { message: "User นี้ไม่มีการ CheckIn เข้าทำงาน!" });

        let attendanceRecordCreatedAt = checkDataAttendanceRecord.created_at;
        let attendanceData = moment(attendanceRecordCreatedAt).format('YYYY-MM-DD');

        const fetchSignature = await pm.signature_users.findFirst({
            where: { user_id: checkUser.user_id },
            select: { signature_user_id: true }
        });
        if (!fetchSignature) return msg(res, 404, { message: 'User ยังไม่มีลายเซ็น Digital กรุณาเพิ่มลายเซ็น Digital ก่อนใช้งานระบบ!' });
        const { signature_user_id } = fetchSignature;

        if (checkDataAttendanceRecord.shift_id === null) {
            const fetchOneCheckOutStatus = await pm.check_out_status.findFirst({
                where: {
                    check_out_status_name: "ออกงาน"
                },
                select: {
                    check_out_status_id: true
                }
            });
            if (!fetchOneCheckOutStatus) return msg(res, 404, { message: 'ไม่มีข้อมูล (สถานะการออกงาน) กรุณาเพิ่มข้อมูลก่อน!' });

            const startTime_1 = Date.now();
            const updateData_1 = await pm.attendance_records.update({
                where: {
                    attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                },
                data: {
                    ending: timeNow,
                    ending_signature_id: signature_user_id,
                    check_out_status_id: fetchOneCheckOutStatus.check_out_status_id,
                    location_lat_end: parseFloat(req.body.latitude),
                    location_lon_end: parseFloat(req.body.longitude),
                    desc_end: req.body.desc
                }
            });
            const endTime_1 = Date.now() - startTime_1;

            // บันทึกข้อมูลไปยัง attendance_records_log
            await pm.attendance_records_log.create({
                data: {
                    ip_address: req.headers['x-forwarded-for'] || req.ip,
                    name: fullname,
                    request_method: req.method,
                    endpoint: req.originalUrl,
                    execution_time: endTime_1,
                    row_count: updateData_1 ? 1 : 0,
                    status: updateData_1 ? 'Check out successfully' : 'Check out failed'
                }
            });
        } else if (attendanceData != dateNow) {
            const fetchOneCheckOutStatus = await pm.check_out_status.findFirst({
                where: {
                    check_out_status_name: "ไม่มีการเช็คออกงาน"
                },
                select: {
                    check_out_status_id: true
                }
            });
            if (!fetchOneCheckOutStatus) return msg(res, 404, { message: 'ไม่มีข้อมูล (สถานะการออกงาน) กรุณาเพิ่มข้อมูลก่อน!' });

            const startTime_2 = Date.now();
            const updateData_2 = await pm.attendance_records.update({
                where: {
                    attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                },
                data: {
                    ending: timeNow,
                    check_out_status_id: fetchOneCheckOutStatus.check_out_status_id,
                    location_lat_end: parseFloat(req.body.latitude),
                    location_lon_end: parseFloat(req.body.longitude),
                    desc_end: req.body.desc
                }
            });
            const endTime_2 = Date.now() - startTime_2;

            // บันทึกข้อมูลไปยัง attendance_records_log
            await pm.attendance_records_log.create({
                data: {
                    ip_address: req.headers['x-forwarded-for'] || req.ip,
                    name: fullname,
                    request_method: req.method,
                    endpoint: req.originalUrl,
                    execution_time: endTime_2,
                    row_count: updateData_2 ? 1 : 0,
                    status: updateData_2 ? 'Check out successfully' : 'Check out failed'
                }
            });
        } else {
            if (timeNow < checkDataAttendanceRecord.shifts.shift_early) {
                const fetchOneCheckOutStatus = await pm.check_out_status.findFirst({
                    where: {
                        check_out_status_name: "ออกก่อนเวลา"
                    },
                    select: {
                        check_out_status_id: true
                    }
                });
                if (!fetchOneCheckOutStatus) return msg(res, 404, { message: 'ไม่มีข้อมูล (สถานะการออกงาน) กรุณาเพิ่มข้อมูลก่อน!' });

                const startTime_3 = Date.now();
                const updateData_3 = await pm.attendance_records.update({
                    where: {
                        attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                    },
                    data: {
                        ending: timeNow,
                        ending_signature_id: signature_user_id,
                        check_out_status_id: fetchOneCheckOutStatus.check_out_status_id,
                        location_lat_end: parseFloat(req.body.latitude),
                        location_lon_end: parseFloat(req.body.longitude),
                        desc_end: req.body.desc
                    }
                });
                const endTime_3 = Date.now() - startTime_3;

                // บันทึกข้อมูลไปยัง attendance_records_log
                await pm.attendance_records_log.create({
                    data: {
                        ip_address: req.headers['x-forwarded-for'] || req.ip,
                        name: fullname,
                        request_method: req.method,
                        endpoint: req.originalUrl,
                        execution_time: endTime_3,
                        row_count: updateData_3 ? 1 : 0,
                        status: updateData_3 ? 'Check out successfully' : 'Check out failed'
                    }
                });
            } else if (timeNow > checkDataAttendanceRecord.shifts.shift_ending) {
                const fetchOneCheckOutStatus = await pm.check_out_status.findFirst({
                    where: {
                        check_out_status_name: "ไม่มีการเช็คออกงาน"
                    },
                    select: {
                        check_out_status_id: true
                    }
                });
                if (!fetchOneCheckOutStatus) return msg(res, 404, { message: 'ไม่มีข้อมูล (สถานะการออกงาน) กรุณาเพิ่มข้อมูลก่อน!' });

                const startTime_4 = Date.now();
                const updateData_4 = await pm.attendance_records.update({
                    where: {
                        attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                    },
                    data: {
                        ending: timeNow,
                        check_out_status_id: fetchOneCheckOutStatus.check_out_status_id,
                        location_lat_end: parseFloat(req.body.latitude),
                        location_lon_end: parseFloat(req.body.longitude),
                        desc_end: req.body.desc
                    }
                });
                const endTime_4 = Date.now() - startTime_4;

                // บันทึกข้อมูลไปยัง attendance_records_log
                await pm.attendance_records_log.create({
                    data: {
                        ip_address: req.headers['x-forwarded-for'] || req.ip,
                        name: fullname,
                        request_method: req.method,
                        endpoint: req.originalUrl,
                        execution_time: endTime_4,
                        row_count: updateData_4 ? 1 : 0,
                        status: updateData_4 ? 'Check out successfully' : 'Check out failed'
                    }
                });
            } else {
                const fetchOneCheckOutStatus = await pm.check_out_status.findFirst({
                    where: {
                        check_out_status_name: "ออกงาน"
                    },
                    select: {
                        check_out_status_id: true
                    }
                });
                if (!fetchOneCheckOutStatus) return msg(res, 404, { message: 'ไม่มีข้อมูล (สถานะการออกงาน) กรุณาเพิ่มข้อมูลก่อน!' });

                const startTime_5 = Date.now();
                const updateData_5 = await pm.attendance_records.update({
                    where: {
                        attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                    },
                    data: {
                        ending: timeNow,
                        ending_signature_id: signature_user_id,
                        check_out_status_id: fetchOneCheckOutStatus.check_out_status_id,
                        location_lat_end: parseFloat(req.body.latitude),
                        location_lon_end: parseFloat(req.body.longitude),
                        desc_end: req.body.desc
                    }
                });
                const endTime_5 = Date.now() - startTime_5;

                // บันทึกข้อมูลไปยัง attendance_records_log
                await pm.attendance_records_log.create({
                    data: {
                        ip_address: req.headers['x-forwarded-for'] || req.ip,
                        name: fullname,
                        request_method: req.method,
                        endpoint: req.originalUrl,
                        execution_time: endTime_5,
                        row_count: updateData_5 ? 1 : 0,
                        status: updateData_5 ? 'Check out successfully' : 'Check out failed'
                    }
                });
            }
        }

        return msg(res, 200, { message: "ลงเวลาออกงานเสร็จสิ้น" });

    } catch (error) {
        console.error("Error checkOut:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
};

// ดึงข้อมูลประเภทของเวลาเข้างาน
exports.getShifts = async (req, res) => {
    try {
        const getAllDataShiftTypes = await pm.shifts.findMany({
            select: {
                shift_id: true,
                shift_name: true
            }, orderBy: {
                shift_id: 'asc'
            }
        });

        return msg(res, 200, { data: getAllDataShiftTypes });
    } catch (error) {
        console.error("Error checkIn:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
}