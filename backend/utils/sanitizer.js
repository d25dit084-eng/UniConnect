const sanitizeHtml = require('sanitize-html');

/**
 * Robust sanitizer for post and comment Markdown/HTML content.
 * Prevents Stored XSS, script injection, and malicious URL schemes.
 */

const ALLOWED_TAGS = [
  'h1', 'h2', 'h3', 'h4', 'h5', 'h6',
  'blockquote', 'p', 'a', 'ul', 'ol',
  'li', 'b', 'i', 'strong', 'em', 'strike',
  'code', 'hr', 'br', 'pre',
  'table', 'thead', 'tbody', 'tr', 'th', 'td',
];

const ALLOWED_ATTRIBUTES = {
  a: ['href', 'name', 'target', 'title', 'rel'],
  code: ['class'],
};

const SANITIZE_OPTIONS = {
  allowedTags: ALLOWED_TAGS,
  allowedAttributes: ALLOWED_ATTRIBUTES,
  allowedSchemes: ['http', 'https', 'mailto'],
  transformTags: {
    a: (tagName, attribs) => {
      // Force external links to be safe
      return {
        tagName: 'a',
        attribs: {
          ...attribs,
          rel: 'noopener noreferrer nofollow',
          target: '_blank',
        },
      };
    },
  },
};

/**
 * Sanitizes rich text content (posts, comments, bios).
 * Returns cleaned string.
 */
const sanitizeContent = (content) => {
  if (typeof content !== 'string') return '';
  return sanitizeHtml(content, SANITIZE_OPTIONS).trim();
};

/**
 * Strict sanitizer for titles or usernames (no HTML permitted).
 */
const sanitizeTitle = (title) => {
  if (typeof title !== 'string') return '';
  return sanitizeHtml(title, { allowedTags: [], allowedAttributes: {} }).trim();
};

module.exports = {
  sanitizeContent,
  sanitizeTitle,
};
