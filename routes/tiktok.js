const express = require('express');
const router = express.Router();
const tiktokCtrl = require('../controllers/tiktok')


router.get('/video-upload/:userId', tiktokCtrl.uploadVideo);
router.get('/video-upload/params/:userId', tiktokCtrl.getTikTokUploadParams);


module.exports = router;