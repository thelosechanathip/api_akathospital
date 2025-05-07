exports.buildLogPayload = async (req, { fullname_thai }) => {
    const logPayload = {
        ip_address: req.headers['x-forwarded-for'] || req.ip,
        name: fullname_thai,
        request_method: req.method,
        endpoint: req.originalUrl
    };

    return logPayload;
};