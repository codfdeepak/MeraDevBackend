const mongoose = require('mongoose')

const consultationSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    mobile: {
      type: String,
      required: true,
      trim: true,
      maxlength: 30,
    },
    city: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    serviceName: {
      type: String,
      trim: true,
      maxlength: 160,
      default: '',
    },
    topic: {
      type: String,
      required: true,
      trim: true,
      maxlength: 3000,
    },
    bookedAt: {
      type: Date,
      default: Date.now,
      required: true,
    },
    status: {
      type: String,
      enum: ['new', 'contacted', 'resolved'],
      default: 'new',
    },
    sourcePage: {
      type: String,
      trim: true,
      maxlength: 120,
      default: 'services',
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Consultation', consultationSchema)
