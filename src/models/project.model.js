const mongoose = require('mongoose')

const projectSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 180,
    },
    type: {
      type: String,
      required: true,
      trim: true,
      maxlength: 120,
    },
    link: {
      type: String,
      required: true,
      trim: true,
      maxlength: 2000,
    },
    details: {
      type: String,
      trim: true,
      maxlength: 2000,
      default: '',
    },
    technologies: {
      type: [
        {
          type: String,
          trim: true,
          maxlength: 60,
        },
      ],
      default: [],
    },
    sortOrder: {
      type: Number,
      min: 1,
      max: 9999,
      default: 999,
    },
    status: {
      type: String,
      enum: ['live', 'delivered'],
      default: 'live',
    },
    createdBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
    updatedBy: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
    },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Project', projectSchema)
