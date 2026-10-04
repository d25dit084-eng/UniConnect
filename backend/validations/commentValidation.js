const { z } = require('zod');

const createCommentSchema = z.object({
  postId: z
    .string({ required_error: 'Post ID is required' })
    .regex(/^[0-9a-fA-F]{24}$/, 'Invalid post ID format'),
  content: z
    .string({ required_error: 'Comment content is required' })
    .trim()
    .min(1, 'Comment cannot be empty')
    .max(2000, 'Comment cannot exceed 2000 characters'),
  isAnonymous: z.boolean().optional().default(false),
});

const replyCommentSchema = z.object({
  content: z
    .string({ required_error: 'Reply content is required' })
    .trim()
    .min(1, 'Reply cannot be empty')
    .max(2000, 'Reply cannot exceed 2000 characters'),
  isAnonymous: z.boolean().optional().default(false),
});

module.exports = {
  createCommentSchema,
  replyCommentSchema,
};
