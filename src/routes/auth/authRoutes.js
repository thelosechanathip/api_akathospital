const express = require('express');
const router = express.Router();
const { authCheckToken, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const { authRegister, authEditUser, authLogin, authVerifyOtp, authVerifyToken, authLogout } = require('../../controllers/auth/authController'); // require AuthController

// @ENDPOINT = http://localhost:3715/api_m/
router.post('/authRegister', authRegister);
router.post('/authLogin', authLogin);
router.post('/authVerifyOtp', authVerifyOtp);
router.post('/authVerifyToken', authCheckToken, authVerifyToken);
router.post('/authLogout', authCheckToken, authLogout);

module.exports = router;