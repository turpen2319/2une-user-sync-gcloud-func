const express = require('express');
const router = express.Router();
const usersCtrl = require('../controllers/users')

router.post('/invite', usersCtrl.inviteUser);
router.post('/insert', usersCtrl.insertUser);
router.post('/create-session', usersCtrl.onCreateSession);
router.post('/update', usersCtrl.updateUser);
router.post('/sms/level-up', usersCtrl.notifyLevelUp);

module.exports = router;