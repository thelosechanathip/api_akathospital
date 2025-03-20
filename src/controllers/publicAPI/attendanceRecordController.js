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
        const resultData = await pm.attendance_records.findMany({
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
                created_by:true,
                updated_at: true,
                updated_by:true
            }
        });

        if(resultData.length === 0) return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });

        return msg(res, 200, { data: resultData });
    } catch (error) {
        console.error("Error fetchDataAllAttendanceRecord:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
}

// exports.searchAttendanceRecords = async (req, res) => {
//     try {
//         const { keyword } = req.params;

//         const searchTerm = keyword.toLowerCase();

//         const searchConditions = {
//             OR: [
//                 /^\d+$/.test(keyword) ? { attendance_record_id: parseInt(keyword) } : null,
//                 { starting: { contains: searchTerm } },
//                 { ending: { contains: searchTerm } },
//                 { created_by: { contains: searchTerm } },
//                 { updated_by: { contains: searchTerm } },
//                 /^\d{4}-\d{2}-\d{2}$/.test(keyword) ? { created_at: { equals: new Date(keyword) } } : null,
//                 /^\d{4}-\d{2}-\d{2}$/.test(keyword) ? { updated_at: { equals: new Date(keyword) } } : null,
//                 { users: { fullname_thai: { contains: searchTerm } } },
//                 { users: { prefix: { contains: searchTerm } } },
//                 { shift_types: { shift_type_name: { contains: searchTerm } } },
//                 { shifts: { shift_name: { contains: searchTerm } } },
//                 { check_in_status: { check_in_status_name: { contains: searchTerm } } },
//                 { check_out_status: { check_out_status_name: { contains: searchTerm } } },
//             ].filter(Boolean)
//         };

//         const resultData = await pm.attendance_records.findMany({
//             where: searchConditions,
//             select: {
//                 attendance_record_id: true,
//                 starting: true,
//                 ending: true,
//                 users: { select: { prefix: true, fullname_thai: true } },
//                 shift_types: { select: { shift_type_name: true } },
//                 shifts: { select: { shift_name: true } },
//                 check_in_status: { select: { check_in_status_name: true } },
//                 check_out_status: { select: { check_out_status_name: true } },
//                 created_at: true,
//                 created_by: true,
//                 updated_at: true,
//                 updated_by: true
//             }
//         });

//         if (resultData.length === 0) {
//             return res.status(404).json({ message: 'ไม่มีข้อมูลบน Database!' });
//         }

//         return res.status(200).json({ data: resultData });
//     } catch (error) {
//         console.error("Error searchAttendanceRecords:", error.message);
//         return res.status(500).json({ message: "Internal Server Error" });
//     }
// };

exports.searchAttendanceRecords = async (req, res) => {
    try {
        const { keyword } = req.params;
        const searchTerm = `%${keyword.toLowerCase()}%`;

        const resultData = await pm.$queryRaw`
            SELECT 
                ar.attendance_record_id,
                ar.starting,
                ar.ending,
                u.prefix,
                u.fullname_thai,
                st.shift_type_name,
                s.shift_name,
                cis.check_in_status_name,
                cos.check_out_status_name,
                ar.created_at,
                ar.created_by,
                ar.updated_at,
                ar.updated_by
            FROM attendance_records ar
            LEFT JOIN users u ON ar.user_id = u.user_id  -- แก้จาก u.id เป็นคอลัมน์ที่ถูกต้อง
            LEFT JOIN shift_types st ON ar.shift_type_id = st.shift_type_id
            LEFT JOIN shifts s ON ar.shift_id = s.shift_id
            LEFT JOIN check_in_status cis ON ar.check_in_status_id = cis.check_in_status_id
            LEFT JOIN check_out_status cos ON ar.check_out_status_id = cos.check_out_status_id
            WHERE 
                ar.attendance_record_id = ${parseInt(keyword) || 0}
                OR LOWER(ar.starting) LIKE ${searchTerm}
                OR LOWER(ar.ending) LIKE ${searchTerm}
                OR LOWER(ar.created_by) LIKE ${searchTerm}
                OR LOWER(ar.updated_by) LIKE ${searchTerm}
                OR LOWER(u.fullname_thai) LIKE ${searchTerm}
                OR LOWER(u.prefix) LIKE ${searchTerm}
                OR LOWER(st.shift_type_name) LIKE ${searchTerm}
                OR LOWER(s.shift_name) LIKE ${searchTerm}
                OR LOWER(cis.check_in_status_name) LIKE ${searchTerm}
                OR LOWER(cos.check_out_status_name) LIKE ${searchTerm}
                OR LOWER(CAST(ar.created_at AS CHAR)) LIKE ${searchTerm}
                OR LOWER(CAST(ar.updated_at AS CHAR)) LIKE ${searchTerm}
        `;

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
            select: { user_id: true, telegram_chat_id: true }
        });
        if(!checkUser) return msg(res, 404, { message: 'ไม่มี User นี้อยู่ในระบบ กรุณา Register ก่อนใช้งาน!' });
        if(!checkUser.telegram_chat_id) return msg(res, 400, { message: 'ไม่มี TelegramChatId ใน User กรุณาติดต่อ Admin เพื่อเพิ่มข้อมูล!' });

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
                    check_in_status_id: timeNow > fetchDataOneShiftResult.shift_late ? 2 : 1
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
                    check_in_status_id: timeNow > fetchDataOneShiftResult.shift_late ? 2 : 1
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
                    check_in_status_id: Number(1)
                },
                select: {
                    check_in_status_id: true,
                    check_in_status_name: true
                }
            });
        }

        if (!fetchDataOneCheckInStatus) return msg(res, 400, { message: "เกิดข้อผิดพลาดในการดึงข้อมูลกะการทำงานหรือสถานะเช็คอิน" });

        const { user_id, telegram_chat_id } = checkUser;

        const insertAttendanceRecord = await pm.attendance_records.create({
            data: {
                user_id: user_id,
                shift_type_id: Number(req.body.shift_type_id),
                shift_id: fetchDataOneShift,
                starting: timeNow,
                check_in_status_id: fetchDataOneCheckInStatus.check_in_status_id
            }
        });

        const token = jwt.sign(
            { 
                attendance_record_id: insertAttendanceRecord.attendance_record_id, 
                userId: user_id, 
                telegramChatId: telegram_chat_id, 
                expiresIn: "20s" 
            },
            process.env.SECRET_KEY,
            { expiresIn: "20s" }
        );

        const otpCode = generateOtp(telegram_chat_id);
        await sendTelegramMessage(telegram_chat_id, otpCode);

        if (token) return msg(res, 200, token);
        
    } catch (error) {
        console.error("Error checkIn:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
};

exports.checkInVerifyOtp = async (req, res) => {
    const authHeader = req.headers.authorization;
    if (!authHeader) return msg(res, 401, { message: 'การเข้าถึงถูกปฏิเสธ!' });

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
            await pm.attendance_records.update({
                where: {
                    attendance_record_id: Number(decoded.attendance_record_id)
                },
                data: {
                    otp_verified: true
                }
            });
            return msg(res, 200, { message: "ลงทะเบียนเข้างานเสร็จสิ้น!" });
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
}

exports.checkOut = async (req, res) => {
    try {
        let timeNow = moment().format('HH:mm:ss'); // ดึงเวลาปัจจุบัน
        // let timeNow = "15:30:01";
        if(!req.body.national_id) return msg(res, 400, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน' });

        const bytes = CryptoJS.AES.decrypt(req.body.national_id, process.env.PASS_KEY);
        const national_id = bytes.toString(CryptoJS.enc.Utf8);

        const checkUser = await pm.users.findFirst({
            where: { national_id },
            select: { user_id: true }
        });
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

            await pm.attendance_records.update({
                where: {
                    attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                },
                data: {
                    ending: timeNow,
                    check_out_status_id: fetchOneCheckOutStatus.check_out_status_id 
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
    
                await pm.attendance_records.update({
                    where: {
                        attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                    },
                    data: {
                        ending: timeNow,
                        check_out_status_id: fetchOneCheckOutStatus.check_out_status_id 
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
    
                await pm.attendance_records.update({
                    where: {
                        attendance_record_id: checkDataAttendanceRecord.attendance_record_id
                    },
                    data: {
                        ending: timeNow,
                        check_out_status_id: fetchOneCheckOutStatus.check_out_status_id 
                    }
                });
            }
        }

        return msg(res, 200, { message: "ลงเวลาออกงานเสร็จสิ้น" });

    } catch (error) {
        console.error("Error checkOut:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
}

exports.test = async (req, res) => {
    try {
        const { test_request } = req.body;
        const headers = req.headers;

        return msg(res, 200, headers);
    } catch (error) {
        console.error("Error test:", error.message);
        return msg(res, 500, { message: "Internal Server Error" });
    }
}