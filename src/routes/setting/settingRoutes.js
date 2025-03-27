const express = require('express');
const router = express.Router();
const { authCheckToken, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');

// Api Version
const { getAllDataApiVersions, insertDataApiVersion, updateDataApiVersion, removeDataApiVersion } = require('../../controllers/setting/apiVersionController');

// Attendance Record Setting
const { getAllDataComplaintTopics, insertDataComplaintTopic, updateDataComplaintTopic, removeDataComplaintTopic } = require('../../controllers/setting/complaintTopicController');
const { getAllDataCheckInStatus, insertDataCheckInStatus, updateDataCheckInStatus, removeDataCheckInStatus } = require('../../controllers/setting/checkInStatusController');
const { getAllDataCheckOutStatus, insertDataCheckOutStatus, updateDataCheckOutStatus, removeDataCheckOutStatus } = require('../../controllers/setting/checkOutStatusController');
const { getAllDataHolidays, syncDataHoliday } = require('../../controllers/setting/holidayController');
const { getAllDataShiftTypes, insertDataShiftType, updateDataShiftType, removeDataShiftType } = require('../../controllers/setting/shiftTypeController');
const { getAllDataShifts, insertDataShift, updateDataShift, removeDataShift } = require('../../controllers/setting/shiftController');
const { getAllDataActivityTopics, insertDataActivityTopic, updateDataActivityTopic, removeDataActivityTopic } = require('../../controllers/setting/activityTopicController');

// Medical Record Audit Setting
const { getAllDataPatientServices, insertDataPatientService, updateDataPatientService, removeDataPatientService } = require('../../controllers/setting/patientServiceController');
const { getAllDataReviewStatus, insertDataReviewStatus, updateDataReviewStatus, removeDataReviewStatus } = require('../../controllers/setting/reviewStatusController');
const { getAllDataOverallFinding, insertDataOverallFinding, updateDataOverallFinding, removeDataOverallFinding } = require('../../controllers/setting/overallFindingController');
const { getAllDataContentOfMedicalRecords, insertDataContentOfMedicalRecord, updateDataContentOfMedicalRecord, removeDataContentOfMedicalRecord } = require('../../controllers/setting/contentOfMedicalRecordController');

// ApiVersion
router.get('/getApiVersions', authCheckTokenAdmin, getAllDataApiVersions);
// router.post('/insertApiVersion', authCheckTokenAdmin, insertDataApiVersion);
// router.put('/updateApiVersion/:id', authCheckTokenAdmin, updateDataApiVersion);
// router.delete('/removeApiVersion/:id', authCheckTokenAdmin, removeDataApiVersion);

// ComplaintTopics
router.get('/getComplaintTopics', authCheckTokenAdmin, getAllDataComplaintTopics);
router.post('/insertComplaintTopics', authCheckTokenAdmin, insertDataComplaintTopic);
router.put('/updateComplaintTopics/:id', authCheckTokenAdmin, updateDataComplaintTopic);
router.delete('/removeComplaintTopics/:id', authCheckTokenAdmin, removeDataComplaintTopic);

// CheckInStatus
router.get('/getCheckInStatus', authCheckTokenAdmin, getAllDataCheckInStatus);
router.post('/insertCheckInStatus', authCheckTokenAdmin, insertDataCheckInStatus);
router.put('/updateCheckInStatus/:id', authCheckTokenAdmin, updateDataCheckInStatus);
router.delete('/removeCheckInStatus/:id', authCheckTokenAdmin, removeDataCheckInStatus);

// CheckOutStatus
router.get('/getCheckOutStatus', authCheckTokenAdmin, getAllDataCheckOutStatus);
router.post('/insertCheckOutStatus', authCheckTokenAdmin, insertDataCheckOutStatus);
router.put('/updateCheckOutStatus/:id', authCheckTokenAdmin, updateDataCheckOutStatus);
router.delete('/removeCheckOutStatus/:id', authCheckTokenAdmin, removeDataCheckOutStatus);

// Holiday
router.get('/getHolidays', authCheckTokenAdmin, getAllDataHolidays);
router.post('/syncHolidays', authCheckTokenAdmin, syncDataHoliday);

// ShiftType
router.get('/getShiftTypes', authCheckTokenAdmin, getAllDataShiftTypes);
router.post('/insertShiftType', authCheckTokenAdmin, insertDataShiftType);
router.put('/updateShiftType/:id', authCheckTokenAdmin, updateDataShiftType);
router.delete('/removeShiftType/:id', authCheckTokenAdmin, removeDataShiftType);

// Shift
router.get('/getShifts', authCheckTokenAdmin, getAllDataShifts);
router.post('/insertShift', authCheckTokenAdmin, insertDataShift);
router.put('/updateShift/:id', authCheckTokenAdmin, updateDataShift);
router.delete('/removeShift/:id', authCheckTokenAdmin, removeDataShift);

// ActivityTopic
router.get('/getActivityTopics', authCheckTokenAdmin, getAllDataActivityTopics);
router.post('/insertActivityTopic', authCheckTokenAdmin, insertDataActivityTopic);
// router.put('/updateActivityTopic/:id', authCheckTokenAdmin, updateDataActivityTopic);
// router.delete('/removeActivityTopic/:id', authCheckTokenAdmin, removeDataActivityTopic);

// PatientService
router.get('/getPatientServices', authCheckTokenAdmin, getAllDataPatientServices);
router.post('/insertPatientService', authCheckTokenAdmin, insertDataPatientService);
router.put('/updatePatientService/:id', authCheckTokenAdmin, updateDataPatientService);
router.delete('/removePatientService/:id', authCheckTokenAdmin, removeDataPatientService);

// ReviewStatus
router.get('/getReviewStatus', authCheckTokenAdmin, getAllDataReviewStatus);
router.post('/insertReviewStatus', authCheckTokenAdmin, insertDataReviewStatus);
router.put('/updateReviewStatus/:id', authCheckTokenAdmin, updateDataReviewStatus);
router.delete('/removeReviewStatus/:id', authCheckTokenAdmin, removeDataReviewStatus);

// OverallFinding
router.get('/getOverallFinding', authCheckTokenAdmin, getAllDataOverallFinding);
router.post('/insertOverallFinding', authCheckTokenAdmin, insertDataOverallFinding);
router.put('/updateOverallFinding/:id', authCheckTokenAdmin, updateDataOverallFinding);
router.delete('/removeOverallFinding/:id', authCheckTokenAdmin, removeDataOverallFinding);

// ContentOfMedicalRecord
router.get('/getContentOfMedicalRecords', authCheckTokenAdmin, getAllDataContentOfMedicalRecords);
router.post('/insertContentOfMedicalRecord', authCheckTokenAdmin, insertDataContentOfMedicalRecord);
router.put('/updateContentOfMedicalRecord/:id', authCheckTokenAdmin, updateDataContentOfMedicalRecord);
router.delete('/removeContentOfMedicalRecord/:id', authCheckTokenAdmin, removeDataContentOfMedicalRecord);

module.exports = router;