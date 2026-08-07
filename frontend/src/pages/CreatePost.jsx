import React, { useState, useEffect } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { getJoinedCommunities } from '../api/communityApi';
import { createPost } from '../api/postApi';

export const CreatePost = () => {
  const navigate = useNavigate();
  const location = useLocation();

  const [communities, setCommunities] = useState([]);
  const [selectedCommunityId, setSelectedCommunityId] = useState('');
  const [type, setType] = useState('text');
  const [title, setTitle] = useState('');
  const [content, setContent] = useState('');
  const [url, setUrl] = useState('');
  const [mediaUrl, setMediaUrl] = useState(''); // text entry fallback for image url for ease of wireframe testing
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

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
    };

    if (type === 'text') payload.content = content.trim();
    if (type === 'link') payload.url = url.trim();
    if (type === 'image') payload.media = [mediaUrl.trim() || '/uploads/placeholder.png'];

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
    <div className="create-post-card">
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
          </div>
        </div>

        <div className="form-group">
          <label>Title</label>
          <input
            type="text"
            required
            min={5}
            max={200}
            value={title}
            onChange={(e) => setTitle(e.target.value)}
            placeholder="An interesting title..."
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

        <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end', marginTop: '20px' }}>
          <button type="button" onClick={() => navigate(-1)} disabled={loading}>
            Cancel
          </button>
          <button type="submit" style={{ background: '#000', color: '#fff' }} disabled={loading}>
            {loading ? 'Publishing...' : 'Publish Post'}
          </button>
        </div>
      </form>
    </div>
  );
};
export default CreatePost;
