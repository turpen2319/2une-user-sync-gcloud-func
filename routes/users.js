const express = require('express');
const router = express.Router();
const usersCtrl = require('../controllers/users')

router.post('/insert', usersCtrl.insertUser);
router.post('/update', usersCtrl.updateUser);


module.exports = router;