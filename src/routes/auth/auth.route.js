const express = require('express');
const router = express.Router();
const { authCheckToken, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const { fetchDataAll, authRegister, authLogin, authVerifyOtp, authVerifyToken, generateSignature, fetchSignature, fetchImage, editUser, removeUser, authLogout } = require('../../controllers/auth/auth.controller'); // require AuthController

// @ENDPOINT = http://localhost:3715/api_m/
router.get('/fetchDataAll', authCheckToken, fetchDataAll);
router.post('/authRegister', authRegister);
router.post('/authLogin', authLogin);
router.post('/authVerifyOtp', authVerifyOtp);
router.post('/authVerifyToken', authCheckToken, authVerifyToken);
router.post('/generateSignature', authCheckToken, generateSignature);
router.get('/fetchSignature', authCheckToken, fetchSignature);
router.get('/fetchImage', authCheckToken, fetchImage);
router.put('/editUser', authCheckToken, editUser);
router.delete('/removeUser/:id', authCheckToken, removeUser);
router.post('/authLogout', authCheckToken, authLogout);

module.exports = router;