const { createProxyMiddleware } = require('http-proxy-middleware')

const AUTH_SERVICE_URL = process.env.AUTH_SERVICE_URL || 'http://localhost:3001'
const USER_SERVICE_URL = process.env.USER_SERVICE_URL || 'http://localhost:3002'
const PAYMENT_SERVICE_URL = process.env.PAYMENT_SERVICE_URL || 'http://localhost:3003'
const FILE_SERVICE_URL = process.env.FILE_SERVICE_URL || 'http://localhost:3004'
const NOTIFICATION_SERVICE_URL = process.env.NOTIFICATION_SERVICE_URL || 'http://localhost:3005'

const createServiceProxy = (target, pathRewrite) => {
  return createProxyMiddleware({
    target,
    changeOrigin: true,
    pathRewrite,
    on: {
      proxyReq: (proxyReq, req) => {
        if (req.user) {
          proxyReq.setHeader('X-User-Id', req.user.id)
          proxyReq.setHeader('X-User-Email', req.user.email)
          proxyReq.setHeader('X-User-Role', req.user.role || 'USER')
        }
        proxyReq.setHeader('X-Service-Token', process.env.SERVICE_TOKEN)
      },
      error: (err, req, res) => {
        console.error(`Proxy error for ${req.path}:`, err.message)
        if (!res.headersSent) {
          res.status(502).json({ error: 'Service unavailable' })
        }
      },
    },
  })
}

// When mounted via app.use('/auth', proxy), Express strips the mount path.
// pathRewrite prepends the service prefix so the target receives the full path.
const authProxy = createServiceProxy(AUTH_SERVICE_URL, { '^/': '/auth/' })
const userProxy = createServiceProxy(USER_SERVICE_URL, { '^/': '/users/' })
const walletProxy = createServiceProxy(PAYMENT_SERVICE_URL, { '^/': '/wallet/' })
const transactionProxy = createServiceProxy(PAYMENT_SERVICE_URL, {
  '^/': '/transactions/',
})
const fileProxy = createServiceProxy(FILE_SERVICE_URL, { '^/': '/files/' })
const notificationProxy = createServiceProxy(NOTIFICATION_SERVICE_URL, {
  '^/': '/notifications/',
})

module.exports = {
  authProxy,
  userProxy,
  walletProxy,
  transactionProxy,
  fileProxy,
  notificationProxy,
}
