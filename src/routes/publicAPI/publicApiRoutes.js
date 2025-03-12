const express = require('express');
const router = express.Router();
const { getAllDataComplaints, insertDataComplaint, removeDataComplaint } = require('../../controllers/publicAPI/complaintController');

router.get('/getComplaints', getAllDataComplaints);
router.post('/insertComplaint', insertDataComplaint);
router.delete('/removeComplaint/:id', removeDataComplaint);

module.exports = router;