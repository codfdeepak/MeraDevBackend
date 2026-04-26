const mongoose = require('mongoose')
const Service = require('../models/service.model')

const hasOwnerAccess = (req) => {
  const role = String(req?.user?.role || '').toLowerCase()
  return role === 'owner' || role === 'admin'
}

const SERVICE_CATEGORY_VALUES = [
  'website-development',
  'app-development',
  'webview-development',
  'seo-content-marketing',
  'cloud-server-management',
]
const DEFAULT_SERVICE_CATEGORY = 'website-development'

const normalizeText = (value) => String(value || '').trim()

const normalizeArray = (value) => {
  if (!Array.isArray(value)) return []
  return value
    .map((item) => normalizeText(item))
    .filter(Boolean)
}

const normalizeContentSections = (value) => {
  if (!Array.isArray(value)) return []

  return value
    .map((section) => {
      const image = normalizeText(section?.image)
      const description = normalizeText(section?.description)
      const bulletPoints = normalizeArray(section?.bulletPoints).slice(0, 20)

      if (!image && !description && bulletPoints.length === 0) {
        return null
      }

      return {
        image,
        description,
        bulletPoints,
      }
    })
    .filter(Boolean)
    .slice(0, 20)
}

const buildPayload = (body = {}) => {
  const name = normalizeText(body.name)
  const category = normalizeText(body.category) || DEFAULT_SERVICE_CATEGORY
  const description = normalizeText(body.description)
  const image = normalizeText(body.image)
  const snapshots = normalizeArray(body.snapshots).slice(0, 15)
  const bulletPoints = normalizeArray(body.bulletPoints).slice(0, 40)
  const contentSections = normalizeContentSections(body.contentSections)
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0

  if (!name) {
    throw new Error('Service name is required')
  }

  if (!SERVICE_CATEGORY_VALUES.includes(category)) {
    throw new Error('Invalid service category')
  }

  if (Array.isArray(body.snapshots) && body.snapshots.length > 15) {
    throw new Error('Snapshots can hold up to 15 images')
  }

  if (Array.isArray(body.contentSections) && body.contentSections.length > 20) {
    throw new Error('Content sections can hold up to 20 items')
  }

  if (Array.isArray(body.contentSections)) {
    const hasOverflowBullets = body.contentSections.some(
      (section) => Array.isArray(section?.bulletPoints) && section.bulletPoints.length > 20,
    )
    if (hasOverflowBullets) {
      throw new Error('Each content section can hold up to 20 bullet points')
    }
  }

  const sectionItems =
    contentSections.length > 0
      ? contentSections
      : [
          {
            image: image || snapshots[0] || '',
            description,
            bulletPoints: bulletPoints.slice(0, 20),
          },
        ].filter(
          (section) =>
            normalizeText(section.image) ||
            normalizeText(section.description) ||
            (section.bulletPoints || []).length > 0,
        )

  if (!sectionItems.length) {
    throw new Error('At least one service section is required')
  }

  const hasInvalidSection = sectionItems.some((section) => !section.description)
  if (hasInvalidSection) {
    throw new Error('Each content section requires description')
  }

  const normalizedDescription = description || sectionItems[0]?.description || ''
  if (!normalizedDescription) {
    throw new Error('Service description is required')
  }

  const legacyBulletPoints =
    bulletPoints.length > 0 ? bulletPoints : (sectionItems[0]?.bulletPoints || []).slice(0, 40)
  const legacySnapshots = sectionItems
    .map((section) => normalizeText(section?.image))
    .filter(Boolean)
    .slice(0, 15)

  return {
    name,
    category,
    description: normalizedDescription,
    image: sectionItems[0]?.image || '',
    bulletPoints: legacyBulletPoints,
    snapshots: legacySnapshots,
    contentSections: sectionItems,
    sortOrder: sortOrder >= 0 ? sortOrder : 0,
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  }
}

const getPublicServices = async (_req, res) => {
  try {
    const services = await Service.find({ isActive: true })
      .sort({ sortOrder: 1, updatedAt: -1, createdAt: -1 })
      .lean()

    return res.json({ services })
  } catch (err) {
    console.error('Public services fetch error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

const getPublicServiceById = async (req, res) => {
  try {
    const { serviceId } = req.params
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ message: 'Invalid service id' })
    }

    const service = await Service.findOne({ _id: serviceId, isActive: true }).lean()
    if (!service) {
      return res.status(404).json({ message: 'Service not found' })
    }

    return res.json({ service })
  } catch (err) {
    console.error('Public service fetch error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

const getOwnerServices = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can manage services' })
  }

  try {
    const services = await Service.find({})
      .sort({ sortOrder: 1, updatedAt: -1, createdAt: -1 })
      .lean()

    return res.json({ services })
  } catch (err) {
    console.error('Owner services fetch error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

const createService = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can manage services' })
  }

  try {
    const payload = buildPayload(req.body)
    const service = await Service.create({
      ...payload,
      createdBy: req.user.sub,
      updatedBy: req.user.sub,
    })

    return res.status(201).json({ service })
  } catch (err) {
    console.error('Service create error:', err)
    return res.status(400).json({ message: err.message || 'Invalid service data' })
  }
}

const updateService = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can manage services' })
  }

  try {
    const { serviceId } = req.params
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ message: 'Invalid service id' })
    }

    const payload = buildPayload(req.body)
    const service = await Service.findByIdAndUpdate(
      serviceId,
      { $set: { ...payload, updatedBy: req.user.sub } },
      { new: true, runValidators: true },
    )

    if (!service) {
      return res.status(404).json({ message: 'Service not found' })
    }

    return res.json({ service })
  } catch (err) {
    console.error('Service update error:', err)
    return res.status(400).json({ message: err.message || 'Invalid service data' })
  }
}

const deleteService = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can manage services' })
  }

  try {
    const { serviceId } = req.params
    if (!mongoose.Types.ObjectId.isValid(serviceId)) {
      return res.status(400).json({ message: 'Invalid service id' })
    }

    const service = await Service.findByIdAndDelete(serviceId)
    if (!service) {
      return res.status(404).json({ message: 'Service not found' })
    }

    return res.json({ message: 'Service deleted', serviceId })
  } catch (err) {
    console.error('Service delete error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

module.exports = {
  getPublicServices,
  getPublicServiceById,
  getOwnerServices,
  createService,
  updateService,
  deleteService,
}
