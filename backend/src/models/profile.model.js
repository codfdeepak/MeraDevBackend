const mongoose = require('mongoose')

const skillSchema = new mongoose.Schema(
  {
    // Partner dashboard currently uses only skill name + years.
    name: { type: String, trim: true },
    years: { type: Number, min: 0, max: 50 },
  },
  { _id: false },
)

const profileSchema = new mongoose.Schema(
  {
    user: {
      type: mongoose.Schema.Types.ObjectId,
      ref: 'User',
      required: true,
      unique: true,
    },
    about: {
      // Dashboard About form currently stores role(intro headline), intro(summary), and avatar.
      headline: { type: String, trim: true },
      summary: { type: String, trim: true },
      avatar: { type: String, trim: true },
    },
    skills: [skillSchema],
    totalExperienceYears: { type: Number, min: 0, max: 80, default: 0 },
  },
  { timestamps: true },
)

module.exports = mongoose.model('Profile', profileSchema)
