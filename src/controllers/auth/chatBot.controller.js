const services = require('../../services/auth/chatBot.service');
const TelegramBot = require("node-telegram-bot-api");

exports.chatBot = async () => {
    const token = process.env.TELEGRAM_BOT_TOKEN;
    const bot = new TelegramBot(token, { polling: true });

    bot.on('polling_error', (error) => {
        console.error("Polling Error:", error);
    });

    bot.onText(/\/start/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, "ยินดีต้อนรับสู่ Bot ของโรงพยาบาลอากาศอำนวย Version: 0.0.1");
    });

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

    const userStates = {};

    bot.onText(/\/hosxp/, (msg) => {
        const chatId = msg.chat.id;
        bot.sendMessage(chatId, `กรุณากรอกเลขบัตรประจำตัวประชาชน:`);
        userStates[chatId] = 'hosxpSystem';
    });

    bot.on('callback_query', async (callbackQuery) => {
        const chatId = callbackQuery.message.chat.id;
        const data = callbackQuery.data;
        const messageId = callbackQuery.message.message_id;

        if (data === 'request_checkQueue_nationalId') {
            bot.sendMessage(chatId, `กรุณากรอกเลขบัตรประจำตัวประชาชน:`);
            userStates[chatId] = 'waiting_for_checkQueue_nationalId';
        }

        bot.answerCallbackQuery(callbackQuery.id);
    });

    bot.on('message', async (msg) => {
        const chatId = msg.chat.id;
        const text = msg.text;

        // HoSXP Flow
        if (userStates[chatId] === 'hosxpSystem') {
            if (text) {
                try {
                    const userMessage = await services.hosxpSystem(text);
                    bot.sendMessage(chatId, userMessage);
                    userStates[chatId] = 'waiting_for_hosxp_menu_selection';
                } catch (error) {
                    console.error("Error waiting_for_hosxp_menu_selection:", error);
                    bot.sendMessage(chatId, `เกิดข้อผิดพลาดในการตรวจสอบ`);
                }
            } else {
                bot.sendMessage(chatId, `กรุณากรอกเลขบัตรประจำตัวประชาชน`);
            }
        } else if (userStates[chatId] === 'waiting_for_hosxp_menu_selection') {
            if (text === '1') {
                const resData = await services.fetchCountPatient();
                bot.sendMessage(chatId, resData);
                userStates[chatId] === 'waiting_for_hosxp_menu_selection';
            } else if (text === '0') {
                bot.sendMessage(chatId, "ออกจากระบบ HoSXP ขอบคุณครับ/คะ");
                delete userStates[chatId];
            } else {
                bot.sendMessage(chatId, "กรุณาพิมพ์ตัวเลขที่ระบุในรายการ");
            }
        }
        // Check Queue Flow
        else if (userStates[chatId] === 'waiting_for_checkQueue_nationalId') {
            if (text && !text.startsWith('/')) {
                const nationalId = text;
                try {
                    const resCheckQueue = await services.checkQueue(nationalId);
                    bot.sendMessage(chatId, resCheckQueue);
                    delete userStates[chatId];
                } catch (err) {
                    console.error("Error checkQueue:", err);
                    bot.sendMessage(chatId, `เกิดข้อผิดพลาดในการตรวจสอบคิว`);
                }
            } else if (text && text.startsWith('/')) {
                bot.sendMessage(chatId, `ยกเลิกการตรวจสอบคิว`);
                delete userStates[chatId];
            } else {
                bot.sendMessage(chatId, `กรุณากรอกเลขบัตรประจำตัวประชาชน`);
            }
        }
        // Default Response for non-commands
        else if (text && !text.startsWith('/')) {
            bot.sendMessage(chatId, `เลือกหัวข้อที่ต้องการ:`, {
                reply_markup: {
                    inline_keyboard: [
                        [
                            { text: '🔍 ตรวจสอบสถานะการตรวจรักษา', callback_data: 'request_checkQueue_nationalId' }
                        ]
                    ]
                }
            });
        }
    });

    // console.log('Bot is running...');
};