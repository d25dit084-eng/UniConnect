import React, { useState, useEffect, useRef } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import gsap from 'gsap';
import { getJoinedCommunities } from '../api/communityApi';
import { createPost } from '../api/postApi';

export const CreatePost = () => {
  const navigate = useNavigate();
  const location = useLocation();
  const cardRef = useRef(null);

  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [type, setType] = useState('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [mediaUrl, setMediaUrl] = useState('');
  const [pollOptions, setPollOptions] = useState(['', '']);
  const [pollDurationDays, setPollDurationDays] = useState(7);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    if (cardRef.current) {
      gsap.fromTo(
        cardRef.current,
        { opacity: 0, y: 16, scale: 0.99 },
        { opacity: 1, y: 0, scale: 1, duration: 0.45, ease: 'power2.out' }
      );
    }
  }, []);

  useEffect(() => {
    const fetchJoined = async () => {
      try {
        const res = await getJoinedCommunities();
        const list = res.data.communities || [];
        setCommunities(list);

        // Pre-select if passed from community state
        if (location.state?.communityId) {
          setSelectedCommunityId(location.state.communityId);
        } else if (list.length > 0) {
          setSelectedCommunityId(list[0]._id);
        }
      } catch (err) {
        console.error('[CreatePost] Failed to load joined communities:', err.message);
      }
    };

    fetchJoined();
  }, [location]);

  const handlePollOptionChange = (index, value) => {
    const updated = [...pollOptions];
    updated[index] = value;
    setPollOptions(updated);
  };

  const addPollOption = () => {
    if (pollOptions.length < 6) {
      setPollOptions([...pollOptions, '']);
    }
  };

  const removePollOption = (index) => {
    if (pollOptions.length > 2) {
      setPollOptions(pollOptions.filter((_, i) => i !== index));
    }
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setLoading(true);
    setError('');

    if (!selectedCommunityId) {
      setError('Please join a community before posting.');
      setLoading(false);
      return;
    }

    const payload = {
      communityId: selectedCommunityId,
      type,
      title: title.trim(),
      isAnonymous,
    };

    if (type === 'text') payload.content = content.trim();
    if (type === 'link') payload.url = url.trim();
    if (type === 'image') payload.media = [mediaUrl.trim() || '/uploads/placeholder.png'];
    if (type === 'poll') {
      const validOptions = pollOptions.map((o) => o.trim()).filter(Boolean);
      if (validOptions.length < 2) {
        setError('Poll requires at least 2 non-empty options.');
        setLoading(false);
        return;
      }
      payload.poll = {
        question: title.trim(),
        options: validOptions,
        durationDays: Number(pollDurationDays),
      };
      if (content.trim()) payload.content = content.trim();
    }

    try {
      const res = await createPost(payload);
      alert('Post created successfully!');
      navigate(`/post/${res.data.post._id}`);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Post creation failed');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div ref={cardRef} className="create-post-card">
      <h2>Create Post</h2>
      {error && <div className="error-indicator">{error}</div>}

      <form onSubmit={handleSubmit}>
        <div className="form-group">
          <label>Post to Community</label>
          <select
            value={selectedCommunityId}
            onChange={(e) => setSelectedCommunityId(e.target.value)}
            required
          >
            {communities.length > 0 ? (
              communities.map((c) => (
                <option key={c._id} value={c._id}>
                  c/{c.name} ({c.displayName})
                </option>
              ))
            ) : (
              <option value="">-- No Joined Communities found --</option>
            )}
          </select>
          {communities.length === 0 && (
            <span style={{ fontSize: '11px', color: '#c00' }}>
              Please join or create a community first.
            </span>
          )}
        </div>

        <div className="form-group">
          <label>Post Type</label>
          <div className="post-type-selector">
            <button
              type="button"
              className={type === 'text' ? 'active' : ''}
              onClick={() => setType('text')}
            >
              Text Post
            </button>
            <button
              type="button"
              className={type === 'link' ? 'active' : ''}
              onClick={() => setType('link')}
            >
              Link Post
            </button>
            <button
              type="button"
              className={type === 'image' ? 'active' : ''}
              onClick={() => setType('image')}
            >
              Image Post
            </button>
            <button
              type="button"
              className={type === 'poll' ? 'active' : ''}
              onClick={() => setType('poll')}
            >
              📊 Poll Post
            </button>
          </div>
        </div>

        <div className="form-group">
          <label>{type === 'poll' ? 'Poll Question / Title' : 'Title'}</label>
          <input
            type="text"
            required
            min={5}
            max={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder={
              type === 'poll' ? 'Ask a question for campus votes...' : 'An interesting title...'
            }
          />
        </div>

        {type === 'text' && (
          <div className="form-group">
            <label>Body Content</label>
            <textarea
              rows="6"
              value={content}
              onChange={(e) => setContent(e.target.value)}
              placeholder="What are your thoughts?"
            />
          </div>
        )}

        {type === 'link' && (
          <div className="form-group">
            <label>URL Link</label>
            <input
              type="text"
              required
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              placeholder="https://example.com"
            />
          </div>
        )}

        {type === 'image' && (
          <div className="form-group">
            <label>Image URL Path (or Upload Path)</label>
            <input
              type="text"
              value={mediaUrl}
              onChange={(e) => setMediaUrl(e.target.value)}
              placeholder="/uploads/sample.jpg"
            />
          </div>
        )}

        {type === 'poll' && (
          <div className="form-group">
            <label style={{ marginBottom: '6px', display: 'block' }}>Poll Options (2 to 6)</label>
            <div
              style={{
                display: 'flex',
                flexDirection: 'column',
                gap: '8px',
                marginBottom: '10px',
              }}
            >
              {pollOptions.map((opt, idx) => (
                <div key={idx} style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <input
                    type="text"
                    required
                    maxLength={100}
                    value={opt}
                    onChange={(e) => handlePollOptionChange(idx, e.target.value)}
                    placeholder={`Option ${idx + 1}`}
                    style={{ flex: 1 }}
                  />
                  {pollOptions.length > 2 && (
                    <button
                      type="button"
                      onClick={() => removePollOption(idx)}
                      style={{
                        padding: '6px 12px',
                        border: '1px solid #dcdcdc',
                        background: '#fff',
                        borderRadius: '4px',
                        cursor: 'pointer',
                        color: '#d32f2f',
                        fontSize: '13px',
                      }}
                      title="Remove option"
                    >
                      ✕
                    </button>
                  )}
                </div>
              ))}
            </div>

            {pollOptions.length < 6 && (
              <button
                type="button"
                onClick={addPollOption}
                style={{
                  padding: '6px 14px',
                  fontSize: '13px',
                  border: '1px dashed #3b82f6',
                  color: '#3b82f6',
                  background: '#eff6ff',
                  borderRadius: '4px',
                  cursor: 'pointer',
                  marginBottom: '14px',
                  fontWeight: 500,
                }}
              >
                + Add Option
              </button>
            )}

            <div style={{ marginTop: '10px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>
                Voting Duration
              </label>
              <select
                value={pollDurationDays}
                onChange={(e) => setPollDurationDays(Number(e.target.value))}
                style={{ width: 'auto', minWidth: '160px' }}
              >
                <option value={1}>1 Day</option>
                <option value={3}>3 Days</option>
                <option value={7}>7 Days (Recommended)</option>
                <option value={14}>14 Days</option>
                <option value={30}>30 Days</option>
              </select>
            </div>

            <div style={{ marginTop: '14px' }}>
              <label style={{ display: 'block', fontSize: '13px', marginBottom: '4px' }}>
                Context / Additional Notes (Optional)
              </label>
              <textarea
                rows="3"
                value={content}
                onChange={(e) => setContent(e.target.value)}
                placeholder="Provide more context or instructions for your poll..."
              />
            </div>
          </div>
        )}

        <div
          className="form-group"
          style={{ display: 'flex', alignItems: 'center', gap: '10px', marginTop: '8px' }}
        >
          <label
            htmlFor="post-anonymous-toggle"
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '8px',
              cursor: 'pointer',
              userSelect: 'none',
              margin: 0,
            }}
          >
            <input
              id="post-anonymous-toggle"
              type="checkbox"
              checked={isAnonymous}
              onChange={(e) => setIsAnonymous(e.target.checked)}
              style={{ width: '16px', height: '16px', cursor: 'pointer' }}
            />
            <span style={{ fontSize: '12px', color: isAnonymous ? '#4f8ef7' : '#666' }}>
              Post anonymously
              {isAnonymous && (
                <span
                  style={{
                    marginLeft: '6px',
                    fontSize: '11px',
                    fontStyle: 'italic',
                    color: '#888',
                  }}
                >
                  — your name is hidden; you can see your own post.
                </span>
              )}
            </span>
          </label>
        </div>

        <div
          style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}
        >
          <button type="button" onClick={() => navigate(-1)} disabled={loading}>
            Cancel
          </button>
          <button type="submit" style={{ background: '#000', color: '#fff' }} disabled={loading}>
            {loading ? 'Publishing...' : isAnonymous ? '👻 Publish Anonymously' : 'Publish Post'}
          </button>
        </div>
      </form>
    </div>
  );
};
export default CreatePost;
