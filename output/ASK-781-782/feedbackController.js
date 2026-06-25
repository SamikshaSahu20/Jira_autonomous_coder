const Feedback = require('./Feedback');

exports.submitFeedback = async (req, res) => {
  const { name, email, feedback } = req.body;

  if (!name || !email || !feedback) {
    return res.status(400).json({ message: 'All fields are required.' });
  }

  try {
    const newFeedback = new Feedback({ name, email, feedback });
    await newFeedback.save();
    res.status(201).json({ message: 'Feedback submitted successfully.' });
  } catch (error) {
    console.error('Error saving feedback:', error.message);
    res.status(500).json({ message: 'Internal server error.' });
  }
};