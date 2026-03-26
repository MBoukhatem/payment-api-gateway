const express = require('express')
const cors = require('cors')
const helmet = require('helmet')
const swaggerJsdoc = require('swagger-jsdoc')
const swaggerUi = require('swagger-ui-express')
const { globalLimiter, authLimiter } = require('./middlewares/rateLimit.middleware')
const { authMiddleware } = require('./middlewares/auth.middleware')
const {
  authProxy,
  userProxy,
  walletProxy,
  transactionProxy,
  fileProxy,
  notificationProxy,
} = require('./proxy')

const app = express()
const PORT = process.env.PORT || 3000
const FRONTEND_URL = process.env.FRONTEND_URL || 'http://localhost:5173'

// Swagger configuration
const swaggerOptions = {
  definition: {
    openapi: '3.0.0',
    info: {
      title: 'Mini-PayPal API',
      version: '1.0.0',
      description: 'API Gateway for the Mini-PayPal microservices platform',
    },
    servers: [
      {
        url: `http://localhost:${PORT}`,
        description: 'Development server',
      },
    ],
    components: {
      securitySchemes: {
        bearerAuth: {
          type: 'http',
          scheme: 'bearer',
          bearerFormat: 'JWT',
        },
      },
    },
    paths: {
      '/auth/register': {
        post: {
          tags: ['Auth'],
          summary: 'Register a new user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password', 'firstName', 'lastName'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string', minLength: 8 },
                    firstName: { type: 'string' },
                    lastName: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'User registered successfully' },
            400: { description: 'Validation error' },
            409: { description: 'Email already exists' },
          },
        },
      },
      '/auth/login': {
        post: {
          tags: ['Auth'],
          summary: 'Login user',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email', 'password'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                    password: { type: 'string' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Login successful, returns access token' },
            401: { description: 'Invalid credentials' },
          },
        },
      },
      '/auth/refresh': {
        post: {
          tags: ['Auth'],
          summary: 'Refresh access token',
          responses: {
            200: { description: 'New access token returned' },
            401: { description: 'Invalid or expired refresh token' },
          },
        },
      },
      '/auth/logout': {
        post: {
          tags: ['Auth'],
          summary: 'Logout user',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Logged out successfully' },
          },
        },
      },
      '/auth/forgot-password': {
        post: {
          tags: ['Auth'],
          summary: 'Request password reset',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['email'],
                  properties: {
                    email: { type: 'string', format: 'email' },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Reset email sent if account exists' },
          },
        },
      },
      '/auth/reset-password': {
        post: {
          tags: ['Auth'],
          summary: 'Reset password with token',
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['token', 'password'],
                  properties: {
                    token: { type: 'string' },
                    password: { type: 'string', minLength: 8 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Password reset successfully' },
            400: { description: 'Invalid or expired token' },
          },
        },
      },
      '/users/me': {
        get: {
          tags: ['Users'],
          summary: 'Get current user profile',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'User profile' },
            401: { description: 'Unauthorized' },
          },
        },
        put: {
          tags: ['Users'],
          summary: 'Update current user profile',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Profile updated' },
          },
        },
        delete: {
          tags: ['Users'],
          summary: 'Delete current user account',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Account deleted' },
          },
        },
      },
      '/wallet/balance': {
        get: {
          tags: ['Wallet'],
          summary: 'Get wallet balance',
          security: [{ bearerAuth: [] }],
          responses: {
            200: { description: 'Current balance' },
          },
        },
      },
      '/wallet/deposit': {
        post: {
          tags: ['Wallet'],
          summary: 'Create a Stripe deposit',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['amount'],
                  properties: {
                    amount: { type: 'number', minimum: 1 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Stripe client secret returned' },
          },
        },
      },
      '/transactions/send': {
        post: {
          tags: ['Transactions'],
          summary: 'Send money P2P',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  required: ['receiverEmail', 'amount'],
                  properties: {
                    receiverEmail: { type: 'string', format: 'email' },
                    amount: { type: 'number', minimum: 0.01 },
                  },
                },
              },
            },
          },
          responses: {
            200: { description: 'Transaction completed' },
            400: { description: 'Insufficient funds or invalid receiver' },
          },
        },
      },
      '/transactions': {
        get: {
          tags: ['Transactions'],
          summary: 'Get transaction history',
          security: [{ bearerAuth: [] }],
          parameters: [
            { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
            { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          ],
          responses: {
            200: { description: 'Paginated transaction list' },
          },
        },
      },
      '/files/upload': {
        post: {
          tags: ['Files'],
          summary: 'Upload a file (KYC/avatar)',
          security: [{ bearerAuth: [] }],
          requestBody: {
            required: true,
            content: {
              'multipart/form-data': {
                schema: {
                  type: 'object',
                  properties: {
                    file: { type: 'string', format: 'binary' },
                  },
                },
              },
            },
          },
          responses: {
            201: { description: 'File uploaded successfully' },
          },
        },
      },
    },
  },
  apis: [],
}

const swaggerSpec = swaggerJsdoc(swaggerOptions)

// Security headers
app.use(helmet())

// CORS
app.use(
  cors({
    origin: FRONTEND_URL,
    credentials: true,
    methods: ['GET', 'POST', 'PUT', 'DELETE', 'PATCH', 'OPTIONS'],
    allowedHeaders: ['Content-Type', 'Authorization'],
  }),
)

// Rate limiting
app.use(globalLimiter)

// Swagger docs (before auth middleware)
app.use('/api-docs', swaggerUi.serve, swaggerUi.setup(swaggerSpec))

// Auth middleware
app.use(authMiddleware)

// Proxy routes — mounted directly on app to preserve full path
app.use('/auth', authLimiter, authProxy)
app.use('/users', userProxy)
app.use('/wallet', walletProxy)
app.use('/transactions', transactionProxy)
app.use('/files', fileProxy)
app.use('/notifications', notificationProxy)

// Health check
app.get('/health', (_req, res) => {
  res.json({ status: 'ok', service: 'gateway', timestamp: new Date().toISOString() })
})

// 404 handler
app.use((_req, res) => {
  res.status(404).json({ error: 'Route not found' })
})

// Global error handler
app.use((err, _req, res, _next) => {
  console.error('Gateway error:', err)
  res.status(err.status || 500).json({ error: err.message || 'Internal server error' })
})

app.listen(PORT, () => {
  console.log(`Gateway running on http://localhost:${PORT}`)
  console.log(`Swagger docs: http://localhost:${PORT}/api-docs`)
})

module.exports = app
