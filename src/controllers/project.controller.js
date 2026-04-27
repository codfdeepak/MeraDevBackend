const mongoose = require('mongoose')
const Project = require('../models/project.model')

const hasOwnerAccess = (req) => {
  const role = String(req?.user?.role || '').toLowerCase()
  return role === 'owner' || role === 'admin'
}

const DEFAULT_PROJECT_SORT_ORDER = 999
const normalizeText = (value) => String(value || '').trim()
const normalizeStringArray = (value) => {
  if (Array.isArray(value)) {
    return value
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 20)
  }

  if (typeof value === 'string') {
    return value
      .split(',')
      .map((item) => normalizeText(item))
      .filter(Boolean)
      .slice(0, 20)
  }

  return []
}

const normalizeSortOrder = (value) => {
  const parsed = Number(value)
  if (!Number.isFinite(parsed) || parsed <= 0) {
    return DEFAULT_PROJECT_SORT_ORDER
  }

  return Math.min(9999, Math.floor(parsed))
}

const sortProjectsForDisplay = (items = []) =>
  [...items].sort((a, b) => {
    const aOrder = normalizeSortOrder(a?.sortOrder)
    const bOrder = normalizeSortOrder(b?.sortOrder)

    if (aOrder !== bOrder) {
      return aOrder - bOrder
    }

    const aUpdated = new Date(a?.updatedAt || a?.createdAt || 0).getTime()
    const bUpdated = new Date(b?.updatedAt || b?.createdAt || 0).getTime()

    if (aUpdated !== bUpdated) {
      return bUpdated - aUpdated
    }

    return String(a?._id || '').localeCompare(String(b?._id || ''))
  })

const buildPayload = (body = {}) => {
  const name = normalizeText(body.name)
  const type = normalizeText(body.type)
  const link = normalizeText(body.link)
  const details = normalizeText(body.details)
  const technologies = [...new Set(normalizeStringArray(body.technologies))]
  const sortOrder = normalizeSortOrder(body.sortOrder)
  const normalizedStatus = normalizeText(body.status).toLowerCase()
  const status = normalizedStatus === 'delivered' ? 'delivered' : 'live'

  if (!name) {
    throw new Error('Project name is required')
  }

  if (!type) {
    throw new Error('Project type is required')
  }

  if (!link) {
    throw new Error('Project link is required')
  }

  return {
    name,
    type,
    link,
    details,
    technologies,
    sortOrder,
    status,
  }
}

const getPublicProjects = async (_req, res) => {
  try {
    const projects = sortProjectsForDisplay(await Project.find({}).lean())

    return res.json({ projects })
  } catch (err) {
    console.error('Public projects fetch error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

const getOwnerProjects = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can manage projects' })
  }

  try {
    const projects = sortProjectsForDisplay(await Project.find({}).lean())

    return res.json({ projects })
  } catch (err) {
    console.error('Owner projects fetch error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

const createProject = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can manage projects' })
  }

  try {
    const payload = buildPayload(req.body)
    const project = await Project.create({
      ...payload,
      createdBy: req.user.sub,
      updatedBy: req.user.sub,
    })

    return res.status(201).json({ project })
  } catch (err) {
    console.error('Project create error:', err)
    return res.status(400).json({ message: err.message || 'Invalid project data' })
  }
}

const updateProject = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can manage projects' })
  }

  try {
    const { projectId } = req.params
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project id' })
    }

    const payload = buildPayload(req.body)
    const project = await Project.findByIdAndUpdate(
      projectId,
      { $set: { ...payload, updatedBy: req.user.sub } },
      { new: true, runValidators: true },
    )

    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    return res.json({ project })
  } catch (err) {
    console.error('Project update error:', err)
    return res.status(400).json({ message: err.message || 'Invalid project data' })
  }
}

const deleteProject = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can manage projects' })
  }

  try {
    const { projectId } = req.params
    if (!mongoose.Types.ObjectId.isValid(projectId)) {
      return res.status(400).json({ message: 'Invalid project id' })
    }

    const project = await Project.findByIdAndDelete(projectId)
    if (!project) {
      return res.status(404).json({ message: 'Project not found' })
    }

    return res.json({ message: 'Project deleted', projectId })
  } catch (err) {
    console.error('Project delete error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

module.exports = {
  getPublicProjects,
  getOwnerProjects,
  createProject,
  updateProject,
  deleteProject,
}
