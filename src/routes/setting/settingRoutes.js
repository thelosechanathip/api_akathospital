const express = require('express');
const router = express.Router();
const { getAllDataComplaintTopics, insertDataComplaintTopic, updateDataComplaintTopic, removeDataComplaintTopic } = require('../../controllers/setting/complaintTopicController');

router.get('/getComplaintTopics', getAllDataComplaintTopics);
router.post('/insertComplaintTopics', insertDataComplaintTopic);
router.put('/updateComplaintTopics/:id', updateDataComplaintTopic);
router.delete('/removeComplaintTopics/:id', removeDataComplaintTopic);

module.exports = router;