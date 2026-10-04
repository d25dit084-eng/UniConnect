const { z } = require('zod');

const createPostSchema = z.object({
  communityId: z
    .string({ required_error: 'Community ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid community ID format'),
  type: z.enum(['text', 'image', 'link']).default('text'),
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(300, 'Title cannot exceed 300 characters'),
  content: z.string().optional().default(''),
  url: z.string().url('Invalid URL format').optional().nullable(),
  media: z.union([z.string(), z.array(z.string())]).optional(),
  isAnonymous: z.boolean().optional().default(false),
});

module.exports = {
  createPostSchema,
};
