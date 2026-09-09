const dns = require('dns');
dns.setServers(['1.1.1.1', '8.8.8.8']);

require('dotenv').config();

const connectDB = require('./config/database');
const app = require('./app');

const PORT = process.env.PORT || 5000;

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
