const express = require('express')
const { authMiddleware } = require('../config/auth')
const {
  getPublicProjects,
  getOwnerProjects,
  createProject,
  updateProject,
  deleteProject,
} = require('../controllers/project.controller')

const router = express.Router()

// Public projects for website
router.get('/', getPublicProjects)

// Owner dashboard management APIs
router.get('/admin', authMiddleware, getOwnerProjects)
router.post('/', authMiddleware, createProject)
router.put('/:projectId', authMiddleware, updateProject)
router.delete('/:projectId', authMiddleware, deleteProject)

module.exports = router
