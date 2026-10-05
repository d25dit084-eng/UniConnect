import { useState, useEffect, useCallback } from 'react';
import { useAuth } from '../context/AuthContext';
import {
  listCourses,
  getCourseDetails,
  listProfessors,
  getProfessorDetails,
  submitReview,
  voteReview,
} from '../api/reviewApi';

const COMMON_TAGS = [
  'Clear grading',
  'Tough exams',
  'Inspirational',
  'Heavy workload',
  'Great lectures',
  'Lots of homework',
  'Accessible office hours',
  'Group projects',
  'Participation matters',
];

export default function ReviewsPage() {
  const { isAuthenticated } = useAuth();
  const [activeTab, setActiveTab] = useState('courses'); // 'courses' | 'professors'
  const [search, setSearch] = useState('');
  const [department, setDepartment] = useState('');
  const [items, setItems] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Active detail modal
  const [selectedTarget, setSelectedTarget] = useState(null); // course or professor detail
  const [targetType, setTargetType] = useState('course'); // 'course' | 'professor'
  const [reviews, setReviews] = useState([]);
  const [loadingDetail, setLoadingDetail] = useState(false);

  // Review submission state
  const [isReviewModalOpen, setIsReviewModalOpen] = useState(false);
  const [rating, setRating] = useState(5);
  const [difficulty, setDifficulty] = useState(3);
  const [wouldTakeAgain, setWouldTakeAgain] = useState(true);
  const [grade, setGrade] = useState('N/A');
  const [reviewContent, setReviewContent] = useState('');
  const [selectedTags, setSelectedTags] = useState([]);
  const [isAnonymous, setIsAnonymous] = useState(false);
  const [submittingReview, setSubmittingReview] = useState(false);
  const [reviewError, setReviewError] = useState(null);

  const fetchItems = useCallback(async () => {
    setLoading(true);
    setError(null);
    try {
      const params = {};
      if (search.trim()) params.search = search.trim();
      if (department) params.department = department;

      if (activeTab === 'courses') {
        const res = await listCourses(params);
        setItems(res.courses || []);
      } else {
        const res = await listProfessors(params);
        setItems(res.professors || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to fetch items');
    } finally {
      setLoading(false);
    }
  }, [activeTab, search, department]);

  useEffect(() => {
    fetchItems();
  }, [fetchItems]);

  const handleOpenDetail = async (item, type) => {
    setTargetType(type);
    setLoadingDetail(true);
    setSelectedTarget(item);
    try {
      if (type === 'course') {
        const res = await getCourseDetails(item._id);
        setSelectedTarget(res.course);
        setReviews(res.reviews || []);
      } else {
        const res = await getProfessorDetails(item._id);
        setSelectedTarget(res.professor);
        setReviews(res.reviews || []);
      }
    } catch (err) {
      console.error('Failed to load details:', err);
    } finally {
      setLoadingDetail(false);
    }
  };

  const handleCloseDetail = () => {
    setSelectedTarget(null);
    setReviews([]);
    setIsReviewModalOpen(false);
  };

  const handleTagToggle = (tag) => {
    if (selectedTags.includes(tag)) {
      setSelectedTags(selectedTags.filter((t) => t !== tag));
    } else {
      setSelectedTags([...selectedTags, tag]);
    }
  };

  const handleSubmitReview = async (e) => {
    e.preventDefault();
    if (!isAuthenticated) return;
    if (reviewContent.trim().length < 10) {
      setReviewError('Review content must be at least 10 characters.');
      return;
    }

    setSubmittingReview(true);
    setReviewError(null);

    try {
      const payload = {
        targetType,
        rating: Number(rating),
        difficulty: Number(difficulty),
        wouldTakeAgain,
        grade,
        content: reviewContent.trim(),
        tags: selectedTags,
        isAnonymous,
      };
      if (targetType === 'course') {
        payload.courseId = selectedTarget._id;
      } else {
        payload.professorId = selectedTarget._id;
      }

      const res = await submitReview(payload);
      if (res.success && res.review) {
        setReviews([res.review, ...reviews]);
        setIsReviewModalOpen(false);
        setReviewContent('');
        setSelectedTags([]);
        setIsAnonymous(false);
        // Refresh detail for updated metrics
        handleOpenDetail(selectedTarget, targetType);
        fetchItems();
      }
    } catch (err) {
      setReviewError(err.response?.data?.message || 'Failed to submit review');
    } finally {
      setSubmittingReview(false);
    }
  };

  const handleVoteReview = async (reviewId, voteType) => {
    try {
      const res = await voteReview(reviewId, voteType);
      if (res.success) {
        setReviews(
          reviews.map((r) =>
            r._id === reviewId
              ? {
                  ...r,
                  helpfulCount: res.helpfulCount,
                  unhelpfulCount: res.unhelpfulCount,
                }
              : r
          )
        );
      }
    } catch (err) {
      console.error('Vote failed:', err);
    }
  };

  const getRatingBadgeColor = (val) => {
    if (val >= 4.0) return 'linear-gradient(135deg, #10b981, #059669)';
    if (val >= 3.0) return 'linear-gradient(135deg, #f59e0b, #d97706)';
    if (val > 0) return 'linear-gradient(135deg, #ef4444, #dc2626)';
    return 'rgba(255, 255, 255, 0.1)';
  };

  return (
    <div className="reviews-page" style={{ maxWidth: '980px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Top Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid var(--glass-border)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '14px' }}>
          <span style={{ fontSize: '32px' }}>🎓</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>
              Courses & Professors
            </h1>
            <p style={{ margin: '4px 0 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
              Campus reviews, grade difficulty, honest tips, and anonymous elective advice.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '8px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('courses')}
            className={activeTab === 'courses' ? 'btn-accent' : 'btn-secondary'}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-ctl)',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            📚 Courses
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('professors')}
            className={activeTab === 'professors' ? 'btn-accent' : 'btn-secondary'}
            style={{
              padding: '8px 18px',
              borderRadius: 'var(--radius-ctl)',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            👨‍🏫 Professors
          </button>
        </div>
      </div>

      {/* Search and Filters */}
      <div
        style={{
          display: 'flex',
          gap: '12px',
          marginBottom: '24px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            className="glass-input-field"
            placeholder={
              activeTab === 'courses'
                ? 'Search course code or title (e.g. CS201)...'
                : 'Search professor by name...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
          />
        </div>

        <select
          value={department}
          className="glass-input-field"
          onChange={(e) => setDepartment(e.target.value)}
          style={{ width: '200px', cursor: 'pointer' }}
        >
          <option value="">All Departments</option>
          <option value="Computer Science">Computer Science</option>
          <option value="Mathematics">Mathematics</option>
          <option value="Physics">Physics</option>
          <option value="Economics">Economics</option>
          <option value="Biology">Biology</option>
        </select>
      </div>

      {/* Target Items List */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
          <p>Loading {activeTab}...</p>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '16px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            borderRadius: 'var(--radius-ctl)',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      ) : items.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--glass-bg)',
            borderRadius: 'var(--radius-card)',
            border: '1px dashed var(--glass-border)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
            color: 'var(--text-secondary)',
          }}
        >
          <div style={{ fontSize: '36px', marginBottom: '12px' }}>🔍</div>
          <p style={{ margin: 0, fontSize: '15px' }}>
            No {activeTab} found matching your query.
          </p>
        </div>
      ) : (
        <div
          style={{
            display: 'grid',
            gridTemplateColumns: 'repeat(auto-fill, minmax(280px, 1fr))',
            gap: '16px',
          }}
        >
          {items.map((item) => (
            <div
              key={item._id}
              className="glass-panel-card"
              onClick={() => handleOpenDetail(item, activeTab === 'courses' ? 'course' : 'professor')}
              style={{
                cursor: 'pointer',
                display: 'flex',
                flexDirection: 'column',
                justifyContent: 'space-between',
              }}
            >
              <div>
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    marginBottom: '10px',
                    gap: '10px',
                  }}
                >
                  <span className="glass-tag-course">
                    {activeTab === 'courses' ? item.code : item.department}
                  </span>

                  <div
                    style={{
                      padding: '4px 10px',
                      borderRadius: 'var(--radius-ctl)',
                      background: getRatingBadgeColor(item.avgRating),
                      color: '#ffffff',
                      fontWeight: '700',
                      fontSize: '13px',
                      display: 'flex',
                      alignItems: 'center',
                      gap: '4px',
                      boxShadow: '0 2px 8px rgba(0, 0, 0, 0.25)',
                    }}
                  >
                    ⭐ {item.avgRating > 0 ? item.avgRating.toFixed(1) : 'N/A'}
                  </div>
                </div>

                <h3
                  style={{
                    margin: '0 0 6px 0',
                    fontSize: '16px',
                    color: 'var(--text-primary)',
                    fontWeight: '700',
                    lineHeight: '1.3',
                  }}
                >
                  {item.name}
                </h3>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: 'var(--text-secondary)',
                  fontSize: '12px',
                  marginTop: '16px',
                  borderTop: '1px solid var(--glass-border)',
                  paddingTop: '10px',
                }}
              >
                <span>Difficulty: {item.avgDifficulty > 0 ? `${item.avgDifficulty.toFixed(1)}/5` : 'N/A'}</span>
                <span>{item.reviewsCount} review{item.reviewsCount !== 1 ? 's' : ''}</span>
              </div>
            </div>
          ))}
        </div>
      )}

      {/* Target Detail & Reviews Modal */}
      {selectedTarget && (
        <div
          className="glass-modal-overlay"
          onClick={handleCloseDetail}
        >
          <div
            className="glass-modal-dialog"
            style={{
              maxWidth: '720px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '28px',
              position: 'relative',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={handleCloseDetail}
              style={{
                position: 'absolute',
                top: '20px',
                right: '20px',
                background: 'rgba(255, 255, 255, 0.08)',
                border: '1px solid var(--glass-border)',
                color: 'var(--text-secondary)',
                cursor: 'pointer',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                fontSize: '15px',
                transition: 'all 0.15s ease',
              }}
            >
              ✕
            </button>

            {/* Target Header */}
            <div style={{ marginBottom: '22px' }}>
              <span className="glass-tag-course" style={{ marginBottom: '8px', display: 'inline-block' }}>
                {targetType === 'course' ? selectedTarget.code : selectedTarget.title || 'Professor'}
              </span>
              <h2 style={{ margin: '6px 0 4px 0', fontSize: '24px', fontWeight: '800', color: 'var(--text-primary)' }}>
                {selectedTarget.name}
              </h2>
              <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
                {selectedTarget.department} {selectedTarget.credits ? `• ${selectedTarget.credits} Credits` : ''}
              </p>
            </div>

            {/* Stats Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '12px',
                background: 'rgba(255, 255, 255, 0.03)',
                border: '1px solid var(--glass-border)',
                padding: '16px',
                borderRadius: 'var(--radius-ctl)',
                marginBottom: '24px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#10b981' }}>
                  ⭐ {selectedTarget.avgRating > 0 ? selectedTarget.avgRating.toFixed(1) : 'N/A'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Overall Rating</div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: '800', color: '#f59e0b' }}>
                  {selectedTarget.avgDifficulty > 0 ? `${selectedTarget.avgDifficulty.toFixed(1)}/5` : 'N/A'}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Difficulty</div>
              </div>

              {targetType === 'professor' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '22px', fontWeight: '800', color: '#38bdf8' }}>
                    {selectedTarget.wouldTakeAgainPercent || 0}%
                  </div>
                  <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Would Take Again</div>
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '22px', fontWeight: '800', color: 'var(--text-primary)' }}>
                  {selectedTarget.reviewsCount || 0}
                </div>
                <div style={{ fontSize: '12px', color: 'var(--text-secondary)', marginTop: '2px' }}>Total Reviews</div>
              </div>
            </div>

            {/* Action Bar */}
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h3 style={{ margin: 0, fontSize: '18px', fontWeight: '700', color: 'var(--text-primary)' }}>
                Student Reviews ({reviews.length})
              </h3>

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(true)}
                  className="btn-accent"
                  style={{
                    padding: '8px 16px',
                    fontSize: '13px',
                  }}
                >
                  ✍️ Write Review
                </button>
              )}
            </div>

            {/* Review Submission Inline Box */}
            {isReviewModalOpen && (
              <form
                onSubmit={handleSubmitReview}
                className="glass-panel-card"
                style={{
                  padding: '20px',
                  marginBottom: '24px',
                  border: '1px solid rgba(139, 147, 255, 0.3)',
                }}
              >
                <h4 style={{ margin: '0 0 14px', color: 'var(--accent)', fontSize: '16px', fontWeight: '700' }}>
                  Submit Your Review for {selectedTarget.name}
                </h4>

                {reviewError && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.15)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#fca5a5',
                      padding: '10px 14px',
                      borderRadius: 'var(--radius-ctl)',
                      fontSize: '13px',
                      marginBottom: '14px',
                    }}
                  >
                    {reviewError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '14px' }}>
                  <div style={{ flex: '1 1 140px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Rating (1-5)
                    </label>
                    <select
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      className="glass-input-field"
                    >
                      <option value={5}>⭐⭐⭐⭐⭐ (5 - Awesome)</option>
                      <option value={4}>⭐⭐⭐⭐ (4 - Great)</option>
                      <option value={3}>⭐⭐⭐ (3 - Average)</option>
                      <option value={2}>⭐⭐ (2 - Below Avg)</option>
                      <option value={1}>⭐ (1 - Awful)</option>
                    </select>
                  </div>

                  <div style={{ flex: '1 1 140px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Difficulty (1-5)
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(Number(e.target.value))}
                      className="glass-input-field"
                    >
                      <option value={1}>1 - Very Easy</option>
                      <option value={2}>2 - Easy</option>
                      <option value={3}>3 - Medium</option>
                      <option value={4}>4 - Hard</option>
                      <option value={5}>5 - Extremely Hard</option>
                    </select>
                  </div>

                  <div style={{ flex: '1 1 140px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Would Take Again?
                    </label>
                    <select
                      value={wouldTakeAgain ? 'yes' : 'no'}
                      onChange={(e) => setWouldTakeAgain(e.target.value === 'yes')}
                      className="glass-input-field"
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div style={{ flex: '1 1 140px' }}>
                    <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '4px' }}>
                      Grade Received
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      className="glass-input-field"
                    >
                      {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'Pass', 'Audit', 'N/A'].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tags selector */}
                <div style={{ marginBottom: '14px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '6px' }}>
                    Select Tags
                  </label>
                  <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap' }}>
                    {COMMON_TAGS.map((tag) => {
                      const isSelected = selectedTags.includes(tag);
                      return (
                        <button
                          key={tag}
                          type="button"
                          onClick={() => handleTagToggle(tag)}
                          style={{
                            padding: '4px 10px',
                            borderRadius: '16px',
                            fontSize: '11px',
                            cursor: 'pointer',
                            border: '1px solid',
                            borderColor: isSelected ? 'var(--accent)' : 'var(--glass-border)',
                            background: isSelected ? 'rgba(139, 147, 255, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                            color: isSelected ? '#ffffff' : 'var(--text-secondary)',
                            transition: 'all 0.15s ease',
                          }}
                        >
                          {isSelected ? '✓ ' : '+ '}
                          {tag}
                        </button>
                      );
                    })}
                  </div>
                </div>

                {/* Review Text */}
                <div style={{ marginBottom: '14px' }}>
                  <textarea
                    rows={4}
                    placeholder="Share your experience: coursework, exam expectations, workload, tips for future students..."
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                    className="glass-input-field"
                    style={{
                      width: '100%',
                      resize: 'vertical',
                      boxSizing: 'border-box',
                    }}
                  />
                </div>

                {/* Anonymity Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '10px',
                    padding: '10px 14px',
                    background: isAnonymous ? 'rgba(147, 51, 234, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: isAnonymous ? '1px solid rgba(147, 51, 234, 0.35)' : '1px solid var(--glass-border)',
                    borderRadius: 'var(--radius-ctl)',
                    marginBottom: '16px',
                  }}
                >
                  <input
                    type="checkbox"
                    id="anonReviewToggle"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    style={{ cursor: 'pointer', accentColor: '#c084fc' }}
                  />
                  <label htmlFor="anonReviewToggle" style={{ fontSize: '13px', color: isAnonymous ? '#c084fc' : 'var(--text-secondary)', cursor: 'pointer' }}>
                    👻 <strong>Submit review anonymously</strong> (Your username and profile will be completely hidden with a pseudonymous alias)
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '10px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setIsReviewModalOpen(false)}
                    className="btn-secondary"
                    style={{ padding: '8px 16px', fontSize: '13px' }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    className="btn-accent"
                    style={{
                      padding: '8px 20px',
                      fontSize: '13px',
                      background: isAnonymous ? 'linear-gradient(135deg, #7c3aed, #9333ea)' : undefined,
                    }}
                  >
                    {submittingReview ? 'Submitting...' : isAnonymous ? '👻 Post Anonymously' : 'Submit Review'}
                  </button>
                </div>
              </form>
            )}

            {/* Reviews List */}
            {loadingDetail ? (
              <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
                <div style={{ fontSize: '24px', marginBottom: '6px' }}>⏳</div>
                <p>Loading reviews...</p>
              </div>
            ) : reviews.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '40px 20px',
                  background: 'var(--glass-bg)',
                  borderRadius: 'var(--radius-card)',
                  border: '1px dashed var(--glass-border)',
                  color: 'var(--text-secondary)',
                  fontSize: '14px',
                }}
              >
                No reviews yet. Be the first to share your thoughts!
              </div>
            ) : (
              <div style={{ display: 'flex', flexDirection: 'column', gap: '12px' }}>
                {reviews.map((rev) => {
                  const author = rev.author || {};
                  return (
                    <div
                      key={rev._id}
                      className="glass-panel-card"
                      style={{ padding: '16px' }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px',
                          flexWrap: 'wrap',
                          gap: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '700', color: author.isAnonymous ? '#c084fc' : 'var(--accent)' }}>
                            {author.isAnonymous ? `👻 ${author.alias || 'Anonymous'}` : author.username || 'Student'}
                          </span>
                          {author.isMine && (
                            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '1px 6px', borderRadius: '4px' }}>
                              you
                            </span>
                          )}
                          <span style={{ fontSize: '12px', color: 'var(--text-secondary)' }}>
                            • {new Date(rev.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: getRatingBadgeColor(rev.rating),
                              color: '#fff',
                              fontSize: '12px',
                              fontWeight: '700',
                            }}
                          >
                            ⭐ {rev.rating}/5
                          </span>
                          <span
                            style={{
                              padding: '2px 8px',
                              borderRadius: '4px',
                              background: 'rgba(255, 255, 255, 0.08)',
                              color: 'var(--text-secondary)',
                              fontSize: '12px',
                            }}
                          >
                            Diff: {rev.difficulty}/5
                          </span>
                          {rev.grade && rev.grade !== 'N/A' && (
                            <span
                              style={{
                                padding: '2px 8px',
                                borderRadius: '4px',
                                background: 'rgba(139, 147, 255, 0.2)',
                                color: '#a5b4fc',
                                fontSize: '12px',
                              }}
                            >
                              Grade: {rev.grade}
                            </span>
                          )}
                        </div>
                      </div>

                      <p style={{ margin: '8px 0', color: 'var(--text-primary)', fontSize: '14px', lineHeight: '1.6' }}>
                        {rev.content}
                      </p>

                      {rev.tags && rev.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '10px 0' }}>
                          {rev.tags.map((t) => (
                            <span
                              key={t}
                              className="glass-tag-badge"
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '12px', marginTop: '10px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleVoteReview(rev._id, 'helpful')}
                          className="btn-secondary"
                          style={{
                            fontSize: '12px',
                            padding: '4px 12px',
                            borderRadius: 'var(--radius-ctl)',
                          }}
                        >
                          👍 Helpful ({rev.helpfulCount || 0})
                        </button>
                      </div>
                    </div>
                  );
                })}
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
