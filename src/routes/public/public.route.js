const express = require('express');
const router = express.Router();

const { PrismaClient } = require("@prisma/client");
const prisma = new PrismaClient();

const { getAllDataCarousels, getCarouselImage } = require('../../controllers/public/carouselController');

const { getAllDataHcodes } = require('../../controllers/public/hcodeController');

const { authCheckToken, authCheckTokenParams, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const { getAllDataComplaints, insertDataComplaint, removeDataComplaint } = require('../../controllers/public/complaintController');
const { getSignatureImage, fetchDataAllAttendanceRecord, searchDateAttendanceRecord, searchAttendanceRecords, fetchHolidays, checkIn, checkInVerifyOtp, checkOut, getShifts, fetchGps, fetchAttendanceRecordById} = require('../../controllers/public/attendanceRecordController');

// Sycn Setting
const { getAllDataDepartments, syncDataDepartments } = require('../../controllers/public/departmentController');
const { getAllDataPrefixes, syncDataPrefixes } = require('../../controllers/public/prefixController');
const { getAllDataPositions, syncDataPositions } = require('../../controllers/public/positionController');

const { getEmployeeSystemRequests, createEmployeeSystemRequest, removeEmployeeSystemRequest } = require('../../controllers/public/employeeSystemRequestController');

const trainingController = require('../../controllers/public/trainingController')

router.get("/health", async (req, res) => {
  try {
    await prisma.$queryRawUnsafe("SELECT 1");
    res.status(200).json({
        statusCode: 200,
        status: "success",
        ok: true,
        prisma: "connected",
        api: "alive",
        timestamp: new Date().toLocaleString("th-TH"),
    });
  } catch (error) {
    res.status(500).json({
        statusCode: 500,
        status: "error",
        ok: false,
        prisma: "disconnected",
        api: "alive",
        error: error.message,
        timestamp: new Date().toLocaleString("th-TH"),
    });
  }
});

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
router.get('/fetchAttendanceRecordsById/:id', authCheckToken, fetchAttendanceRecordById);
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