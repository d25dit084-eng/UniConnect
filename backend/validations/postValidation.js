const { z } = require('zod');

const createPostSchema = z.object({
  communityId: z
    .string({ required_error: 'Community ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid community ID format'),
  type: z.enum(['text', 'image', 'link', 'poll']).default('text'),
  title: z
    .string({ required_error: 'Title is required' })
    .trim()
    .min(3, 'Title must be at least 3 characters')
    .max(300, 'Title cannot exceed 300 characters'),
  content: z.string().optional().default(''),
  url: z.string().url('Invalid URL format').optional().nullable(),
  media: z.union([z.string(), z.array(z.string())]).optional(),
  poll: z
    .object({
      question: z.string().optional(),
      options: z
        .array(
          z.union([
            z.string().min(1, 'Option text cannot be empty'),
            z.object({ text: z.string().min(1, 'Option text cannot be empty') }),
          ])
        )
        .min(2, 'A poll must have at least 2 options')
        .max(6, 'A poll can have at most 6 options'),
      durationDays: z.number().min(1).max(30).optional().default(3),
    })
    .optional(),
  isAnonymous: z.boolean().optional().default(false),
});

module.exports = {
  createPostSchema,
};
