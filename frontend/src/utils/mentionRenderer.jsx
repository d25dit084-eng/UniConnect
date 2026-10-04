import React from 'react';
import { Link } from 'react-router-dom';

/**
 * Parses plain text containing @username mentions and renders clickable Links.
 * Keeps non-mention segments untouched.
 *
 * @param {string} text
 * @returns {React.ReactNode}
 */
export const renderContentWithMentions = (text) => {
  if (!text || typeof text !== 'string') return text;

  // Regex matching @username where username is 3-30 word characters
  const mentionRegex = /@([a-zA-Z0-9_]{3,30})/g;
  const elements = [];
  let lastIndex = 0;
  let match;

  while ((match = mentionRegex.exec(text)) !== null) {
    const matchIndex = match.index;
    const rawMatch = match[0];
    const username = match[1];

    // Push text preceding the mention
    if (matchIndex > lastIndex) {
      elements.push(text.substring(lastIndex, matchIndex));
    }

    // Push clickable mention link
    elements.push(
      <Link
        key={`mention-${matchIndex}-${username}`}
        to={`/u/${username}`}
        style={{
          color: '#1d4ed8',
          fontWeight: 600,
          textDecoration: 'none',
          backgroundColor: '#eff6ff',
          padding: '1px 4px',
          borderRadius: '4px',
          margin: '0 1px',
        }}
        onClick={(e) => e.stopPropagation()}
      >
        {rawMatch}
      </Link>
    );

    lastIndex = matchIndex + rawMatch.length;
  }

  // Push remaining text
  if (lastIndex < text.length) {
    elements.push(text.substring(lastIndex));
  }

  return elements.length > 0 ? elements : text;
};

export default renderContentWithMentions;
