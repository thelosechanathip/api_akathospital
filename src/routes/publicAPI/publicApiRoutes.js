const express = require('express');
const router = express.Router();
const { authCheckToken, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const { getAllDataComplaints, insertDataComplaint, removeDataComplaint } = require('../../controllers/publicAPI/complaintController');
const { fetchDataAllAttendanceRecord, searchDateAttendanceRecord, searchAttendanceRecords, checkIn, checkInVerifyOtp, checkOut } = require('../../controllers/publicAPI/attendanceRecordController');

router.get('/getComplaints', authCheckToken, getAllDataComplaints);
router.post('/insertComplaint', insertDataComplaint);
router.delete('/removeComplaint/:id', authCheckTokenAdmin, removeDataComplaint);

router.get('/fetchDataAllAttendanceRecord', authCheckToken, fetchDataAllAttendanceRecord);
router.get('/searchDateAttendanceRecord/:date_start/:date_end', authCheckToken, searchDateAttendanceRecord);
router.get('/searchAttendanceRecords/:keyword', authCheckToken, searchAttendanceRecords);
router.post('/checkIn', checkIn);
router.post('/checkInVerifyOtp', checkInVerifyOtp);
router.post('/checkOut', checkOut);

module.exports = router;