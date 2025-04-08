const express = require('express');
const { upload } = require('../../middleware/setting/upload');
const router = express.Router();
const { authCheckToken, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');

// Log
const { clearLog } = require('../../controllers/setting/logController');

// Hcode
const { getAllDataHcodes, upsertDataHcode, removeDataHcode } = require('../../controllers/setting/hcodeController');

// Api Version
const { getAllDataApiVersions, insertDataApiVersion, updateDataApiVersion, removeDataApiVersion } = require('../../controllers/setting/apiVersionController');
const { getAllDataApiVersionDetails, insertDataApiVersionDetail, updateDataApiVersionDetail, removeDataApiVersionDetail } = require('../../controllers/setting/apiVersionDetailController');

// Akathospital Version
const { getAllDataAkathospitalVersions, insertDataAkathospitalVersion, updateDataAkathospitalVersion, removeDataAkathospitalVersion } = require('../../controllers/setting/akathospitalVersionController');
const { getAllDataAkathospitalVersionDetails, insertDataAkathospitalVersionDetail, updateDataAkathospitalVersionDetail, removeDataAkathospitalVersionDetail } = require('../../controllers/setting/akathospitalVersionDetailController');

// Akathospital Setting
const { getAllDataSettingCarousels, insertDataSettingCarousel, updateDataSettingCarousel, removeDataSettingCarousel } = require('../../controllers/setting/carouselController');

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

// API Version Setting Start
    // ApiVersion
    router.get('/getApiVersions', authCheckTokenAdmin, getAllDataApiVersions);
    router.post('/insertApiVersion', authCheckTokenAdmin, insertDataApiVersion);
    router.put('/updateApiVersion/:id', authCheckTokenAdmin, updateDataApiVersion);
    router.delete('/removeApiVersion/:id', authCheckTokenAdmin, removeDataApiVersion);

    // ApiVersionDetail
    router.get('/getApiVersionDetails', authCheckTokenAdmin, getAllDataApiVersionDetails);
    router.post('/insertApiVersionDetail', authCheckTokenAdmin, insertDataApiVersionDetail);
    router.put('/updateApiVersionDetail/:id', authCheckTokenAdmin, updateDataApiVersionDetail);
    router.delete('/removeApiVersionDetail/:id', authCheckTokenAdmin, removeDataApiVersionDetail);
// API Version Setting End

// Akathospital Version Setting Start
    // AkathospitalVersion
    router.get('/getAkathospitalVersions', authCheckTokenAdmin, getAllDataAkathospitalVersions);
    router.post('/insertAkathospitalVersion', authCheckTokenAdmin, insertDataAkathospitalVersion);
    router.put('/updateAkathospitalVersion/:id', authCheckTokenAdmin, updateDataAkathospitalVersion);
    router.delete('/removeAkathospitalVersion/:id', authCheckTokenAdmin, removeDataAkathospitalVersion);

    // AkathospitalVersionDetail
    router.get('/getAkathospitalVersionDetails', authCheckTokenAdmin, getAllDataAkathospitalVersionDetails);
    router.post('/insertAkathospitalVersionDetail', authCheckTokenAdmin, insertDataAkathospitalVersionDetail);
    router.put('/updateAkathospitalVersionDetail/:id', authCheckTokenAdmin, updateDataAkathospitalVersionDetail);
    router.delete('/removeAkathospitalVersionDetail/:id', authCheckTokenAdmin, removeDataAkathospitalVersionDetail);
// Akathospital Version Setting End

// Complaint Setting Start
    // ComplaintTopics
    router.get('/getComplaintTopics', getAllDataComplaintTopics);
    router.post('/insertComplaintTopics', insertDataComplaintTopic);
    router.put('/updateComplaintTopics/:id', authCheckTokenAdmin, updateDataComplaintTopic);
    router.delete('/removeComplaintTopics/:id', authCheckTokenAdmin, removeDataComplaintTopic);
// Complaint Setting End

// CheckIn & CheckOut Setting Start
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
// CheckIn & CheckOut Setting End

// ActivityTopic
router.get('/getActivityTopics', authCheckTokenAdmin, getAllDataActivityTopics);
router.post('/insertActivityTopic', authCheckTokenAdmin, insertDataActivityTopic);
// router.put('/updateActivityTopic/:id', authCheckTokenAdmin, updateDataActivityTopic);
// router.delete('/removeActivityTopic/:id', authCheckTokenAdmin, removeDataActivityTopic);

// Madical record audit Setting Start
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
// Madical record audit Setting End

// Akathospital Setting Start
    router.get('/getSettingCarousels', authCheckTokenAdmin, getAllDataSettingCarousels);
    router.post('/insertSettingCarousel', authCheckTokenAdmin, upload.single('carousel_image'), insertDataSettingCarousel);
    router.put('/updateSettingCarousel/:id', authCheckTokenAdmin, upload.single('carousel_image'), updateDataSettingCarousel);
    router.delete('/removeSettingCarousel/:id', authCheckTokenAdmin, removeDataSettingCarousel);
// Akathospital Setting End

// Log Start
    router.post('/clearLog', authCheckTokenAdmin, clearLog);
// Log End

// Hcode Start
    router.get('/getSettingHcodes', authCheckTokenAdmin, getAllDataHcodes);
    router.post('/upsertSettingHcode', authCheckTokenAdmin, upsertDataHcode);
    router.delete('/removeSettingHcode/:id', authCheckTokenAdmin, removeDataHcode);
// Hcode End

module.exports = router;