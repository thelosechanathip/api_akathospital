const express = require('express');
const router = express.Router();
const { authCheckToken, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const { 
    insertFormIpd, 
    removeFormIpd 
} = require('../../controllers/private/formIpdController');
const { 
    fetchHospitalProfileController, 
    createHospitalProfileController, 
    updateHospitalProfileController,
    removeHospitalProfileController
} = require('../../controllers/private/hospitalProfileController');
const {
    fetchDirectorBiographiesController,
    createDirectorBiographieController,
    updateDirectorBiographieController,
    removeDirectorBiographieController
} = require('../../controllers/private/directorBiographieController');

const baseMedicalRecordAudit = 'medicalRecordAudit';
router.post(`/${baseMedicalRecordAudit}`, authCheckToken, insertFormIpd);
router.delete(`/${baseMedicalRecordAudit}/:an`, authCheckToken, removeFormIpd);

const baseHospitalProfile = 'hospitalProfile';
router.get(`/${baseHospitalProfile}`, authCheckToken, fetchHospitalProfileController);
router.post(`/${baseHospitalProfile}`, authCheckToken, createHospitalProfileController);
router.put(`/${baseHospitalProfile}/:id`, authCheckToken, updateHospitalProfileController);
router.delete(`/${baseHospitalProfile}/:id`, authCheckToken, removeHospitalProfileController);

const baseDirectorBiographies = 'directorBiographies';
router.get(`/${baseDirectorBiographies}`, authCheckToken, fetchDirectorBiographiesController);
router.post(`/${baseDirectorBiographies}`, authCheckToken, createDirectorBiographieController);
router.put(`/${baseDirectorBiographies}/:id`, authCheckToken, updateDirectorBiographieController);
router.delete(`/${baseDirectorBiographies}/:id`, authCheckToken, removeDirectorBiographieController);

module.exports = router;