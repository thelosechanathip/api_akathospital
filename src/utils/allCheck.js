// Function ในการแปลงข้อมูลให้ตัวนำหน้าที่เป็นภาษาอังกฤษเป็นตัวพิมพ์ใหญ่
exports.capitalizeFirstLetter = (string) => {
    return string.charAt(0).toUpperCase() + string.slice(1);
};

// Function ในการตรวจสอบข้อมูลว่าข้อมูลที่ถูกส่งมาเป็นภา่ษาอังกฤษอย่างเดียวใช่หรือไม่ ?
exports.isEnglishOnly = (text) => {
    const englishOnlyPattern = /^[A-Za-z\s,'"':.]+$/;
    return englishOnlyPattern.test(text);
};

// Function ในการตรวจสอบข้อมูลว่าเป็น Boolean จริงๆหรือไม่ ?
exports.isBoolean = (value) => {
    return typeof (value) === 'boolean';
};

// Function ในการตรวจสอบรูปแบบของ Email
exports.validateEmail = (email) => {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    return emailRegex.test(email);
};

// Function ในการตรวจสอบรูปแบบของเบอร์โทรศัพท์
exports.validatePhoneNumber = (telephone_number) => {
    const phoneRegex = /^0[6-9][0-9]{8}$/; // เบอร์ไทย เช่น 0812345678
    return phoneRegex.test(telephone_number);
};

// Function ในการตรวจสอบรูปแบบของ Base 64
exports.isBase64Png = (data) => {
    const regex = /^data:image\/png;base64,[A-Za-z0-9+/=]+$/;
    return regex.test(data);
};

// Function ในการแปลงจาก BLOB ไปเป็น Base64
exports.blobToBase64 = (blob) => {
    // แปลงข้อมูล BLOB (Buffer) เป็น Base64 string
    const base64String = blob.toString('base64');
    return base64String;
};

// Function ในการตรวจสอบรูปแบบของ Password(รหัสผ่าน)
exports.isValidPassword = (password) => {
    //   (?=.*[0-9])       : ต้องมีตัวเลขอย่างน้อย 1 ตัว
    //   (?=.*[A-Z])       : ต้องมีตัวอักษรพิมพ์ใหญ่อย่างน้อย 1 ตัว
    //   (?=.*[\W_])       : ต้องมีอักขระพิเศษ (non-word character) อย่างน้อย 1 ตัว
    //   .{8,}             : ความยาวรวมไม่ต่ำกว่า 8 ตัวอักษร
    const re = /^(?=.*[0-9])(?=.*[\W_]).{8,}$/;
    return re.test(password);
};

// Function ในการแปลงรูปแบบของ ปี พ.ศ. ไปเป็น ปี ค.ศ.
exports.normalizeToCE = (dateStr) => {
    // ถ้า null หรือ undefined ให้คืน null เลย
    if (dateStr == null) return null;

    // ถ้ามาเป็น Date object อยู่แล้ว ก็คืนเลย
    if (dateStr instanceof Date) return dateStr;

    // ถ้าไม่ใช่ string ให้โยน error
    if (typeof dateStr !== 'string') {
        throw new TypeError('normalizeToCE: expected string or Date');
    }

    // DD/MM/YYYY
    if (dateStr.includes('/')) {
        const [dStr, mStr, yStr] = dateStr.split('/');
        let d = parseInt(dStr, 10);
        let m = parseInt(mStr, 10) - 1;
        let y = parseInt(yStr, 10);
        if (y >= 2500) y -= 543;  // เบิก พ.ศ.
        return new Date(y, m, d);
    }

    // YYYY-MM-DD
    if (dateStr.includes('-')) {
        const [yStr, mStr, dStr] = dateStr.split('-');
        let y = parseInt(yStr, 10);
        let m = parseInt(mStr, 10) - 1;
        let d = parseInt(dStr, 10);
        if (y >= 2500) y -= 543;
        return new Date(y, m, d);
    }

    // ถ้า format แปลกไป คืนเป็น Date fallback
    return new Date(dateStr);
};

exports.validateThaiID = (idNumber) => {
    // ตรวจสอบความยาวต้องมี 13 หลักและเป็นตัวเลขทั้งหมด
    if (!/^\d{13}$/.test(idNumber)) {
        return false;
    }

    // แปลง string เป็น array ของตัวเลข
    const digits = idNumber.split('').map(Number);

    // คำนวณ checksum
    let sum = 0;
    for (let i = 0; i < 12; i++) {
        sum += digits[i] * (13 - i);
    }

    const checksum = (11 - (sum % 11)) % 10;

    // ตรวจสอบว่า checksum ตรงกับหลักสุดท้ายหรือไม่
    return digits[12] === checksum;
}