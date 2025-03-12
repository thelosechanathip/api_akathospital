exports.msg = async(res, status, data) => {
    try {
        if(!res || !status || !data) {
            return res.status(404).json(data);
        } else {
            return res.status(status).json(data);
        }
    } catch (err) {
        console.error(err.message);
        throw new Error("Failed to function MSG data");
    }
}