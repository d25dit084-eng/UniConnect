import React, { useState, useEffect, useRef } from 'react';
import { autocompleteUsers } from '../api/userApi';

export const MentionTextarea = ({
  value,
  onChange,
  placeholder,
  rows = 4,
  required = false,
  style = {},
  className = '',
}) => {
  const [suggestions, setSuggestions] = useState([]);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [mentionQuery, setMentionQuery] = useState('');
  const [mentionStartIndex, setMentionStartIndex] = useState(-1);
  const [selectedIndex, setSelectedIndex] = useState(0);

  const textareaRef = useRef(null);
  const dropdownRef = useRef(null);

  // Detect mention trigger on text change or cursor movement
  const handleInputChange = (e) => {
    const text = e.target.value;
    onChange(text);
    checkMentionTrigger(e.target);
  };

  const handleSelect = (e) => {
    checkMentionTrigger(e.target);
  };

  const checkMentionTrigger = (target) => {
    const text = target.value;
    const cursor = target.selectionStart;

    // Look backwards from cursor to find an active @ token
    const textBeforeCursor = text.slice(0, cursor);
    const lastAtMatch = /(?:^|\s)@([a-zA-Z0-9_]*)$/.exec(textBeforeCursor);

    if (lastAtMatch) {
      const query = lastAtMatch[1];
      const atIndex = textBeforeCursor.lastIndexOf('@' + query);
      setMentionStartIndex(atIndex);
      setMentionQuery(query);
      setSelectedIndex(0);
    } else {
      setShowSuggestions(false);
      setMentionQuery('');
      setMentionStartIndex(-1);
    }
  };

  // Debounced search for suggestions
  useEffect(() => {
    if (mentionStartIndex === -1 || mentionQuery === undefined) {
      setShowSuggestions(false);
      return;
    }

    let isMounted = true;
    const timer = setTimeout(async () => {
      try {
        const res = await autocompleteUsers(mentionQuery);
        if (isMounted) {
          const list = res.data?.users || [];
          setSuggestions(list);
          setShowSuggestions(list.length > 0);
        }
      } catch (err) {
        if (isMounted) setShowSuggestions(false);
      }
    }, 180);

    return () => {
      isMounted = false;
      clearTimeout(timer);
    };
  }, [mentionQuery, mentionStartIndex]);

  const insertMention = (user) => {
    if (!user || mentionStartIndex === -1) return;

    const rawUsername = user.rawUsername || user.username.replace(/^u\//, '');
    const beforeAt = value.slice(0, mentionStartIndex);
    const afterCursor = value.slice(mentionStartIndex + 1 + mentionQuery.length);

    const newText = `${beforeAt}@${rawUsername} ${afterCursor}`;
    onChange(newText);

    setShowSuggestions(false);
    setMentionStartIndex(-1);
    setMentionQuery('');

    // Restore cursor position after the inserted mention
    setTimeout(() => {
      if (textareaRef.current) {
        const nextPos = mentionStartIndex + rawUsername.length + 2;
        textareaRef.current.focus();
        textareaRef.current.setSelectionRange(nextPos, nextPos);
      }
    }, 0);
  };

  const handleKeyDown = (e) => {
    if (!showSuggestions || suggestions.length === 0) return;

    if (e.key === 'ArrowDown') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev + 1) % suggestions.length);
    } else if (e.key === 'ArrowUp') {
      e.preventDefault();
      setSelectedIndex((prev) => (prev - 1 + suggestions.length) % suggestions.length);
    } else if (e.key === 'Enter' || e.key === 'Tab') {
      e.preventDefault();
      insertMention(suggestions[selectedIndex]);
    } else if (e.key === 'Escape') {
      setShowSuggestions(false);
    }
  };

  return (
    <div style={{ position: 'relative', width: '100%' }}>
      <textarea
        ref={textareaRef}
        rows={rows}
        required={required}
        placeholder={placeholder}
        value={value}
        onChange={handleInputChange}
        onSelect={handleSelect}
        onKeyDown={handleKeyDown}
        className={className}
        style={{ width: '100%', boxSizing: 'border-box', ...style }}
      />

      {showSuggestions && suggestions.length > 0 && (
        <div
          ref={dropdownRef}
          style={{
            position: 'absolute',
            bottom: '100%',
            left: '10px',
            marginBottom: '4px',
            width: '260px',
            maxHeight: '200px',
            overflowY: 'auto',
            backgroundColor: '#ffffff',
            border: '1px solid #e0dfdb',
            borderRadius: '6px',
            boxShadow: '0 4px 12px rgba(0,0,0,0.15)',
            zIndex: 100,
          }}
        >
          <div
            style={{
              padding: '4px 8px',
              fontSize: '11px',
              fontWeight: 600,
              color: '#888',
              borderBottom: '1px solid #f0f0f0',
              textTransform: 'uppercase',
            }}
          >
            Mention campus peer
          </div>
          {suggestions.map((u, idx) => (
            <div
              key={u._id}
              onClick={() => insertMention(u)}
              onMouseEnter={() => setSelectedIndex(idx)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '8px',
                padding: '8px 10px',
                cursor: 'pointer',
                backgroundColor: idx === selectedIndex ? '#eff6ff' : '#ffffff',
                borderBottom: '1px solid #fafafa',
                fontSize: '13px',
              }}
            >
              <div
                style={{
                  width: '24px',
                  height: '24px',
                  borderRadius: '50%',
                  backgroundColor: '#3b82f6',
                  color: '#fff',
                  display: 'flex',
                  alignItems: 'center',
                  justifyContent: 'center',
                  fontSize: '11px',
                  fontWeight: 700,
                  overflow: 'hidden',
                }}
              >
                {u.avatar ? (
                  <img
                    src={u.avatar}
                    alt=""
                    style={{ width: '100%', height: '100%', objectFit: 'cover' }}
                  />
                ) : (
                  (u.rawUsername || u.username)[0].toUpperCase()
                )}
              </div>
              <span style={{ fontWeight: 600, color: '#1a1a1b' }}>{u.username}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  );
};

export default MentionTextarea;
