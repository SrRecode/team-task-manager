'use strict';

const express = require('express');
const { requireAuth } = require('../../middleware/requireAuth');
const controller = require('./reminder.controller');

const router = express.Router();

router.use(requireAuth);

router.get('/', controller.listReminders);

module.exports = router;
