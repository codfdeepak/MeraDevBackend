const express = require('express')
const { authMiddleware } = require('../config/auth')
const {
  createConsultation,
  getOwnerConsultations,
  deleteOwnerConsultation,
} = require('../controllers/consultation.controller')

const router = express.Router()

// Public form submission
router.post('/', createConsultation)

// Owner/admin dashboard view
router.get('/admin', authMiddleware, getOwnerConsultations)
router.delete('/admin/:consultationId', authMiddleware, deleteOwnerConsultation)

module.exports = router
