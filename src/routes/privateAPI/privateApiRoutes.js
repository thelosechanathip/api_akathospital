const express = require('express');
const router = express.Router();
const { authCheckToken, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const { insertFormIpd, removeFormIpd } = require('../../controllers/privateAPI/medicalRecord/formIpdController');

const medicalRecordAudit = 'medicalRecordAudit';
router.post(`/${medicalRecordAudit}/insertFormIpd`, authCheckToken, insertFormIpd);
router.delete(`/${medicalRecordAudit}/removeFormIpd/:an`, authCheckToken, removeFormIpd);

module.exports = router;