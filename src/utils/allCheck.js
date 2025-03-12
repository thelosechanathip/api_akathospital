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