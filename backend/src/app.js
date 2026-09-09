require('dotenv').config();

const express = require('express');
const cors = require('cors');
const helmet = require('helmet');
const rateLimit = require('express-rate-limit');
const connectDB = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const repoRoutes = require('./routes/repoRoutes');
const webhookRoutes = require('./routes/webhookRoutes');

const app = express();

app.use(helmet());

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://cicd-monitoring-dashboard-theta.vercel.app'
  ],
  credentials: true
}));

// Establishes one cached MongoDB connection before any route handles a request.
app.use(async (req, res, next) => {
  try {
    await connectDB();
    next();
  } catch (err) {
    console.error('Failed to connect to MongoDB:', err.message);
    res.status(503).json({ message: 'Database unavailable' });
  }
});

// Mounted before express.json() so the webhook route receives the raw request body.
app.use('/api/webhooks', webhookRoutes);

app.use(express.json({ limit: '100kb' }));

const authLimiter = rateLimit({
  windowMs: 15 * 60 * 1000,
  limit: 20,
  standardHeaders: 'draft-8',
  legacyHeaders: false,
  message: { message: 'Too many authentication attempts. Try again later.' },
});

app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

app.use('/api/auth', authLimiter, authRoutes);
app.use('/api/repos', repoRoutes);

module.exports = app;
