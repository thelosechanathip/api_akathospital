const express = require('express');
const router = express.Router();
const { authCheckToken, authCheckTokenAdmin } = require('../../middleware/auth/authAdmin');
const { getAllDataComplaintTopics, insertDataComplaintTopic, updateDataComplaintTopic, removeDataComplaintTopic } = require('../../controllers/setting/complaintTopicController');
const { getAllDataCheckInStatus, insertDataCheckInStatus, updateDataCheckInStatus, removeDataCheckInStatus } = require('../../controllers/setting/checkInStatusController');

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

module.exports = router;