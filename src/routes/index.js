const express = require('express')
const {
  authProxy,
  userProxy,
  walletProxy,
  transactionProxy,
  fileProxy,
  notificationProxy,
} = require('../proxy')
const { authLimiter } = require('../middlewares/rateLimit.middleware')

const router = express.Router()

router.use('/auth', authLimiter, authProxy)
router.use('/users', userProxy)
router.use('/wallet', walletProxy)
router.use('/transactions', transactionProxy)
router.use('/files', fileProxy)
router.use('/notifications', notificationProxy)

module.exports = router
