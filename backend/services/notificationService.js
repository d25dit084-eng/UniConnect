const Notification = require('../models/Notification');

/**
 * Notification Service
 *
 * Creates notifications for social interactions.
 * ANONYMITY RULE: The message uses the actor's anonymous alias — never real name.
 * The actor ObjectId is stored internally for potential future admin tools only.
 *
 * Self-interaction rule: Never notify a user about their own actions.
 */

/**
 * Create a notification.
 * Silently swallows errors so a failed notification never breaks the main action.
 *
 * @param {Object} params
 * @param {ObjectId} params.recipientId - Who receives the notification
 * @param {ObjectId} params.actorId - Who performed the action
 * @param {string} params.type - Notification type
 * @param {string} params.message - Human-readable anonymous message
 * @param {ObjectId|null} params.postId
 * @param {ObjectId|null} params.commentId
 */
const createNotification = async ({
  recipientId,
  actorId,
  type,
  message,
  postId = null,
  commentId = null,
}) => {
  try {
    // Never notify a user about their own action
    if (recipientId.toString() === actorId.toString()) return;

    await Notification.create({
      recipient: recipientId,
      actor: actorId,
      type,
      message,
      post: postId,
      comment: commentId,
    });
  } catch (err) {
    // Log but never throw — notifications are secondary
    console.error('[NotificationService] Failed to create notification:', err.message);
  }
};

/**
 * Notify post owner when someone likes their post.
 */
const notifyPostLiked = async ({ postAuthorId, actorId, actorAlias, postId }) => {
  await createNotification({
    recipientId: postAuthorId,
    actorId: actorAlias ? actorId : null,
    type: 'post_like',
    message: actorAlias ? `${actorAlias} liked your post.` : 'Someone liked your post.',
    postId,
  });
};

/**
 * Notify comment owner when someone likes their comment.
 */
const notifyCommentLiked = async ({ commentAuthorId, actorId, actorAlias, postId, commentId }) => {
  await createNotification({
    recipientId: commentAuthorId,
    actorId: actorAlias ? actorId : null,
    type: 'comment_like',
    message: actorAlias ? `${actorAlias} liked your comment.` : 'Someone liked your comment.',
    postId,
    commentId,
  });
};

/**
 * Notify post owner when someone comments on their post.
 */
const notifyPostCommented = async ({ postAuthorId, actorId, actorAlias, postId, commentId }) => {
  await createNotification({
    recipientId: postAuthorId,
    actorId: actorAlias ? actorId : null,
    type: 'post_comment',
    message: actorAlias ? `${actorAlias} commented on your post.` : 'Someone commented on your post.',
    postId,
    commentId,
  });
};

/**
 * Notify comment owner when someone replies to their comment.
 */
const notifyCommentReplied = async ({ commentAuthorId, actorId, actorAlias, postId, commentId }) => {
  await createNotification({
    recipientId: commentAuthorId,
    actorId: actorAlias ? actorId : null,
    type: 'comment_reply',
    message: actorAlias ? `${actorAlias} replied to your comment.` : 'Someone replied to your comment.',
    postId,
    commentId,
  });
};

module.exports = {
  notifyPostLiked,
  notifyCommentLiked,
  notifyPostCommented,
  notifyCommentReplied,
};
