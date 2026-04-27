const express = require('express')
const { authMiddleware } = require('../config/auth')
const { createConsultation, getOwnerConsultations } = require('../controllers/consultation.controller')

const router = express.Router()

// Public form submission
router.post('/', createConsultation)

// Owner/admin dashboard view
router.get('/admin', authMiddleware, getOwnerConsultations)

module.exports = router
