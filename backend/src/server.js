const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// API routes
app.use('/api/paycheck', require('./routes/paycheck'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/debts', require('./routes/debts'));
app.use('/api/dashboard', require('./routes/dashboard'));
app.use('/api/review', require('./routes/review'));

// Serve Angular frontend in production
const frontendPath = path.join(__dirname, '..', 'public');
app.use(express.static(frontendPath));
app.get('*', (req, res) => {
  if (!req.path.startsWith('/api')) {
    res.sendFile(path.join(frontendPath, 'index.html'));
  }
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Budget API running on port ${PORT}`);
});
