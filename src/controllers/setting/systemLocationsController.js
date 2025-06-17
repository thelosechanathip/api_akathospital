const pm = require('../../config/prisma');
const { msg } = require('../../utils/message');

exports.fetchSystemLocations = async (req, res) => {
    try {
        const fullname = req.user.fullname_thai;
        
        const startTime = Date.now();
        const result = await pm.system_locations.findMany();
        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง system_locations_log
        await pm.system_locations_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: result.length,
                status: result.length > 0 ? 'Success' : 'No Data'
            }
        });

        if(result.length === 0) return msg(res, 404, { message: 'ไม่มีข้อมูลบน Database!' });

        return msg(res, 200, { data: result });

    } catch (error) {
        console.log('fetchSystemLocations : ', error);
        return msg(res, 500, { message: error.message });
    }
};

exports.postSystemLocations = async (req, res, next) => {
    try {
        const fullname = req.user.fullname_thai;

        const { name, locations, radius, block } = req.body;

        if(!name || !locations || !radius) return msg(res, 400, 'กรุณากรอกข้อมูลให้ครบถ้วน!');

        let lat = locations?.split(',')[0].trim();
        let lon = locations?.split(',')[1].trim();

        const startTime = Date.now();

        const result = await pm.system_locations.create({
            data: {
                stl_name: name,
                stl_lat: parseFloat(lat),
                stl_lon: parseFloat(lon),
                stl_radius: Number(radius),
                stl_block: block,
                created_by: fullname,
                updated_by: fullname
            }
        });

        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง system_locations_log
        await pm.system_locations_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: result ? 1 : 0,
                status: result ? 'Success' : 'Failed'
            }
        });

        return msg(res, 200, { message: `${name} inserted successfully!` });
    } catch (error) {
        console.log('postSystemLocations : ', error);
        return msg(res, 500, { message: error.message });
    }
};

exports.putSystemLocations = async (req, res) => {
    try {
        const { id } = req.params;

        // Check id ที่ส่งมาว่ามีข้อมูลใน system_locations หรือไม่?
        const checkIdSystemLocations = await pm.system_locations.findFirst({
            where: {
                stl_id: Number(id)
            }
        });

        if(!checkIdSystemLocations) return msg(res, 404, { message: 'ไม่มีข้อมูล ( ID: ' + id + ' ) อยู่ในระบบ!' });

        const { name, locations, radius, block } = req.body;

        if(!name || !locations || !radius) return msg(res, 400, 'กรุณากรอกข้อมูลให้ครบถ้วน!');

        let lat = locations?.split(',')[0].trim();
        let lon = locations?.split(',')[1].trim();

        const fullname = req.user.fullname_thai;

        const startTime = Date.now();

        const result = await pm.system_locations.update({
            where: {
                stl_id: Number(id)
            },
            data: {
                stl_name: name,
                stl_lat: parseFloat(lat),
                stl_lon: parseFloat(lon),
                stl_radius: Number(radius),
                stl_block: block,
                updated_by: fullname
            }
        });

        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง system_locations_log
        await pm.system_locations_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: result ? 1 : 0,
                status: result ? 'Success' : 'Failed'
            }
        });

        return msg(res, 200, { message: `${name} updated successfully!` });
    } catch (error) {
        console.log('putSystemLocations : ', error);
        return msg(res, 500, { message: error.message });
    }
};

exports.removeSystemLocations = async (req, res) => {
    try {
        const { id } = req.params;

        // Check id ที่ส่งมาว่ามีข้อมูลใน system_locations หรือไม่?
        const checkIdSystemLocations = await pm.system_locations.findFirst({
            where: {
                stl_id: Number(id)
            }
        });

        if(!checkIdSystemLocations) return msg(res, 404, { message: 'ไม่มีข้อมูล ( ID: ' + id + ' ) อยู่ในระบบ!' });

        const fullname = req.user.fullname_thai;

        const startTime = Date.now();

        const result = await pm.system_locations.delete({
            where: {
                stl_id: Number(id)
            }
        });

        const endTime = Date.now() - startTime;

        // บันทึกข้อมูลไปยัง system_locations_log
        await pm.system_locations_log.create({
            data: {
                ip_address: req.headers['x-forwarded-for'] || req.ip,
                name: fullname,
                request_method: req.method,
                endpoint: req.originalUrl,
                execution_time: endTime,
                row_count: result ? 1 : 0,
                status: result ? 'Success' : 'Failed'
            }
        });

        const maxIdFormIpdResult = await pm.$queryRaw`SELECT COALESCE(MAX(stl_id), 0) + 1 AS nextId FROM system_locations`;

        // รีเซ็ตค่า AUTO_INCREMENT
        await pm.$executeRawUnsafe(`ALTER TABLE system_locations AUTO_INCREMENT = ${maxIdFormIpdResult[0].nextId}`);
        return msg(res, 200, { message: `ID: ${id} removed successfully!` });
    } catch (error) {
        console.log('removeSystemLocations : ', error);
        return msg(res, 500, { message: error.message });
    }
};