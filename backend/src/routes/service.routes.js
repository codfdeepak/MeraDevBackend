const express = require('express')
const { authMiddleware } = require('../config/auth')
const {
  getPublicServices,
  getPublicServiceById,
  getOwnerServices,
  createService,
  updateService,
  deleteService,
} = require('../controllers/service.controller')

const router = express.Router()

// Public services for website
router.get('/', getPublicServices)

// Owner dashboard management APIs
router.get('/admin', authMiddleware, getOwnerServices)
router.post('/', authMiddleware, createService)
router.put('/:serviceId', authMiddleware, updateService)
router.delete('/:serviceId', authMiddleware, deleteService)

// Public service details
router.get('/:serviceId', getPublicServiceById)

module.exports = router
