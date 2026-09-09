const mongoose = require('mongoose');

// Connects to MongoDB Atlas using the URI from the environment; throws on failure
// so the caller can decide not to start the server with a broken database.
async function connectDB() {
  if (mongoose.connection.readyState === 1) {
    return;
  }

  const uri = process.env.MONGODB_URI;

  if (!uri) {
    throw new Error('MONGODB_URI is not set in the environment');
  }

  await mongoose.connect(uri);
  console.log('MongoDB connected');
}

module.exports = connectDB;
