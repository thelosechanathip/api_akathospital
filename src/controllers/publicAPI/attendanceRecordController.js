const jwt = require("jsonwebtoken");
const bcrypt = require('bcryptjs');
const { msg } = require("../../utils/message");
require("dotenv").config();
const CryptoJS = require("crypto-js");
const axios = require("axios"); // เพิ่ม axios สำหรับเรียก Telegram API
const NodeCache = require("node-cache");
const otpCache = new NodeCache({ stdTTL: 20 }); // รหัส OTP หมดอายุใน 20 วินาที
const moment = require('moment');
const pm = require('../../config/prisma');

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

exports.fetchDataAllAttendanceRecord = async (req, res) => {
    try {
        // คำนวณวันที่เริ่มต้นและสิ้นสุดของเดือนปัจจุบัน
        const now = new Date(); // วันที่ปัจจุบัน (20 มี.ค. 2025)
        const startOfCurrentMonth = new Date(now.getFullYear(), now.getMonth(), 1); // วันแรกของเดือนนี้
        const endOfCurrentMonth = new Date(now.getFullYear(), now.getMonth() + 1, 0, 23, 59, 59, 999); // วันสุดท้ายของเดือนนี้

        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.attendance_records.findMany({
            where: {
                created_at: {
                    gte: startOfCurrentMonth, // มากกว่าหรือเท่ากับวันแรกของเดือนปัจจุบัน
                    lte: endOfCurrentMonth    // น้อยกว่าหรือเท่ากับวันสุดท้ายของเดือนปัจจุบัน
                }
            },
            select: {
                attendance_record_id: true,
                users: { select: { prefixes: { select: { prefix_name: true } }, fullname_thai: true } },
                shift_types: { select: { shift_type_name: true } },
                shifts: { select: { shift_name: true } },
                starting: true,
                check_in_status: { select: { check_in_status_name: true } },
                ending: true,
                check_out_status: { select: { check_out_status_name: true } },
                created_at: true,
                created_by: true,
                updated_at: true,
                updated_by: true
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
                row_count: resultData.length,
                status: resultData.length > 0 ? 'Fetch data success' : 'No Data'
            }
        });

        if (resultData.length === 0) {
            // console.log("No data found for the specified range");
            return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });
        }

        return msg(res, 200, { data: resultData });
    } catch (error) {
        console.error("Error fetchDataAllAttendanceRecord:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
};

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
                users: { select: { prefix: true, fullname_thai: true } },
                shift_types: { select: { shift_type_name: true } },
                shifts: { select: { shift_name: true } },
                starting: true,
                check_in_status: { select: { check_in_status_name: true } },
                ending: true,
                check_out_status: { select: { check_out_status_name: true } },
                created_at: true,
                created_by: true,
                updated_at: true,
                updated_by: true
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
                row_count: resultData.length,
                status: resultData.length > 0 ? 'Search data success' : 'No Data'
            }
        });

        if (resultData.length === 0) {
            console.log("No data found for the specified range");
            return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });
        }

        return msg(res, 200, { data: resultData });
    } catch (error) {
        console.error("Error searchDateAttendanceRecord:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
};

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
                users: { select: { prefixes: { select: { prefix_name: true } } , fullname_thai: true } },
                shift_types: { select: { shift_type_name: true } },
                shifts: { select: { shift_name: true } },
                starting: true,
                check_in_status: { select: { check_in_status_name: true } },
                ending: true,
                check_out_status: { select: { check_out_status_name: true } },
                created_at: true,
                created_by: true,
                updated_at: true,
                updated_by: true
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
                row_count: resultData.length,
                status: resultData.length > 0 ? 'Search data success' : 'No Data'
            }
        });

        if (resultData.length === 0) {
            return res.status(404).json({ message: 'ไม่มีข้อมูลบน Database!' });
        }

        return res.status(200).json({ data: resultData });
    } catch (error) {
        console.error("Error searchAttendanceRecords:", error.message);
        return res.status(500).json({ message: "Internal Server Error" });
    }
};

