const express = require('express');
const router = express.Router();

const { getAllDataCarousels, getCarouselImage } = require('../../controllers/publicAPI/carouselController');

const { getAllDataHcodes } = require('../../controllers/publicAPI/hcodeController');

const { authCheckToken, authCheckTokenParams, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const { getAllDataComplaints, insertDataComplaint, removeDataComplaint } = require('../../controllers/publicAPI/complaintController');
const { getSignatureImage, fetchDataAllAttendanceRecord, searchDateAttendanceRecord, searchAttendanceRecords, fetchHolidays, checkIn, checkInVerifyOtp, checkOut } = require('../../controllers/publicAPI/attendanceRecordController');

// Sycn Setting
const { getAllDataDepartments, syncDataDepartments } = require('../../controllers/publicAPI/departmentController');
const { getAllDataPrefixes, syncDataPrefixes } = require('../../controllers/publicAPI/prefixController');
const { getAllDataPositions, syncDataPositions } = require('../../controllers/publicAPI/positionController');

const { getEmployeeSystemRequests } = require('../../controllers/publicAPI/employeeSystemRequestController');

// EmployeeSystemRequest
router.get('/getEmployeeSystemRequests', getEmployeeSystemRequests);

// Complaints
router.get('/getComplaints', authCheckToken, getAllDataComplaints);
router.post('/insertComplaint', insertDataComplaint);
router.delete('/removeComplaint/:id', authCheckTokenAdmin, removeDataComplaint);

// AttendanceRecord( ระบบลงเวลาเข้าทำงาน )
router.get('/signatureShowImage/:token/:signature_id', authCheckTokenParams, getSignatureImage);
router.get('/fetchDataAllAttendanceRecord', authCheckToken, fetchDataAllAttendanceRecord);
router.get('/searchDateAttendanceRecord/:date_start/:date_end', authCheckToken, searchDateAttendanceRecord);
router.get('/searchAttendanceRecords/:keyword', authCheckToken, searchAttendanceRecords);
router.get('/fetchHolidays', fetchHolidays);
router.post('/checkIn', checkIn);
router.post('/checkInVerifyOtp', checkInVerifyOtp);
router.post('/checkOut', checkOut);

// Carousel Start
    router.get('/getCarousels', getAllDataCarousels);
    router.get('/carouselShowImage/:carousel_id', getCarouselImage);
// Carousel End

// Hcode Start
    router.get('/getHcodes', getAllDataHcodes);
// Hcode End

// Sycn Setting Start
    // Department
        router.get('/getDepartments', getAllDataDepartments);
        router.post('/syncDepartments', syncDataDepartments);
    
    // Prefix
        router.get('/getPrefixes', getAllDataPrefixes);
        router.post('/syncPrefixes', syncDataPrefixes);

    // Position
        router.get('/getPositions', getAllDataPositions);
        router.post('/syncPositions', syncDataPositions);
// Sycn Setting End

module.exports = router;