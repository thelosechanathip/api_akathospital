exports.buildLogPayload = async (req, fullname) => {
    const logPayload = {
        ip_address: req.headers['x-forwarded-for'] || req.ip,
        name: fullname,
        request_method: req.method,
        endpoint: req.originalUrl
    };

    return logPayload;
};