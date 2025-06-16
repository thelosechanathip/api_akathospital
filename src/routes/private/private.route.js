const express = require('express');
const router = express.Router();
const { authCheckToken, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const mraIPDController = require('../../controllers/private/mraIPD.controller');
const hpController = require('../../controllers/private/hospitalProfile.controller');
const dbController = require('../../controllers/private/directorBiographie.controller');
const vmController = require('../../controllers/private/visionMission.controller');

const baseMedicalRecordAudit = 'mraIPD';
router.get(`/${baseMedicalRecordAudit}`, authCheckToken, mraIPDController.fetchMraIpdController);
router.get(`/${baseMedicalRecordAudit}/:an`, authCheckToken, mraIPDController.fetchOneMraIpdController);
router.get(`/${baseMedicalRecordAudit}/fetchPatient/:an`, authCheckToken, mraIPDController.fetchPatientDataController);
router.post(`/${baseMedicalRecordAudit}`, authCheckToken, mraIPDController.generateFormMraIpdController);
router.put(`/${baseMedicalRecordAudit}/:an`, authCheckToken, mraIPDController.updateFormMraIpdController);
router.delete(`/${baseMedicalRecordAudit}/:an`, authCheckToken, mraIPDController.removeMraIpdController);

const baseHospitalProfile = 'hospitalProfile';
router.get(`/${baseHospitalProfile}`, authCheckToken, hpController.fetchHospitalProfileController);
router.post(`/${baseHospitalProfile}`, authCheckToken, hpController.createHospitalProfileController);
router.put(`/${baseHospitalProfile}/:id`, authCheckToken, hpController.updateHospitalProfileController);
router.delete(`/${baseHospitalProfile}/:id`, authCheckToken, hpController.removeHospitalProfileController);

const baseDirectorBiographies = 'directorBiographies';
router.get(`/${baseDirectorBiographies}`, authCheckToken, dbController.fetchDirectorBiographiesController);
router.post(`/${baseDirectorBiographies}`, authCheckToken, dbController.createDirectorBiographieController);
router.put(`/${baseDirectorBiographies}/:id`, authCheckToken, dbController.updateDirectorBiographieController);
router.delete(`/${baseDirectorBiographies}/:id`, authCheckToken, dbController.removeDirectorBiographieController);

const baseVisionMission = 'visionMission';
router.get(`/${baseVisionMission}`, authCheckToken, vmController.fetchVisionMissionsController);
router.post(`/${baseVisionMission}`, authCheckToken, vmController.createVisionMissionsController);
router.put(`/${baseVisionMission}/:id`, authCheckToken, vmController.updateVisionMissionsController);
router.delete(`/${baseVisionMission}/:id`, authCheckToken, vmController.removeVisionMissionsController);

module.exports = router;