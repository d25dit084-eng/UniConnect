/**
 * UniConnect OpenAPI 3.0.3 Specification
 */

const swaggerSpec = {
  openapi: '3.0.3',
  info: {
    title: 'UniConnect Campus Platform API',
    version: '1.0.0',
    description:
      'REST & WebSocket API for UniConnect — the collegiate community platform with real-time low-latency chat and zero-leak anonymity engine.',
    contact: {
      name: 'UniConnect Core Engineering',
      url: 'https://github.com/d25dit084-eng/UniConnect',
    },
  },
  servers: [
    {
      url: 'http://localhost:5000',
      description: 'Local Development Server',
    },
    {
      url: '/',
      description: 'Current Environment Host',
    },
  ],
  components: {
    securitySchemes: {
      bearerAuth: {
        type: 'http',
        scheme: 'bearer',
        bearerFormat: 'JWT',
        description: 'Provide your 15-minute stateless JWT access token.',
      },
      cookieAuth: {
        type: 'apiKey',
        in: 'cookie',
        name: 'refreshToken',
        description: 'HttpOnly cookie containing the cryptographic refresh token.',
      },
    },
    schemas: {
      HealthResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: true },
          status: { type: 'string', example: 'healthy' },
          server: { type: 'string', example: 'running' },
          database: { type: 'string', example: 'connected' },
          timestamp: { type: 'string', format: 'date-time' },
          uptime: { type: 'string', example: '320s' },
          memory: {
            type: 'object',
            properties: {
              rssMB: { type: 'number', example: 74 },
              heapUsedMB: { type: 'number', example: 38 },
            },
          },
          dependencies: {
            type: 'object',
            properties: {
              database: {
                type: 'object',
                properties: {
                  status: { type: 'string', example: 'healthy' },
                  latencyMs: { type: 'number', example: 2 },
                },
              },
            },
          },
        },
      },
      User: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '660e1d0f5e43a9b1c8f12345' },
          username: { type: 'string', example: 'quietfalcon' },
          email: { type: 'string', example: 'falcon@college.edu' },
          role: { type: 'string', enum: ['student', 'moderator', 'admin'], example: 'student' },
          bio: { type: 'string', example: 'CS senior & tech explorer' },
          karma: {
            type: 'object',
            properties: {
              post: { type: 'number', example: 120 },
              comment: { type: 'number', example: 45 },
              total: { type: 'number', example: 165 },
            },
          },
        },
      },
      Post: {
        type: 'object',
        properties: {
          _id: { type: 'string', example: '660e1d0f5e43a9b1c8f12346' },
          title: { type: 'string', example: 'Setting up C++ dev environment' },
          content: { type: 'string', example: 'Guide to CMake and Clang...' },
          type: { type: 'string', enum: ['text', 'media', 'link', 'poll'], example: 'text' },
          score: { type: 'number', example: 42 },
          upvoteCount: { type: 'number', example: 44 },
          downvoteCount: { type: 'number', example: 2 },
          commentCount: { type: 'number', example: 8 },
          isAnonymous: { type: 'boolean', example: false },
          author: {
            type: 'object',
            properties: {
              _id: { type: 'string' },
              username: { type: 'string' },
              alias: { type: 'string', example: 'Anon-4f8a' },
              isAnonymous: { type: 'boolean', example: false },
              isOP: { type: 'boolean', example: true },
            },
          },
          createdAt: { type: 'string', format: 'date-time' },
        },
      },
      ErrorResponse: {
        type: 'object',
        properties: {
          success: { type: 'boolean', example: false },
          message: { type: 'string', example: 'Resource not found' },
          errors: { type: 'array', items: { type: 'string' } },
        },
      },
    },
  },
  paths: {
    '/api/health': {
      get: {
        tags: ['Health'],
        summary: 'System health check and dependency telemetry',
        description: 'Returns real-time status of Node process, MongoDB ping latency, and memory metrics.',
        responses: {
          200: {
            description: 'System healthy',
            content: {
              'application/json': {
                schema: { $ref: '#/components/schemas/HealthResponse' },
              },
            },
          },
          503: {
            description: 'Service degraded or database unreachable',
          },
        },
      },
    },
    '/api/auth/register': {
      post: {
        tags: ['Auth'],
        summary: 'Register a new student account',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['username', 'email', 'password'],
                properties: {
                  username: { type: 'string', minLength: 3, maxLength: 30, example: 'newstudent' },
                  email: { type: 'string', format: 'email', example: 'student@college.edu' },
                  password: { type: 'string', minLength: 6, example: 'Password@123' },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Registration successful' },
          400: { description: 'Validation error', content: { 'application/json': { schema: { $ref: '#/components/schemas/ErrorResponse' } } } },
        },
      },
    },
    '/api/auth/login': {
      post: {
        tags: ['Auth'],
        summary: 'Authenticate user with credentials',
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['email', 'password'],
                properties: {
                  email: { type: 'string', example: 'falcon@college.edu' },
                  password: { type: 'string', example: 'Password@123' },
                },
              },
            },
          },
        },
        responses: {
          200: {
            description: 'Login successful. Returns access token and sets refresh cookie.',
          },
          401: { description: 'Invalid credentials' },
          429: { description: 'Account locked due to consecutive failed attempts' },
        },
      },
    },
    '/api/posts': {
      get: {
        tags: ['Posts'],
        summary: 'List campus feed posts with pagination',
        parameters: [
          { name: 'page', in: 'query', schema: { type: 'integer', default: 1 } },
          { name: 'limit', in: 'query', schema: { type: 'integer', default: 10 } },
          { name: 'sort', in: 'query', schema: { type: 'string', enum: ['hot', 'new', 'top'], default: 'hot' } },
        ],
        responses: {
          200: {
            description: 'List of posts',
            content: {
              'application/json': {
                schema: {
                  type: 'object',
                  properties: {
                    success: { type: 'boolean', example: true },
                    posts: { type: 'array', items: { $ref: '#/components/schemas/Post' } },
                  },
                },
              },
            },
          },
        },
      },
      post: {
        tags: ['Posts'],
        summary: 'Create a new post (Standard or Anonymous)',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['title', 'community'],
                properties: {
                  title: { type: 'string', minLength: 3, maxLength: 300, example: 'Question on campus elective' },
                  content: { type: 'string', example: 'Looking for advice on CS340...' },
                  community: { type: 'string', example: '660e1d0f5e43a9b1c8f12345' },
                  isAnonymous: { type: 'boolean', default: false, example: true },
                },
              },
            },
          },
        },
        responses: {
          201: { description: 'Post created successfully' },
          400: { description: 'Validation failed' },
          401: { description: 'Unauthorized' },
        },
      },
    },
    '/api/votes/posts/{postId}': {
      post: {
        tags: ['Votes'],
        summary: 'Cast or flip atomic vote on a post (+1, -1, or undo)',
        security: [{ bearerAuth: [] }],
        parameters: [
          { name: 'postId', in: 'path', required: true, schema: { type: 'string' } },
        ],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['value'],
                properties: {
                  value: { type: 'integer', enum: [-1, 1], example: 1 },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Vote recorded atomically' },
        },
      },
    },
    '/api/communities': {
      get: {
        tags: ['Communities'],
        summary: 'List public campus communities',
        responses: {
          200: { description: 'List of communities' },
        },
      },
    },
    '/api/feed/home': {
      get: {
        tags: ['Feeds'],
        summary: 'Personalized user home feed',
        security: [{ bearerAuth: [] }],
        responses: {
          200: { description: 'Personalized feed posts' },
        },
      },
    },
    '/api/admin/reveal-author': {
      post: {
        tags: ['Admin'],
        summary: 'Accountability de-anonymization with mandatory reason & audit logging',
        security: [{ bearerAuth: [] }],
        requestBody: {
          required: true,
          content: {
            'application/json': {
              schema: {
                type: 'object',
                required: ['targetType', 'targetId', 'reason'],
                properties: {
                  targetType: { type: 'string', enum: ['post', 'comment'], example: 'post' },
                  targetId: { type: 'string', example: '660e1d0f5e43a9b1c8f12346' },
                  reason: { type: 'string', minLength: 10, example: 'Investigating verified safety violation report #482' },
                },
              },
            },
          },
        },
        responses: {
          200: { description: 'Author decrypted and audit log written' },
          403: { description: 'Forbidden: Admin privilege required' },
        },
      },
    },
  },
};

module.exports = swaggerSpec;
