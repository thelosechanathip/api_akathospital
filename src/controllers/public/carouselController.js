const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');
const sharp = require('sharp');

// Function สำหรับ FetchAll ข้อมูลจาก Database
exports.getAllDataCarousels = async (req, res) => {
    try {
        const resultData = await pm.carousels.findMany({
            include: {
                carousel_image: false
            }
        });

        if(resultData.length === 0) return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });

        // แปลงข้อมูลที่เก็บเป็น Blob ให้เป็น URL สำหรับแสดงภาพ
        const resultWithImageUrl = resultData.map((carousel) => {
            const imageBlobUrl = `/carouselShowImage/${carousel.carousel_id}`;
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

exports.getCarouselImage = async (req, res) => {
    try {
        const { carousel_id } = req.params;  // ดึง id ของ carousel
        const carousel = await pm.carousels.findUnique({ where: { carousel_id: Number(carousel_id) } });

        if (!carousel || !carousel.carousel_image) return res.status(404).json({ message: 'ไม่พบภาพหรือข้อมูลที่เกี่ยวข้อง' });

        // ใช้ sharp เพื่อปรับขนาดภาพ (ตัวอย่าง: ปรับขนาดเป็น 500px wide)
        const resizedImage = await sharp(carousel.carousel_image)
            .resize(1000)  // ปรับขนาดความกว้างของภาพเป็น 1000px
            .sharpen()  // เพิ่มความชัดให้กับภาพ
            .toBuffer();  // เปลี่ยนเป็น buffer ที่สามารถส่งกลับไปได้

        // ตั้งค่า Content-Type เป็น image/jpeg หรือ image/png ขึ้นอยู่กับประเภทของภาพ
        res.setHeader('Content-Type', 'image/jpeg');  // หรือ 'image/png' ขึ้นอยู่กับประเภทของภาพ
        res.send(resizedImage);  // ส่งภาพที่มีขนาดใหม่ไปยัง Client

    } catch (err) {
        console.error('Error fetching image: ', err);
        res.status(500).json({ message: 'เกิดข้อผิดพลาดในการดึงภาพ' });
    }
};