const express = require('express')
const { authMiddleware } = require('../config/auth')
const {
  getMyProfile,
  upsertMyProfile,
  getPublicProfile,
  getPartnersProfiles,
} = require('../controllers/profile.controller')

const router = express.Router()

// private (admin)
router.get('/me', authMiddleware, getMyProfile)
router.put('/me', authMiddleware, upsertMyProfile)

// public view
router.get('/partners', getPartnersProfiles)
router.get('/public', getPublicProfile)
router.get('/public/:userId', getPublicProfile)

module.exports = router
