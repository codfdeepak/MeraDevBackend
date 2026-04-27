const express = require('express')
const { authMiddleware } = require('../config/auth')
const {
  getPublicHeroSlides,
  getOwnerHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
} = require('../controllers/hero.controller')

const router = express.Router()

// Public hero content for website
router.get('/', getPublicHeroSlides)

// Owner dashboard management APIs
router.get('/admin', authMiddleware, getOwnerHeroSlides)
router.post('/', authMiddleware, createHeroSlide)
router.put('/:heroId', authMiddleware, updateHeroSlide)
router.delete('/:heroId', authMiddleware, deleteHeroSlide)

module.exports = router
