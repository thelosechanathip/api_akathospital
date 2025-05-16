const express = require('express');
const router = express.Router();
const { authCheckToken, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const mraIPDController = require('../../controllers/private/mraIPD.controller');
const { 
    fetchHospitalProfileController, 
    createHospitalProfileController, 
    updateHospitalProfileController,
    removeHospitalProfileController
} = require('../../controllers/private/hospitalProfile.controller');
const {
    fetchDirectorBiographiesController,
    createDirectorBiographieController,
    updateDirectorBiographieController,
    removeDirectorBiographieController
} = require('../../controllers/private/directorBiographie.controller');

const baseMedicalRecordAudit = 'mraIPD';
router.get(`/${baseMedicalRecordAudit}`, authCheckToken, mraIPDController.fetchMraIpdController);
router.get(`/${baseMedicalRecordAudit}/:an`, authCheckToken, mraIPDController.fetchOneMraIpdController);
router.get(`/${baseMedicalRecordAudit}/fetchPatient/:an`, authCheckToken, mraIPDController.fetchPatientDataController);
router.post(`/${baseMedicalRecordAudit}`, authCheckToken, mraIPDController.generateFormMraIpdController);
router.delete(`/${baseMedicalRecordAudit}/:an`, authCheckToken, mraIPDController.removeMraIpdController);

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