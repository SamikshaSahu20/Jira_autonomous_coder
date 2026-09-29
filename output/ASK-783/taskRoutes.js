const express = require('express');
const { getTeamTasks, updateTaskStatus } = require('./taskController');

const router = express.Router();

router.get('/', getTeamTasks);
router.put('/:id', updateTaskStatus);

module.exports = router;