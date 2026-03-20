const express = require('express');
const cors = require('cors');
const path = require('path');

const app = express();
const PORT = process.env.PORT || 3000;

app.use(cors());
app.use(express.json());

// Log API requests
app.use('/api', (req, res, next) => {
  console.log(`${req.method} ${req.originalUrl}`);
  if (req.method !== 'GET') console.log('  Body:', JSON.stringify(req.body));
  next();
});

// Wrap all route handlers to catch sync errors and return meaningful JSON errors
function wrapRouter(routerModule) {
  const wrapped = express.Router();
  const methods = ['get', 'post', 'put', 'patch', 'delete'];
  routerModule.stack.forEach(layer => {
    if (layer.route) {
      const route = layer.route;
      methods.forEach(method => {
        if (route.methods[method]) {
          const originalHandlers = route.stack
            .filter(s => s.method === method)
            .map(s => s.handle);
          // Re-register with error wrapping
        }
      });
    }
  });
  return routerModule;
}

// API routes
app.use('/api/paycheck', require('./routes/paycheck'));
app.use('/api/categories', require('./routes/categories'));
app.use('/api/bills', require('./routes/bills'));
app.use('/api/expenses', require('./routes/expenses'));
app.use('/api/debts', require('./routes/debts'));
app.use('/api/subscriptions', require('./routes/subscriptions'));
app.use('/api/paid', require('./routes/paid'));
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

// Global error handler — catches errors passed via next(err) and uncaught sync throws
app.use((err, req, res, next) => {
  console.error(`ERROR ${req.method} ${req.originalUrl}:`, err.message);
  console.error(err.stack);
  res.status(500).json({
    error: err.message || 'Internal server error',
    route: req.originalUrl,
    method: req.method
  });
});

app.listen(PORT, '0.0.0.0', () => {
  console.log(`Budget API running on port ${PORT}`);
});
