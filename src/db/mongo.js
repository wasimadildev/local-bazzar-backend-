const mongoose = require('mongoose');

let connectionPromise = null;

async function connectMongo() {
  if (!process.env.MONGODB_URI) {
    return false;
  }

  if (!connectionPromise) {
    connectionPromise = mongoose
      .connect(process.env.MONGODB_URI, {
        serverSelectionTimeoutMS: 7000
      })
      .then(() => true);
  }

  return connectionPromise;
}

module.exports = {
  connectMongo
};
