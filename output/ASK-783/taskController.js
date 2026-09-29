const Task = require('./Task');

const getTeamTasks = async (req, res) => {
  try {
    const { status, page = 1, limit = 10 } = req.query;
    const query = status ? { status } : {};
    const tasks = await Task.find(query)
      .skip((page - 1) * limit)
      .limit(parseInt(limit));
    res.json(tasks);
  } catch (error) {
    console.error('Error fetching tasks:', error.message);
    res.status(500).json({ error: 'Failed to fetch tasks' });
  }
};

const updateTaskStatus = async (req, res) => {
  try {
    const { id } = req.params;
    const { status } = req.body;

    if (!['To Do', 'In Progress', 'Done'].includes(status)) {
      return res.status(400).json({ error: 'Invalid status value' });
    }

    const updatedTask = await Task.findByIdAndUpdate(id, { status }, { new: true });
    if (!updatedTask) {
      return res.status(404).json({ error: 'Task not found' });
    }

    res.json(updatedTask);
  } catch (error) {
    console.error('Error updating task status:', error.message);
    res.status(500).json({ error: 'Failed to update task status' });
  }
};

module.exports = { getTeamTasks, updateTaskStatus };