const Feedback = require('./Feedback');

exports.submitFeedback = async (req, res) => {
  const { name, email, productName, message } = req.body;

  if (!name || !email || !productName || !message) {
    return res.status(400).json({ error: 'All fields are required' });
  }

  const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
  if (!emailRegex.test(email)) {
    return res.status(400).json({ error: 'Invalid email format' });
  }

  try {
    const feedback = new Feedback({ name, email, productName, message });
    await feedback.save();
    res.status(201).json({ message: 'Feedback submitted successfully' });
  } catch (error) {
    res.status(500).json({ error: 'Failed to save feedback' });
  }
};