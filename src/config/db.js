const mongoose = require('mongoose')

const connectDB = async () => {
  // Support both MONGO_URI and legacy MONGODB_URI env names
  const uri = process.env.MONGO_URI || process.env.MONGODB_URI
  const dbName = process.env.MONGO_DB

  if (!uri) {
    throw new Error('MONGO_URI missing in environment')
  }

  await mongoose.connect(uri, {
    serverSelectionTimeoutMS: 5000,
    dbName: dbName || undefined, // lets you keep DB name outside the URI
  })

  console.log('MongoDB connected')
}

module.exports = { connectDB }
