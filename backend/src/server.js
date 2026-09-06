const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

require('dotenv').config();

const express = require('express');
const cors = require('cors');
const connectDB = require('./config/database');
const authRoutes = require('./routes/authRoutes');
const repoRoutes = require('./routes/repoRoutes');

const app = express();

app.use(cors({
  origin: [
    'http://localhost:5173',
    'https://cicd-monitoring-dashboard-theta.vercel.app'
  ],
  credentials: true
}));

// Parses incoming JSON request bodies into req.body for future POST/PUT routes.
app.use(express.json());

// Simple liveness/readiness check for uptime monitoring and load balancers.
app.get('/api/health', (req, res) => {
  res.json({ status: 'ok', message: 'API is running' });
});

app.use('/api/auth', authRoutes);
app.use('/api/repos', repoRoutes);

// PORT is injected by the hosting environment in production; 5000 is the local dev default.
const PORT = process.env.PORT || 5000;

// Connect to the database before accepting traffic; exit if it fails so we
// never appear "up" while unable to serve real requests.
connectDB()
  .then(() => {
    app.listen(PORT, () => {
      console.log(`Server listening on port ${PORT}`);
    });
  })
  .catch((err) => {
    console.error('Failed to connect to MongoDB:', err.message);
    process.exit(1);
  });