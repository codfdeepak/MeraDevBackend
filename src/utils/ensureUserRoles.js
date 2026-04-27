const User = require('../models/user.model')

const ensureUserRoles = async () => {
  const result = await User.updateMany(
    {
      $or: [{ role: { $exists: false } }, { role: null }, { role: '' }],
    },
    {
      $set: { role: 'partner' },
    },
  )

  if (result.modifiedCount > 0) {
    console.log(`Backfilled role=partner for ${result.modifiedCount} users`)
  }
}

module.exports = { ensureUserRoles }
