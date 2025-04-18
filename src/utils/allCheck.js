// Function ในการแปลงข้อมูลให้ตัวนำหน้าที่เป็นภาษาอังกฤษเป็นตัวพิมพ์ใหญ่
exports.capitalizeFirstLetter = async(string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
}

// Function ในการตรวจสอบข้อมูลว่าข้อมูลที่ถูกส่งมาเป็นภา่ษาอังกฤษอย่างเดียวใช่หรือไม่ ?
exports.isEnglishOnly = async (text) => {
    const englishOnlyPattern = /^[A-Za-z\s,'"':.]+$/;
    return englishOnlyPattern.test(text);
}

// Function ในการตรวจสอบข้อมูลว่าเป็น Boolean จริงๆหรือไม่ ?
exports.isBoolean = async(value) => {
    return typeof(value) === 'boolean';
}

// Function ในการตรวจสอบรูปแบบของ Email
exports.validateEmail = async(email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
}

// Function ในการตรวจสอบรูปแบบของเบอร์โทรศัพท์
exports.validatePhoneNumber = async(telephone_number) => {
    const phoneRegex = /^0[6-9][0-9]{8}$/; // เบอร์ไทย เช่น 0812345678
    return phoneRegex.test(telephone_number);
}

// Function ในการตรวจสอบรูปแบบของ Base 64
exports.isBase64Png  = async(data) => {
    const regex = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
    return regex.test(data);
}

// Function ในการแปลงจาก BLOB ไปเป็น Base64
exports.blobToBase64 = async(blob) => {
    // แปลงข้อมูล BLOB (Buffer) เป็น Base64 string
    const base64String = blob.toString('base64');
    return base64String;
}