const TelegramBot = require("node-telegram-bot-api");

exports.chatBot = async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const bot = new TelegramBot(token, { polling: true });

    // bot.on('polling_error', (error) => {
    //     console.error("Polling Error:", error);
    // });

    // เมื่อพิมพ์คำสั่ง /start
    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;

        bot.sendMessage(chatId, "ยินดีต้อนรับสู่ Bot ของโรงพยาบาลอากาศอำนวย Version: 0.0.1");
    });

    // เมื่อพิมพ์คำสั่ง /web
    bot.onText(/\/web/, (msg) => {
        const chatId = msg.chat.id;
        const web = {
            akathospitalOld: "http://akathospital.com/",
            akathospitalNew: "https://akathos.moph.go.th/"
        };

        let message = `เว็บไซต์โรงพยาบาลอากาศอำนวย:\n`;
        message += `เก่า: ${web.akathospitalOld}\n`;
        message += `ใหม่: ${web.akathospitalNew}\n`;

        bot.sendMessage(chatId, message);
    });

    // เก็บ state ของผู้ใช้ว่ากำลังรอข้อมูลอะไรอยู่
    const userStates = {};

    bot.onText(/\/hosxp/, (msg) => {
        const chatId = msg.chat.id;
    });

    bot.onText(/\/help/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, "กรุณาระบุสิ่งที่คุณต้องการตรวจสอบ:");
        // เปลี่ยน state ของผู้ใช้เป็น 'waiting_for_check'
        userStates[chatId] = 'waiting_for_check';
    });

    // Handler สำหรับข้อความทั่วไป (ที่ไม่ใช่คำสั่ง)
    bot.on('message', (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        // ตรวจสอบ state ของผู้ใช้
        if (userStates[chatId] === 'waiting_for_check') {
            // นำข้อความที่ผู้ใช้ส่งมาไปตรวจสอบ (ในส่วนนี้คุณจะต้องเขียน logic การตรวจสอบของคุณ)
            bot.sendMessage(chatId, `กำลังตรวจสอบ: "${text}"...`);
            // หลังจากตรวจสอบเสร็จสิ้น ให้ลบ state ของผู้ใช้
            delete userStates[chatId];
        } else if (text && !text.startsWith('/')) {
            bot.sendMessage(chatId, `กำลังอยู่ในการพัฒนา!!`);
        }
    });

    console.log('Bot is running...');
};