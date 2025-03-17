const express = require('express');
const router = express.Router();
const { authCheckToken, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const { getAllDataComplaintTopics, insertDataComplaintTopic, updateDataComplaintTopic, removeDataComplaintTopic } = require('../../controllers/setting/complaintTopicController');
const { getAllDataCheckInStatus, insertDataCheckInStatus, updateDataCheckInStatus, removeDataCheckInStatus } = require('../../controllers/setting/checkInStatusController');
const { getAllDataCheckOutStatus, insertDataCheckOutStatus, updateDataCheckOutStatus, removeDataCheckOutStatus } = require('../../controllers/setting/checkOutStatusController');
const { getAllDataHolidays, insertDataHoliday, updateDataHoliday, removeDataHoliday } = require('../../controllers/setting/holidayController');
const { getAllDataShiftTypes, insertDataShiftType, updateDataShiftType, removeDataShiftType } = require('../../controllers/setting/shiftTypeController');

// ComplaintTopics
router.get('/getComplaintTopics', getAllDataComplaintTopics);
router.post('/insertComplaintTopics', insertDataComplaintTopic);
router.put('/updateComplaintTopics/:id', updateDataComplaintTopic);
router.delete('/removeComplaintTopics/:id', removeDataComplaintTopic);

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
router.post('/insertHoliday', authCheckTokenAdmin, insertDataHoliday);
router.put('/updateHoliday/:id', authCheckTokenAdmin, updateDataHoliday);
router.delete('/removeHoliday/:id', authCheckTokenAdmin, removeDataHoliday);

// ShiftType
router.get('/getShiftTypes', authCheckTokenAdmin, getAllDataShiftTypes);
router.post('/insertShiftType', authCheckTokenAdmin, insertDataShiftType);
router.put('/updateShiftType/:id', authCheckTokenAdmin, updateDataShiftType);
// router.delete('/removeShiftType/:id', authCheckTokenAdmin, removeDataShiftType);

module.exports = router;