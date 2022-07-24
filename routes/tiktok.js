const express = require('express');
const router = express.Router();
const tiktokCtrl = require('../controllers/tiktok')


router.get('/video-upload/:userId', tiktokCtrl.uploadVideo);

module.exports = router;