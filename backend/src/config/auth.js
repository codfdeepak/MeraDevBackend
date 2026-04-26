const jwt = require('jsonwebtoken')

const signToken = (payload) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET missing in environment')
  }

  return jwt.sign(payload, process.env.JWT_SECRET, { expiresIn: '7d' })
}

const verifyToken = (token) => {
  if (!process.env.JWT_SECRET) {
    throw new Error('JWT_SECRET missing in environment')
  }
  return jwt.verify(token, process.env.JWT_SECRET)
}

const authMiddleware = (req, res, next) => {
  const header = req.headers.authorization
  if (!header || !header.startsWith('Bearer ')) {
    return res.status(401).json({ message: 'Unauthorized' })
  }

  const token = header.split(' ')[1]

  try {
    const decoded = verifyToken(token)
    req.user = decoded
    return next()
  } catch (err) {
    return res.status(401).json({ message: 'Invalid or expired token' })
  }
}

module.exports = { signToken, verifyToken, authMiddleware }
