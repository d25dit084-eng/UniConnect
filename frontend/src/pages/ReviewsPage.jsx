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
    <div className="reviews-page" style={{ maxWidth: '960px', margin: '0 auto', padding: '16px' }}>
      {/* Header Banner */}
      <div
        style={{
          background: 'linear-gradient(135deg, rgba(30, 41, 59, 0.7), rgba(15, 23, 42, 0.9))',
          border: '1px solid rgba(255, 255, 255, 0.08)',
          borderRadius: '16px',
          padding: '24px',
          marginBottom: '24px',
          boxShadow: '0 8px 32px rgba(0, 0, 0, 0.3)',
          backdropFilter: 'blur(12px)',
        }}
      >
        <div style={{ display: 'flex', alignItems: 'center', gap: '12px', marginBottom: '8px' }}>
          <span style={{ fontSize: '32px' }}>🎓</span>
          <div>
            <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#f8fafc' }}>
              Courses & Professors
            </h1>
            <p style={{ margin: '4px 0 0', color: '#94a3b8', fontSize: '14px' }}>
              Campus reviews, grade difficulty, honest tips, and anonymous elective advice.
            </p>
          </div>
        </div>

        {/* Tab switcher */}
        <div style={{ display: 'flex', gap: '8px', marginTop: '16px' }}>
          <button
            type="button"
            onClick={() => setActiveTab('courses')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              background: activeTab === 'courses' ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              transition: 'all 0.2s ease',
            }}
          >
            📚 Courses
          </button>
          <button
            type="button"
            onClick={() => setActiveTab('professors')}
            style={{
              padding: '8px 18px',
              borderRadius: '8px',
              border: 'none',
              cursor: 'pointer',
              fontWeight: '600',
              fontSize: '14px',
              background: activeTab === 'professors' ? '#3b82f6' : 'rgba(255, 255, 255, 0.08)',
              color: '#ffffff',
              transition: 'all 0.2s ease',
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
          marginBottom: '20px',
          flexWrap: 'wrap',
        }}
      >
        <div style={{ flex: 1, minWidth: '220px' }}>
          <input
            type="text"
            placeholder={
              activeTab === 'courses'
                ? 'Search course code or title (e.g. CS201)...'
                : 'Search professor by name...'
            }
            value={search}
            onChange={(e) => setSearch(e.target.value)}
            style={{
              width: '100%',
              padding: '10px 14px',
              borderRadius: '10px',
              background: 'rgba(15, 23, 42, 0.6)',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              color: '#f8fafc',
              fontSize: '14px',
              outline: 'none',
            }}
          />
        </div>

        <select
          value={department}
          onChange={(e) => setDepartment(e.target.value)}
          style={{
            padding: '10px 14px',
            borderRadius: '10px',
            background: 'rgba(15, 23, 42, 0.8)',
            border: '1px solid rgba(255, 255, 255, 0.1)',
            color: '#f8fafc',
            fontSize: '14px',
            outline: 'none',
            cursor: 'pointer',
          }}
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
        <div style={{ textAlign: 'center', padding: '40px', color: '#94a3b8' }}>
          Loading {activeTab}...
        </div>
      ) : error ? (
        <div style={{ textAlign: 'center', padding: '30px', color: '#ef4444' }}>{error}</div>
      ) : items.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '40px',
            background: 'rgba(255, 255, 255, 0.02)',
            borderRadius: '12px',
            border: '1px dashed rgba(255, 255, 255, 0.1)',
            color: '#94a3b8',
          }}
        >
          No {activeTab} found matching your query.
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
              onClick={() => handleOpenDetail(item, activeTab === 'courses' ? 'course' : 'professor')}
              style={{
                background: 'rgba(30, 41, 59, 0.4)',
                border: '1px solid rgba(255, 255, 255, 0.06)',
                borderRadius: '12px',
                padding: '16px',
                cursor: 'pointer',
                transition: 'transform 0.15s ease, border-color 0.15s ease',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.transform = 'translateY(-2px)';
                e.currentTarget.style.borderColor = 'rgba(59, 130, 246, 0.4)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.transform = 'translateY(0)';
                e.currentTarget.style.borderColor = 'rgba(255, 255, 255, 0.06)';
              }}
            >
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  alignItems: 'flex-start',
                  marginBottom: '8px',
                }}
              >
                <div>
                  <span
                    style={{
                      display: 'inline-block',
                      padding: '2px 8px',
                      borderRadius: '4px',
                      background: 'rgba(59, 130, 246, 0.2)',
                      color: '#60a5fa',
                      fontSize: '12px',
                      fontWeight: '700',
                      marginBottom: '6px',
                    }}
                  >
                    {activeTab === 'courses' ? item.code : item.department}
                  </span>
                  <h3 style={{ margin: 0, fontSize: '16px', color: '#f8fafc', fontWeight: '600' }}>
                    {item.name}
                  </h3>
                </div>

                <div
                  style={{
                    padding: '4px 10px',
                    borderRadius: '8px',
                    background: getRatingBadgeColor(item.avgRating),
                    color: '#ffffff',
                    fontWeight: '700',
                    fontSize: '14px',
                    display: 'flex',
                    alignItems: 'center',
                    gap: '4px',
                  }}
                >
                  ⭐ {item.avgRating > 0 ? item.avgRating.toFixed(1) : 'N/A'}
                </div>
              </div>

              <div
                style={{
                  display: 'flex',
                  justifyContent: 'space-between',
                  color: '#94a3b8',
                  fontSize: '13px',
                  marginTop: '12px',
                  borderTop: '1px solid rgba(255, 255, 255, 0.06)',
                  paddingTop: '8px',
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
          style={{
            position: 'fixed',
            inset: 0,
            background: 'rgba(0, 0, 0, 0.75)',
            backdropFilter: 'blur(6px)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
          onClick={handleCloseDetail}
        >
          <div
            style={{
              background: '#0f172a',
              border: '1px solid rgba(255, 255, 255, 0.1)',
              borderRadius: '16px',
              maxWidth: '720px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              position: 'relative',
              boxShadow: '0 20px 50px rgba(0, 0, 0, 0.5)',
            }}
            onClick={(e) => e.stopPropagation()}
          >
            {/* Close button */}
            <button
              type="button"
              onClick={handleCloseDetail}
              style={{
                position: 'absolute',
                top: '16px',
                right: '16px',
                background: 'rgba(255, 255, 255, 0.05)',
                border: 'none',
                color: '#94a3b8',
                cursor: 'pointer',
                borderRadius: '50%',
                width: '32px',
                height: '32px',
                fontSize: '16px',
              }}
            >
              ✕
            </button>

            {/* Target Header */}
            <div style={{ marginBottom: '20px' }}>
              <span
                style={{
                  display: 'inline-block',
                  padding: '2px 8px',
                  borderRadius: '4px',
                  background: 'rgba(59, 130, 246, 0.2)',
                  color: '#60a5fa',
                  fontSize: '12px',
                  fontWeight: '700',
                  marginBottom: '4px',
                }}
              >
                {targetType === 'course' ? selectedTarget.code : selectedTarget.title || 'Professor'}
              </span>
              <h2 style={{ margin: '4px 0', fontSize: '22px', color: '#f8fafc' }}>
                {selectedTarget.name}
              </h2>
              <p style={{ margin: 0, color: '#94a3b8', fontSize: '14px' }}>
                {selectedTarget.department} {selectedTarget.credits ? `• ${selectedTarget.credits} Credits` : ''}
              </p>
            </div>

            {/* Stats Row */}
            <div
              style={{
                display: 'grid',
                gridTemplateColumns: 'repeat(auto-fit, minmax(120px, 1fr))',
                gap: '12px',
                background: 'rgba(30, 41, 59, 0.4)',
                padding: '16px',
                borderRadius: '12px',
                marginBottom: '20px',
              }}
            >
              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#10b981' }}>
                  ⭐ {selectedTarget.avgRating > 0 ? selectedTarget.avgRating.toFixed(1) : 'N/A'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Overall Rating</div>
              </div>

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#f59e0b' }}>
                  {selectedTarget.avgDifficulty > 0 ? `${selectedTarget.avgDifficulty.toFixed(1)}/5` : 'N/A'}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Difficulty</div>
              </div>

              {targetType === 'professor' && (
                <div style={{ textAlign: 'center' }}>
                  <div style={{ fontSize: '20px', fontWeight: '700', color: '#38bdf8' }}>
                    {selectedTarget.wouldTakeAgainPercent || 0}%
                  </div>
                  <div style={{ fontSize: '12px', color: '#94a3b8' }}>Would Take Again</div>
                </div>
              )}

              <div style={{ textAlign: 'center' }}>
                <div style={{ fontSize: '20px', fontWeight: '700', color: '#cbd5e1' }}>
                  {selectedTarget.reviewsCount || 0}
                </div>
                <div style={{ fontSize: '12px', color: '#94a3b8' }}>Total Reviews</div>
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
              <h3 style={{ margin: 0, fontSize: '18px', color: '#f8fafc' }}>
                Student Reviews ({reviews.length})
              </h3>

              {isAuthenticated && (
                <button
                  type="button"
                  onClick={() => setIsReviewModalOpen(true)}
                  style={{
                    padding: '8px 16px',
                    borderRadius: '8px',
                    background: '#3b82f6',
                    color: '#ffffff',
                    border: 'none',
                    fontWeight: '600',
                    cursor: 'pointer',
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
                style={{
                  background: 'rgba(30, 41, 59, 0.6)',
                  border: '1px solid rgba(59, 130, 246, 0.3)',
                  borderRadius: '12px',
                  padding: '16px',
                  marginBottom: '20px',
                }}
              >
                <h4 style={{ margin: '0 0 12px', color: '#60a5fa', fontSize: '15px' }}>
                  Submit Your Review for {selectedTarget.name}
                </h4>

                {reviewError && (
                  <div
                    style={{
                      background: 'rgba(239, 68, 68, 0.1)',
                      border: '1px solid rgba(239, 68, 68, 0.3)',
                      color: '#f87171',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      fontSize: '13px',
                      marginBottom: '12px',
                    }}
                  >
                    {reviewError}
                  </div>
                )}

                <div style={{ display: 'flex', gap: '16px', flexWrap: 'wrap', marginBottom: '12px' }}>
                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                      Rating (1-5)
                    </label>
                    <select
                      value={rating}
                      onChange={(e) => setRating(Number(e.target.value))}
                      style={{ padding: '6px 10px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #334155' }}
                    >
                      <option value={5}>⭐⭐⭐⭐⭐ (5 - Awesome)</option>
                      <option value={4}>⭐⭐⭐⭐ (4 - Great)</option>
                      <option value={3}>⭐⭐⭐ (3 - Average)</option>
                      <option value={2}>⭐⭐ (2 - Below Avg)</option>
                      <option value={1}>⭐ (1 - Awful)</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                      Difficulty (1-5)
                    </label>
                    <select
                      value={difficulty}
                      onChange={(e) => setDifficulty(Number(e.target.value))}
                      style={{ padding: '6px 10px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #334155' }}
                    >
                      <option value={1}>1 - Very Easy</option>
                      <option value={2}>2 - Easy</option>
                      <option value={3}>3 - Medium</option>
                      <option value={4}>4 - Hard</option>
                      <option value={5}>5 - Extremely Hard</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                      Would Take Again?
                    </label>
                    <select
                      value={wouldTakeAgain ? 'yes' : 'no'}
                      onChange={(e) => setWouldTakeAgain(e.target.value === 'yes')}
                      style={{ padding: '6px 10px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #334155' }}
                    >
                      <option value="yes">Yes</option>
                      <option value="no">No</option>
                    </select>
                  </div>

                  <div>
                    <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '4px' }}>
                      Grade Received
                    </label>
                    <select
                      value={grade}
                      onChange={(e) => setGrade(e.target.value)}
                      style={{ padding: '6px 10px', borderRadius: '6px', background: '#1e293b', color: '#fff', border: '1px solid #334155' }}
                    >
                      {['A+', 'A', 'A-', 'B+', 'B', 'B-', 'C+', 'C', 'C-', 'D', 'F', 'Pass', 'Audit', 'N/A'].map((g) => (
                        <option key={g} value={g}>{g}</option>
                      ))}
                    </select>
                  </div>
                </div>

                {/* Tags selector */}
                <div style={{ marginBottom: '12px' }}>
                  <label style={{ display: 'block', fontSize: '12px', color: '#94a3b8', marginBottom: '6px' }}>
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
                            border: isSelected ? '1px solid #3b82f6' : '1px solid rgba(255, 255, 255, 0.1)',
                            background: isSelected ? 'rgba(59, 130, 246, 0.3)' : 'rgba(255, 255, 255, 0.05)',
                            color: isSelected ? '#60a5fa' : '#94a3b8',
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
                <div style={{ marginBottom: '12px' }}>
                  <textarea
                    rows={4}
                    placeholder="Share your experience: coursework, exam expectations, workload, tips for future students..."
                    value={reviewContent}
                    onChange={(e) => setReviewContent(e.target.value)}
                    style={{
                      width: '100%',
                      padding: '10px',
                      borderRadius: '8px',
                      background: '#1e293b',
                      border: '1px solid #334155',
                      color: '#f8fafc',
                      fontSize: '13px',
                      resize: 'vertical',
                      outline: 'none',
                    }}
                  />
                </div>

                {/* Anonymity Toggle */}
                <div
                  style={{
                    display: 'flex',
                    alignItems: 'center',
                    gap: '8px',
                    padding: '8px 12px',
                    background: isAnonymous ? 'rgba(147, 51, 234, 0.15)' : 'rgba(255, 255, 255, 0.03)',
                    border: isAnonymous ? '1px solid rgba(147, 51, 234, 0.3)' : '1px solid rgba(255, 255, 255, 0.06)',
                    borderRadius: '8px',
                    marginBottom: '14px',
                  }}
                >
                  <input
                    type="checkbox"
                    id="anonReviewToggle"
                    checked={isAnonymous}
                    onChange={(e) => setIsAnonymous(e.target.checked)}
                    style={{ cursor: 'pointer' }}
                  />
                  <label htmlFor="anonReviewToggle" style={{ fontSize: '13px', color: isAnonymous ? '#c084fc' : '#cbd5e1', cursor: 'pointer' }}>
                    👻 <strong>Submit review anonymously</strong> (Your username and profile will be completely hidden with a pseudonymous alias)
                  </label>
                </div>

                <div style={{ display: 'flex', gap: '8px', justifyContent: 'flex-end' }}>
                  <button
                    type="button"
                    onClick={() => setIsReviewModalOpen(false)}
                    style={{
                      padding: '8px 16px',
                      borderRadius: '6px',
                      background: 'transparent',
                      border: '1px solid rgba(255, 255, 255, 0.1)',
                      color: '#94a3b8',
                      cursor: 'pointer',
                    }}
                  >
                    Cancel
                  </button>
                  <button
                    type="submit"
                    disabled={submittingReview}
                    style={{
                      padding: '8px 18px',
                      borderRadius: '6px',
                      background: isAnonymous ? 'linear-gradient(135deg, #7c3aed, #9333ea)' : '#3b82f6',
                      border: 'none',
                      color: '#ffffff',
                      fontWeight: '600',
                      cursor: submittingReview ? 'not-allowed' : 'pointer',
                    }}
                  >
                    {submittingReview ? 'Submitting...' : isAnonymous ? '👻 Post Anonymously' : 'Submit Review'}
                  </button>
                </div>
              </form>
            )}

            {/* Reviews List */}
            {loadingDetail ? (
              <div style={{ textAlign: 'center', padding: '20px', color: '#94a3b8' }}>
                Loading reviews...
              </div>
            ) : reviews.length === 0 ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '30px',
                  background: 'rgba(255, 255, 255, 0.02)',
                  borderRadius: '12px',
                  color: '#94a3b8',
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
                      style={{
                        background: 'rgba(30, 41, 59, 0.4)',
                        border: '1px solid rgba(255, 255, 255, 0.06)',
                        borderRadius: '12px',
                        padding: '16px',
                      }}
                    >
                      <div
                        style={{
                          display: 'flex',
                          justifyContent: 'space-between',
                          alignItems: 'center',
                          marginBottom: '8px',
                        }}
                      >
                        <div style={{ display: 'flex', alignItems: 'center', gap: '8px' }}>
                          <span style={{ fontSize: '14px', fontWeight: '600', color: author.isAnonymous ? '#c084fc' : '#60a5fa' }}>
                            {author.isAnonymous ? `👻 ${author.alias || 'Anonymous'}` : author.username || 'Student'}
                          </span>
                          {author.isMine && (
                            <span style={{ fontSize: '11px', background: 'rgba(16, 185, 129, 0.2)', color: '#34d399', padding: '1px 6px', borderRadius: '4px' }}>
                              you
                            </span>
                          )}
                          <span style={{ fontSize: '12px', color: '#64748b' }}>
                            • {new Date(rev.createdAt).toLocaleDateString()}
                          </span>
                        </div>

                        <div style={{ display: 'flex', gap: '6px' }}>
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
                              color: '#cbd5e1',
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
                                background: 'rgba(59, 130, 246, 0.2)',
                                color: '#93c5fd',
                                fontSize: '12px',
                              }}
                            >
                              Grade: {rev.grade}
                            </span>
                          )}
                        </div>
                      </div>

                      <p style={{ margin: '8px 0', color: '#e2e8f0', fontSize: '14px', lineHeight: '1.5' }}>
                        {rev.content}
                      </p>

                      {rev.tags && rev.tags.length > 0 && (
                        <div style={{ display: 'flex', gap: '6px', flexWrap: 'wrap', margin: '8px 0' }}>
                          {rev.tags.map((t) => (
                            <span
                              key={t}
                              style={{
                                fontSize: '11px',
                                background: 'rgba(255, 255, 255, 0.05)',
                                color: '#94a3b8',
                                padding: '2px 8px',
                                borderRadius: '12px',
                              }}
                            >
                              #{t}
                            </span>
                          ))}
                        </div>
                      )}

                      <div style={{ display: 'flex', gap: '12px', marginTop: '8px', alignItems: 'center' }}>
                        <button
                          type="button"
                          onClick={() => handleVoteReview(rev._id, 'helpful')}
                          style={{
                            background: 'transparent',
                            border: '1px solid rgba(255, 255, 255, 0.1)',
                            borderRadius: '6px',
                            color: '#94a3b8',
                            fontSize: '12px',
                            padding: '4px 10px',
                            cursor: 'pointer',
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
