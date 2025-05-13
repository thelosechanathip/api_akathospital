const models = require('../../models/public/employeeSystemRequestModel');
const allCheck = require('../../utils/allCheck');
const bcrypt = require('bcryptjs');
require("dotenv").config();
const axios = require("axios"); // เพิ่ม axios สำหรับเรียก Telegram API
const moment = require('moment');

// จัดรูปแบบของ วัน-เดือน-ปี
const formatDate = (input) => {
    const d = allCheck.normalizeToCE(input);
    return d
        ? moment(d).format('YYYY-MM-DD')
        : 'ไม่มีข้อมูล';
};

// Send Message To Application Telegram
const sendTelegramMessage = async (chatId, data) => {
    const botToken = process.env.TELEGRAM_BOT_TOKEN;
    const telegramApiUrl = `https://api.telegram.org/bot${botToken}/sendMessage`;

    try {
        const lines = [
            'คำร้องขอสร้าง User เพื่อใช้งานระบบ',
            '------------------------------',
            `วัน-เดือน-ปี เกิด : ${data.birth_date}`,
            `วันที่เริ่มทำงาน : ${data.join_date}`,
            `คำนำหน้า : ${await models.fetchPrefixName(data.prefix_id)}`,
            `ชื่อ-สกุล ไทย : ${data.thai_first_name} ${data.thai_last_name}`,
            `ชื่อ-สกุล อังกฤษ : ${data.eng_first_name} ${data.eng_last_name}`,
            `เลขบัตรประจำตัวประชาชน : ${data.national_id}`,
            `แผนก : ${await models.fetchDepartmentName(data.department_id)}`,
            `ตำแหน่ง : ${await models.fetchPositionName(data.position_id)}`,
            `เลขใบประกอบวิชาชีพ : ${data.medical_license_no}`,
            `วันเริ่มใช้งานใบประกอบวิชาชีพ : ${data.medical_license_start}`,
            `วันหมดอายุใบประกอบวิชาชีพ : ${data.medical_license_expire}`,
            `Username : ${data.username}`,
            `Password : ${data.password}`,
            '------------------------------',
        ];

        await axios.post(telegramApiUrl, {
            chat_id: chatId,
            text: lines.join('\n'),
        });

        console.log("Telegram message sent successfully");
    } catch (error) {
        console.error("Error sending Telegram message:", error);
        throw new Error("Failed to send Telegram message");
    }
};

// Fetch all employeeSystemRequests
exports.fetchAllData = async () => {
    const fetchAllDataResult = await models.fetchAllData();
    if (fetchAllDataResult.length === 0) return { status: 404, message: 'ไม่มีข้อมูลใน Database!' };

    return { status: 200, data: fetchAllDataResult };
};

// Create data employeeSystemRequest
exports.createData = async (data) => {
    // ตรวจสอบค่าซ้ำ โดยเก็บค่า duplicate message ไว้ก่อน
    const duplicateStatus = [];
    const duplicateMessages = [];

    // ตรวจ input
    for (const [key, value] of Object.entries(data)) {
        // ตรวจสอบว่ามีการกรอกข้อมูลมาทั้งหมดที่ยกเว้น medical_license_start และ medical_license_expire มาหรือไม่ ?
        if (['medical_license_start', 'medical_license_expire'].includes(key) && !value) {
            duplicateStatus.push(400);
            duplicateMessages.push(`กรุณากรอกข้อมูล ${key} ให้ครบถ้วน`);
        }

        // ตรวจสอบรูปแบบของ Password ว่าถูกต้องตามรูปแบบของ Password ที่ต้องการหรือไม่ ?
        if (['password'].includes(key) && value) {
            if (!await allCheck.isValidPassword(value)) {
                duplicateStatus.push(400);
                duplicateMessages.push(`${value} มีรูปแบบรหัสผ่านไม่ถูกต้อง รหัสผ่านต้องมีอักษรตัวพิมพ์เล็กและใหญ่ ตัวเลข อักขระพิเศษรวมกันอย่างน้อย 8 ตัว!`);
            }
        }

        // ตรวจสอบว่ามี national_id ซ้ำอยู่ในระบบหรือไม่ ?
        if (['national_id', 'username'].includes(key) && value) {
            if (await models.checkToEmployeeSystemRequest(key, value) || await models.checkToUser(key, value)) {
                duplicateStatus.push(409);
                duplicateMessages.push(`มีข้อมูล ${value} ในระบบแล้ว ไม่สามารถบันทึกซ้ำได้`);
            }
        }
    }
    if (duplicateMessages.length > 0) return { status: Math.max(...duplicateStatus), message: duplicateMessages.join(" AND ") }

    // แปลงให้ตัวอักษรตัวแรกเป็นตัวพิมพ์ใหญ่
    data.eng_first_name = await allCheck.capitalizeFirstLetter(data.eng_first_name);
    data.eng_last_name = await allCheck.capitalizeFirstLetter(data.eng_last_name);

    data.birth_date = formatDate(data.birth_date);
    data.join_date = formatDate(data.join_date);
    data.medical_license_start = formatDate(data.medical_license_start);
    data.medical_license_expire = formatDate(data.medical_license_expire);

    await sendTelegramMessage(-4629516175, data); // ส่ง OTP ไปยัง Telegram

    // Hash Password
    const salt = await bcrypt.genSalt(10);
    data.password = await bcrypt.hash(data.password, salt);

    data.birth_date = moment(data.birth_date).toISOString();
    data.join_date = moment(data.join_date).toISOString();
    data.medical_license_start = data.medical_license_start
        ? moment(data.medical_license_start).toISOString()
        : null;
    data.medical_license_expire = data.medical_license_expire
        ? moment(data.medical_license_expire).toISOString()
        : null;
    data.created_by = data.thai_first_name + ' ' + data.thai_last_name;

    if (await models.createData(data)) return { status: 200, message: 'ยื่นคำร้องขอ User เพื่อใช้งานระบบเสร็จสิ้นกรุณารอเจ้าหน้าที่สร้าง User ให้ไม่เกิน 20 นาที ขอบคุณครับ/คะ!' };
};

// Delete data employeeSystemRequest
exports.removeData = async (id) => {
    if (!await models.checkIdInEmployeeSystemRequest(id)) return { status: 404, message: `ไม่มี ID: ${id} อยู่ในระบบ` };
    if (await models.removeData(id)) return { status: 200, message: 'ลบคำขอ User เพื่อใช้งานระบบเรียบร้อย!' };
};