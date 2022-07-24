const express = require('express');
const cors = require('cors');
require('dotenv').config();

const app = express();

//middle ware
app.use(cors());

app.use('/clerk/webhooks/users', require('./routes/users'));
app.use('/tiktok', require('./routes/tiktok'));


exports.hey = app;