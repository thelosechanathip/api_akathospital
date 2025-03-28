const multer = require('multer');

// ตั้งค่า Multer สำหรับอัปโหลดไฟล์
const storage = multer.memoryStorage(); // เก็บไฟล์ใน memory เป็น buffer
exports.upload = multer({ storage: storage });