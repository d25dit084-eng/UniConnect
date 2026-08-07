const express = require('express');
const router = express.Router();

const { submitReport } = require('../controllers/reportController');
const { protect } = require('../middleware/authMiddleware');

router.post('/', protect, submitReport);

module.exports = router;
