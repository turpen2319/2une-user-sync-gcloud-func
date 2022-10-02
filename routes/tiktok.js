const express = require('express');
const router = express.Router();
const tiktokCtrl = require('../controllers/tiktok')


router.get('/video-upload/:userId', tiktokCtrl.uploadVideo);
router.get('/video-upload/params/:userId', tiktokCtrl.getTikTokUploadParams);
router.get('/video-list/:userId', tiktokCtrl.getVideoList);
router.get('/transcode', tiktokCtrl.createJobFromPreset);

module.exports = router;