const mongoose = require('mongoose')

const stringArrayLimit = (value, max) => Array.isArray(value) && value.length <= max
const SERVICE_CATEGORY_VALUES = [
  'website-development',
  'app-development',
  'webview-development',
  'seo-content-marketing',
  'cloud-server-management',
]

const serviceContentSectionSchema = new mongoose.Schema(
  {
    image: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      trim: true,
      default: '',
      maxlength: 2000,
    },
    bulletPoints: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return stringArrayLimit(arr, 20)
        },
        message: 'Section bullet points can hold up to 20 items',
      },
    },
  },
  { _id: false },
)

const serviceSchema = new mongoose.Schema(
  {
    name: {
      type: String,
      required: true,
      trim: true,
      maxlength: 140,
    },
    category: {
      type: String,
      required: true,
      trim: true,
      enum: SERVICE_CATEGORY_VALUES,
      default: 'website-development',
    },
    image: {
      type: String,
      trim: true,
      default: '',
    },
    description: {
      type: String,
      required: true,
      trim: true,
      maxlength: 4000,
    },
    bulletPoints: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return stringArrayLimit(arr, 40)
        },
        message: 'Bullet points can hold up to 40 items',
      },
    },
    snapshots: {
      type: [String],
      default: [],
      validate: {
        validator: function (arr) {
          return stringArrayLimit(arr, 15)
        },
        message: 'Snapshots can hold up to 15 images',
      },
    },
    contentSections: {
      type: [serviceContentSectionSchema],
      default: [],
      validate: {
        validator: function (arr) {
          return stringArrayLimit(arr, 20)
        },
        message: 'Content sections can hold up to 20 items',
      },
    },
    sortOrder: {
      type: Number,
      default: 0,
      min: 0,
    },
    isActive: {
      type: Boolean,
      default: true,
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

module.exports = mongoose.model('Service', serviceSchema)
