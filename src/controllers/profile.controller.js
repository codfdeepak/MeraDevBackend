const Profile = require('../models/profile.model')

// helper to ensure we never overwrite the user field from the client
const sanitizeIncoming = (body) => {
  const clone = { ...body }
  delete clone.user
  return clone
}

const getMyProfile = async (req, res) => {
  try {
    const profile = await Profile.findOne({ user: req.user.sub })
    if (!profile) {
      return res.json({
        profile: null,
        profileSetupRequired: true,
        message: 'Profile not set yet',
      })
    }
    return res.json({ profile })
  } catch (err) {
    console.error('Profile fetch error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

const upsertMyProfile = async (req, res) => {
  try {
    const data = sanitizeIncoming(req.body)
    const profile = await Profile.findOneAndUpdate(
      { user: req.user.sub },
      { $set: { ...data, user: req.user.sub } },
      { new: true, upsert: true, runValidators: true },
    )

    return res.json({ profile })
  } catch (err) {
    console.error('Profile upsert error:', err)
    return res.status(400).json({ message: err.message || 'Invalid data' })
  }
}

const getPublicProfile = async (req, res) => {
  try {
    const { userId } = req.params
    const query = userId ? { user: userId } : {}
    const profile = await Profile.findOne(query).populate('user', 'fullName mobile role')
    if (!profile) {
      return res.status(404).json({ message: 'Profile not found' })
    }
    return res.json({ profile })
  } catch (err) {
    console.error('Public profile error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

const getPartnersProfiles = async (_req, res) => {
  try {
    const partnerDocs = await Profile.find({})
      .select('user about.headline about.avatar skills totalExperienceYears')
      .populate('user', 'fullName role')
      .sort({ updatedAt: -1 })

    const partners = partnerDocs.map((doc) => {
      const profile = doc.toObject()
      const role = String(profile?.user?.role || 'partner').toLowerCase()

      return {
        ...profile,
        role,
        isOwner: role === 'admin' || role === 'owner',
      }
    })

    return res.json({ partners })
  } catch (err) {
    console.error('Partners profile error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

module.exports = { getMyProfile, upsertMyProfile, getPublicProfile, getPartnersProfiles }
