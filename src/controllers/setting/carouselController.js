const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');
const sharp = require('sharp');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataSettingCarousels = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;

        const startTime = Date.now();
        const resultData = await pm.carousels.findMany({
            include: {
                carousel_image: false
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง carousels_log
        await pm.carousels_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: resultData.length,
                status: resultData.length > 0 ? 'Success' : 'No Data'
            }
        });

        if(resultData.length === 0) return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });

        // แปลงข้อมูลที่เก็บเป็น Blob ให้เป็น URL สำหรับแสดงภาพ
        const resultWithImageUrl = resultData.map((carousel) => {
            const imageBlobUrl = `/carousel-image/${carousel.carousel_id}`;
            return {
                ...carousel,
                image_url: imageBlobUrl  // เพิ่มฟิลด์ใหม่สำหรับแสดงภาพ
            };
        });

        return msg(res, 200, { data: resultWithImageUrl });
    } catch (err) {
        console.log('getAllDataCarousels : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.insertDataSettingCarousel = async (req, res) => {
    try {
        const carouselData = req.body; // ดึงข้อมูลทั้งหมดจาก req.body
        const fullname = req.user.fullname_thai;
        const file = req.file; // ดึงข้อมูลไฟล์ที่อัปโหลด

        if(!carouselData.carousel_name) return msg(res, 400, { message: 'กรุณากรอกข้อมูลให้ครบถ้วน!' });

        if (!file) return msg(res, 400, { message: 'กรุณาอัปโหลดไฟล์!' });

        // แปลงไฟล์ที่ได้จาก Multer (ที่เก็บใน memory) เป็น Buffer
        const fileBuffer = file.buffer; // file.buffer จะเป็น Buffer ของไฟล์ที่อัปโหลด

        // ใส่ข้อมูลลงในฐานข้อมูล
        const startTime = Date.now();
        const insertData = await pm.carousels.create({
            data: {
                carousel_name: carouselData.carousel_name, // ชื่อของการตั้งค่า carousel
                carousel_image: fileBuffer, // เก็บไฟล์เป็น Binary ในฐานข้อมูล
                created_by: fullname,
                updated_by: fullname
            }
        });
        const endTime = Date.now() - startTime;

        // บันทึก Log
        await pm.carousels_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: insertData ? 1 : 0,
                status: insertData ? 'Success' : 'Failed'
            }
        });

        return msg(res, 200, { message: 'Insert data successfully!' });
    } catch (err) {
        console.error('insertDataCarousel : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function สำหรับ Insert ข้อมูลไปยัง Database
exports.updateDataSettingCarousel = async (req, res) => {
    try {
        const carouselData = req.body;
        const carouselId = req.params.id;
        const fullname = req.user.fullname_thai;
        const file = req.file;

        const fetchOneCarouselById = await pm.carousels.findFirst({
            where: {
                carousel_id: Number(carouselId)
            },
            select: {
                carousel_id: true
            }
        });
        if(!fetchOneCarouselById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${carouselId} ) อยู่ในระบบ!` })

        let dataToUpdate = {
            carousel_name: carouselData.carousel_name,
            updated_by: fullname
        };

        if (file) dataToUpdate.carousel_image = file.buffer;

        const startTime = Date.now();
        const updateData = await pm.carousels.update({
            where: { carousel_id: Number(carouselId) },
            data: dataToUpdate
        });
        const endTime = Date.now() - startTime;

        await pm.carousels_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: updateData ? 1 : 0,
                status: updateData ? 'Success' : 'Failed'
            }
        });

        return msg(res, 200, { message: 'Update data successfully!' });
    } catch (err) {
        console.error('updateDataCarousel : ', err);
        return msg(res, 500, { message: err.message });
    }
};

// Function สำหรับ Delete ข้อมูลจาก Database
exports.removeDataSettingCarousel = async (req, res) => {
    try {
        const carouselId = req.params.id;
        const fullname = req.user.fullname_thai;

        // ตรวจสอบว่ามี ID นี้ในระบบหรือไม่
        const fetchOneCarouselById = await pm.carousels.findFirst({
            where: { carousel_id: Number(carouselId) },
            select: { carousel_id: true }
        });
        if (!fetchOneCarouselById) return msg(res, 404, { message: `ไม่มีข้อมูล ( ID: ${carouselId} ) อยู่ในระบบ!` });

        // ตรวจสอบว่ามี Foreign Key หรือไม่
        const checkForeignKey = await pm.$queryRaw`
            SELECT TABLE_NAME, COLUMN_NAME
            FROM INFORMATION_SCHEMA.KEY_COLUMN_USAGE
            WHERE REFERENCED_TABLE_NAME = 'carousels'
            AND REFERENCED_COLUMN_NAME = 'carousel_id'
            AND EXISTS (
                SELECT 1 FROM INFORMATION_SCHEMA.TABLES WHERE TABLE_NAME = KEY_COLUMN_USAGE.TABLE_NAME
            )
        `;

        if (checkForeignKey.length > 0) {
            let hasReference = false;
            let referencedTables = [];

            // ตรวจสอบแต่ละตารางว่ามีข้อมูลอ้างอิงอยู่หรือไม่
            for (const row of checkForeignKey) {
                const tableName = row.TABLE_NAME;
                const columnName = row.COLUMN_NAME;

                const checkData = await pm.$queryRawUnsafe(`
                    SELECT 1 FROM ${tableName} WHERE ${columnName} = ${Number(req.params.id)} LIMIT 1
                `);

                if (checkData.length > 0) {
                    hasReference = true;
                    referencedTables.push(tableName);
                }
            }

            // ถ้ามีตารางที่อ้างอิงอยู่ → ห้ามลบ
            if (hasReference) {
                return msg(res, 400, { 
                    message: `ไม่สามารถลบได้ เนื่องจาก carousel_id ถูกใช้งานอยู่ในตาราง: ${referencedTables.join(', ')} กรุณาลบข้อมูลที่เกี่ยวข้องก่อน!` 
                });
            }
        }

        // ลบข้อมูล
        const startTime = Date.now();
        const removeData = await pm.carousels.delete({
            where: { carousel_id: Number(carouselId) }
        });
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง carousels_log
        await pm.carousels_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: removeData ? 1 : 0,
                status: removeData ? 'Success' : 'Failed'
            }
        });

        // ดึงค่า MAX(carousel_id)
        const maxIdResult = await pm.$queryRaw`SELECT COALESCE(MAX(carousel_id), 0) + 1 AS nextId FROM carousels`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE carousels AUTO_INCREMENT = ${maxIdResult[0].nextId}`);

        return msg(res, 200, { message: 'Deleted successfully!' });

    } catch (err) {
        console.log('removeDataCarousel : ', err);
        return msg(res, 500, { message: err.message });
    }
};