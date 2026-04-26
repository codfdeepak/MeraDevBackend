const mongoose = require('mongoose')
const HeroSlide = require('../models/hero.model')

const hasOwnerAccess = (req) => {
  const role = String(req?.user?.role || '').toLowerCase()
  return role === 'owner' || role === 'admin'
}

const normalizeText = (value) => String(value || '').trim()

const buildPayload = (body = {}) => {
  const image = normalizeText(body.image)
  const title = normalizeText(body.title)
  const description = normalizeText(body.description)
  const sortOrder = Number.isFinite(Number(body.sortOrder)) ? Number(body.sortOrder) : 0

  if (!image) {
    throw new Error('Hero image is required')
  }

  if (!title) {
    throw new Error('Hero title is required')
  }

  if (!description) {
    throw new Error('Hero description is required')
  }

  return {
    image,
    title,
    description,
    sortOrder: sortOrder >= 0 ? sortOrder : 0,
    isActive: body.isActive === undefined ? true : Boolean(body.isActive),
  }
}

const getPublicHeroSlides = async (_req, res) => {
  try {
    const slides = await HeroSlide.find({ isActive: true })
      .sort({ sortOrder: 1, updatedAt: -1, createdAt: -1 })
      .lean()

    return res.json({ slides })
  } catch (err) {
    console.error('Public hero fetch error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

const getOwnerHeroSlides = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can manage hero content' })
  }

  try {
    const slides = await HeroSlide.find({})
      .sort({ sortOrder: 1, updatedAt: -1, createdAt: -1 })
      .lean()

    return res.json({ slides })
  } catch (err) {
    console.error('Owner hero fetch error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

const createHeroSlide = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can manage hero content' })
  }

  try {
    const payload = buildPayload(req.body)
    const slide = await HeroSlide.create({
      ...payload,
      createdBy: req.user.sub,
      updatedBy: req.user.sub,
    })

    return res.status(201).json({ slide })
  } catch (err) {
    console.error('Hero create error:', err)
    return res.status(400).json({ message: err.message || 'Invalid hero data' })
  }
}

const updateHeroSlide = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can manage hero content' })
  }

  try {
    const { heroId } = req.params
    if (!mongoose.Types.ObjectId.isValid(heroId)) {
      return res.status(400).json({ message: 'Invalid hero id' })
    }

    const payload = buildPayload(req.body)
    const slide = await HeroSlide.findByIdAndUpdate(
      heroId,
      { $set: { ...payload, updatedBy: req.user.sub } },
      { new: true, runValidators: true },
    )

    if (!slide) {
      return res.status(404).json({ message: 'Hero slide not found' })
    }

    return res.json({ slide })
  } catch (err) {
    console.error('Hero update error:', err)
    return res.status(400).json({ message: err.message || 'Invalid hero data' })
  }
}

const deleteHeroSlide = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can manage hero content' })
  }

  try {
    const { heroId } = req.params
    if (!mongoose.Types.ObjectId.isValid(heroId)) {
      return res.status(400).json({ message: 'Invalid hero id' })
    }

    const slide = await HeroSlide.findByIdAndDelete(heroId)
    if (!slide) {
      return res.status(404).json({ message: 'Hero slide not found' })
    }

    return res.json({ message: 'Hero slide deleted', heroId })
  } catch (err) {
    console.error('Hero delete error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

module.exports = {
  getPublicHeroSlides,
  getOwnerHeroSlides,
  createHeroSlide,
  updateHeroSlide,
  deleteHeroSlide,
}