exports.checkIn = async (req, res) => {
    try {
        let timeNow = moment().format('HH:mm:ss'); // ดึงเวลาปัจจุบัน

        if(!req.body.national_id || !req.body.shift_type_id) return msg(res, 400, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });

        const bytes = CryptoJS.AES.decrypt(req.body.national_id, process.env.PASS_KEY);
        const national_id = bytes.toString(CryptoJS.enc.Utf8);

        const checkUser = await pm.users.findFirst({
            where: { national_id },
            select: { user_id: true, fullname_thai: true }
        });
        if(!checkUser) return msg(res, 404, { message: 'ไม่มี User นี้อยู่ในระบบ กรุณา Register ก่อนใช้งาน!' });

        const fetchNotify = await pm.notify_users.findFirst({
            where: { user_id: checkUser.user_id },
            select: { notify_user_token: true }
        });
        if(!fetchNotify.notify_user_token) return msg(res, 400, { message: 'ไม่มี TelegramChatId ใน User กรุณาติดต่อ Admin เพื่อเพิ่มข้อมูล!' });

        const fullname = checkUser.fullname_thai;

        const checkDataAttendanceRecord = await pm.attendance_records.findFirst({
            where: {
                user_id: checkUser.user_id,
                ending: null,
                check_out_status_id: null
            },
            select: {
                attendance_record_id: true
            }
        });
        if(checkDataAttendanceRecord) return msg(res, 409, { message: 'มีข้อมูลซ้ำที่ยังไม่ได้ Check Out กรุณา Check Out ก่อน!' });

        // ตรวจสอบว่า shift_type_id มีอยู่จริงหรือไม่
        const checkShiftTypeId = await pm.shift_types.findFirst({
            where: { shift_type_id: Number(req.body.shift_type_id) },
            select: { shift_type_id: true }
        });
        if(!checkShiftTypeId) return msg(res, 404, { message: 'ไม่มีข้อมูลประเภทกะการทำงาน กรุณาเพิ่มข้อมูลก่อน!' });

        let fetchDataOneCheckInStatus = null;
        let fetchDataOneShift = null;

        if(req.body.shift_type_id === 1) { // เวลาปกติ
            const fetchDataOneShiftResult = await pm.shifts.findFirst({
                where: {
                    shift_starting: { lte: timeNow },
                    shift_ending: { gte: timeNow }
                },
                select: {
                    shift_id: true,
                    shift_name: true,
                    shift_late: true,
                    shift_starting: true,
                    shift_ending: true
                }
            });            
            if (!fetchDataOneShiftResult) return msg(res, 400, { message: "ไม่พบกะการทำงานที่ตรงกับเวลาปัจจุบัน" });
            fetchDataOneShift = fetchDataOneShiftResult.shift_id

            fetchDataOneCheckInStatus = await pm.check_in_status.findFirst({
                where: {
                    check_in_status_name: timeNow > fetchDataOneShiftResult.shift_late ? 'มาสาย' : 'เข้างาน'
                },
                select: {
                    check_in_status_id: true,
                    check_in_status_name: true
                }
            });
        } else if(req.body.shift_type_id === 2) {
            const fetchDataOneShiftResult = await pm.shifts.findFirst({
                where: {
                    shift_starting: { lte: timeNow },
                    shift_ending: { gte: timeNow }
                },
                select: {
                    shift_id: true,
                    shift_name: true,
                    shift_late: true,
                    shift_starting: true,
                    shift_ending: true
                }
            });            
            if (!fetchDataOneShiftResult) return msg(res, 400, { message: "ไม่พบกะการทำงานที่ตรงกับเวลาปัจจุบัน" });
            fetchDataOneShift = fetchDataOneShiftResult.shift_id

            fetchDataOneCheckInStatus = await pm.check_in_status.findFirst({
                where: {
                    check_in_status_name: timeNow > fetchDataOneShiftResult.shift_late ? 'มาสาย' : 'เข้างาน'
                },
                select: {
                    check_in_status_id: true,
                    check_in_status_name: true
                }
            });
        } else if(req.body.shift_type_id === 3) {
            fetchDataOneShift = null;

            fetchDataOneCheckInStatus = await pm.check_in_status.findFirst({
                where: {
                    check_in_status_name: 'เข้างาน'
                },
                select: {
                    check_in_status_id: true,
                    check_in_status_name: true
                }
            });
        }

        if (!fetchDataOneCheckInStatus) return msg(res, 400, { message: "เกิดข้อผิดพลาดในการดึงข้อมูลกะการทำงานหรือสถานะเช็คอิน" });

        const { user_id } = checkUser;
        const { notify_user_token } = fetchNotify;

        const fetchSignature = await pm.signature_users.findFirst({
            where: { user_id: user_id },
            select: { signature_user_id: true }
        });
        if(!fetchSignature) return msg(res, 404, { message: 'User ยังไม่มีลายเซ็น Digital กรุณาเพิ่มลายเซ็น Digital ก่อนใช้งานระบบ!' });

        const startTime = Date.now();
        const insertAttendanceRecord = await pm.attendance_records.create({
            data: {
                user_id: user_id,
                shift_type_id: Number(req.body.shift_type_id),
                shift_id: fetchDataOneShift,
                starting: timeNow,
                starting_signature_id: fetchSignature.signature_user_id,
                check_in_status_id: fetchDataOneCheckInStatus.check_in_status_id,
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
                telegramChatId: notify_user_token, 
                expiresIn: "20s" 
            },
            process.env.SECRET_KEY,
            { expiresIn: "20s" }
        );

        const otpCode = generateOtp(notify_user_token);
        await sendTelegramMessage(notify_user_token, otpCode);

        if (token) return msg(res, 200, { token: token });
        
    } catch (error) {
        console.error("Error checkIn:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
};

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

exports.checkOut = async (req, res) => {
    try {
        let dateNow = moment().format('YYYY-MM-DD');
        let timeNow = moment().format('HH:mm:ss'); // ดึงเวลาปัจจุบัน
        // let timeNow = "15:30:01";
        if(!req.body.national_id) return msg(res, 400, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน!' });

        const bytes = CryptoJS.AES.decrypt(req.body.national_id, process.env.PASS_KEY);
        const national_id = bytes.toString(CryptoJS.enc.Utf8);

        const checkUser = await pm.users.findFirst({
            where: { national_id },
            select: { user_id: true, fullname_thai: true }
        });
        const fullname = checkUser.fullname_thai;
        if(!checkUser) return msg(res, 404, { message: 'ไม่มี User นี้อยู่ในระบบ กรุณา Register ก่อนใช้งาน!' });

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
        if(!checkDataAttendanceRecord) return msg(res, 404, { message: "User นี้ไม่มีการ CheckIn เข้าทำงาน!" });

        let attendanceRecordCreatedAt = checkDataAttendanceRecord.created_at;
        let attendanceData = moment(attendanceRecordCreatedAt).format('YYYY-MM-DD');

        const fetchSignature = await pm.signature_users.findFirst({
            where: { user_id: checkUser.user_id },
            select: { signature_user_id: true }
        });
        if(!fetchSignature) return msg(res, 404, { message: 'User ยังไม่มีลายเซ็น Digital กรุณาเพิ่มลายเซ็น Digital ก่อนใช้งานระบบ!' });
        const { signature_user_id } = fetchSignature;
        
        if(checkDataAttendanceRecord.shift_id === null) {
            const fetchOneCheckOutStatus = await pm.check_out_status.findFirst({
                where: {
                    check_out_status_name: "ออกงาน"
                },
                select: {
                    check_out_status_id: true
                }
            });
            if(!fetchOneCheckOutStatus) return msg(res, 404, { message: 'ไม่มีข้อมูล (สถานะการออกงาน) กรุณาเพิ่มข้อมูลก่อน!' });

            const startTime_1 = Date.now();
            const updateData_1 = await pm.attendance_records.update({
                where: {
                    attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                },
                data: {
                    ending: timeNow,
                    ending_signature_id: signature_user_id,
                    check_out_status_id: fetchOneCheckOutStatus.check_out_status_id 
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
        } else if(attendanceData != dateNow) {
            const fetchOneCheckOutStatus = await pm.check_out_status.findFirst({
                where: {
                    check_out_status_name: "ไม่มีการเช็คออกงาน"
                },
                select: {
                    check_out_status_id: true
                }
            });
            if(!fetchOneCheckOutStatus) return msg(res, 404, { message: 'ไม่มีข้อมูล (สถานะการออกงาน) กรุณาเพิ่มข้อมูลก่อน!' });

            const startTime_2 = Date.now();
            const updateData_2 = await pm.attendance_records.update({
                where: {
                    attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                },
                data: {
                    ending: timeNow,
                    check_out_status_id: fetchOneCheckOutStatus.check_out_status_id 
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
            if(timeNow < checkDataAttendanceRecord.shifts.shift_early) {
                const fetchOneCheckOutStatus = await pm.check_out_status.findFirst({
                    where: {
                        check_out_status_name: "ออกก่อนเวลา"
                    },
                    select: {
                        check_out_status_id: true
                    }
                });
                if(!fetchOneCheckOutStatus) return msg(res, 404, { message: 'ไม่มีข้อมูล (สถานะการออกงาน) กรุณาเพิ่มข้อมูลก่อน!' });
    
                const startTime_3 = Date.now();
                const updateData_3 = await pm.attendance_records.update({
                    where: {
                        attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                    },
                    data: {
                        ending: timeNow,
                        ending_signature_id: signature_user_id,
                        check_out_status_id: fetchOneCheckOutStatus.check_out_status_id 
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
            } else if(timeNow > checkDataAttendanceRecord.shifts.shift_ending) {
                const fetchOneCheckOutStatus = await pm.check_out_status.findFirst({
                    where: {
                        check_out_status_name: "ไม่มีการเช็คออกงาน"
                    },
                    select: {
                        check_out_status_id: true
                    }
                });
                if(!fetchOneCheckOutStatus) return msg(res, 404, { message: 'ไม่มีข้อมูล (สถานะการออกงาน) กรุณาเพิ่มข้อมูลก่อน!' });
    
                const startTime_4 = Date.now();
                const updateData_4 = await pm.attendance_records.update({
                    where: {
                        attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                    },
                    data: {
                        ending: timeNow,
                        check_out_status_id: fetchOneCheckOutStatus.check_out_status_id 
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
                if(!fetchOneCheckOutStatus) return msg(res, 404, { message: 'ไม่มีข้อมูล (สถานะการออกงาน) กรุณาเพิ่มข้อมูลก่อน!' });
    
                const startTime_5 = Date.now();
                const updateData_5 = await pm.attendance_records.update({
                    where: {
                        attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                    },
                    data: {
                        ending: timeNow,
                        check_out_status_id: fetchOneCheckOutStatus.check_out_status_id 
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