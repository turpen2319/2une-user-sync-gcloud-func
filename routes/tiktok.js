const express = require('express');
const router = express.Router();
const tiktokCtrl = require('../controllers/tiktok')


router.get('/video-upload/params/:userId', tiktokCtrl.getTikTokUploadParams);
router.get('/video-list/:userId', tiktokCtrl.getVideoList);
router.get('/transcode', tiktokCtrl.createJobFromPreset);
router.post('/generate-signed-url', tiktokCtrl.generateV4UploadSignedUrl);
router.post('/webm-to-mp4-upload', tiktokCtrl.webmToMP4TikTokUpload);
router.post('/mp4-to-mp4-upload', tiktokCtrl.fixMP4TikTokUpload);
// router.post('/test-ffmpeg', tiktokCtrl.ffmpegHandler);

module.exports = router;