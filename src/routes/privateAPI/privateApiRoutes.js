const express = require('express');
const router = express.Router();
const { authCheckToken, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const { upsertFormIpd } = require('../../controllers/privateAPI/medicalRecord/formIpdController');

const medicalRecordAudit = 'medicalRecordAudit';
router.post(`/${medicalRecordAudit}/upsertFormIpd`, authCheckToken, upsertFormIpd)

module.exports = router;