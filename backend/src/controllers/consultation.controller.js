const Consultation = require('../models/consultation.model')

const normalizeText = (value) => String(value || '').trim()

const hasOwnerAccess = (req) => {
  const role = String(req?.user?.role || '').toLowerCase()
  return role === 'owner' || role === 'admin'
}

const createConsultation = async (req, res) => {
  try {
    const name = normalizeText(req.body?.name)
    const mobile = normalizeText(req.body?.mobile)
    const city = normalizeText(req.body?.city)
    const serviceName = normalizeText(req.body?.serviceName)
    const topic = normalizeText(req.body?.topic)
    const sourcePage = normalizeText(req.body?.sourcePage) || 'services'

    if (!name) {
      return res.status(400).json({ message: 'Name is required' })
    }

    if (!mobile) {
      return res.status(400).json({ message: 'Mobile number is required' })
    }

    if (!city) {
      return res.status(400).json({ message: 'City is required' })
    }

    if (!topic) {
      return res.status(400).json({ message: 'Topic or doubts are required' })
    }

    const consultation = await Consultation.create({
      name,
      mobile,
      city,
      serviceName,
      topic,
      sourcePage,
      bookedAt: new Date(),
      status: 'new',
    })

    return res.status(201).json({
      message: 'Consultation request submitted successfully',
      consultation,
    })
  } catch (err) {
    console.error('Consultation submit error:', err)
    return res.status(400).json({ message: err.message || 'Unable to submit consultation request' })
  }
}

const getOwnerConsultations = async (req, res) => {
  if (!hasOwnerAccess(req)) {
    return res.status(403).json({ message: 'Only owner/admin can view consultations' })
  }

  try {
    const consultations = await Consultation.find({})
      .sort({ bookedAt: -1, createdAt: -1 })
      .lean()

    return res.json({ consultations })
  } catch (err) {
    console.error('Consultations fetch error:', err)
    return res.status(500).json({ message: 'Server error' })
  }
}

module.exports = {
  createConsultation,
  getOwnerConsultations,
}
