const express = require('express');
const router = express.Router();

const { getAllDataCarousels, getCarouselImage } = require('../../controllers/public/carouselController');

const { getAllDataHcodes } = require('../../controllers/public/hcodeController');

const { authCheckToken, authCheckTokenParams, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const { getAllDataComplaints, insertDataComplaint, removeDataComplaint } = require('../../controllers/public/complaintController');
const { getSignatureImage, fetchDataAllAttendanceRecord, searchDateAttendanceRecord, searchAttendanceRecords, fetchHolidays, checkIn, checkInVerifyOtp, checkOut, getShifts, fetchGps} = require('../../controllers/public/attendanceRecordController');

// Sycn Setting
const { getAllDataDepartments, syncDataDepartments } = require('../../controllers/public/departmentController');
const { getAllDataPrefixes, syncDataPrefixes } = require('../../controllers/public/prefixController');
const { getAllDataPositions, syncDataPositions } = require('../../controllers/public/positionController');

const { getEmployeeSystemRequests, createEmployeeSystemRequest, removeEmployeeSystemRequest } = require('../../controllers/public/employeeSystemRequestController');

const trainingController = require('../../controllers/public/trainingController')

// EmployeeSystemRequest
router.get('/getEmployeeSystemRequests', getEmployeeSystemRequests);
router.post('/createEmployeeSystemRequest', createEmployeeSystemRequest);
router.delete('/removeEmployeeSystemRequest/:id', removeEmployeeSystemRequest);

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
router.get('/fetchGps', fetchGps);
router.get("/fetchShifts", getShifts);
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

// Trainin Start
    const training = 'training'
    router.get(`/${training}`, trainingController.fetchAllDataSum)
    router.post(`/${training}`, trainingController.addTraining)
    router.put(`/${training}`, trainingController.updateTraining)
    router.delete(`/${training}/clearRandomStateJson`, trainingController.clearRandomStateJson)
// Trainin End

module.exports = router;