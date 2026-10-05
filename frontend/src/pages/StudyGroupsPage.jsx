import { useState, useEffect, useCallback } from 'react';
import { useNavigate, Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getStudyGroups,
  createStudyGroup,
  joinStudyGroup,
  leaveStudyGroup,
  deleteStudyGroup,
} from '../api/studyGroupApi';

const MEETING_TYPES = [
  { id: '', label: 'All Formats' },
  { id: 'in_person', label: '🏢 In-Person' },
  { id: 'virtual', label: '💻 Virtual' },
  { id: 'hybrid', label: '🌐 Hybrid' },
];

export const StudyGroupsPage = () => {
  const { user, isAuthenticated } = useAuth();
  const navigate = useNavigate();

  const [groups, setGroups] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [selectedMeetingType, setSelectedMeetingType] = useState('');
  const [selectedCourse, setSelectedCourse] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);

  // Creation Modal State
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [description, setDescription] = useState('');
  const [courseCode, setCourseCode] = useState('');
  const [topic, setTopic] = useState('');
  const [maxMembers, setMaxMembers] = useState(10);
  const [meetingSchedule, setMeetingSchedule] = useState('');
  const [meetingType, setMeetingType] = useState('in_person');
  const [location, setLocation] = useState('');
  const [meetingLink, setMeetingLink] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');

  const fetchGroupsList = useCallback(async () => {
    setLoading(true);
    setError('');
    try {
      const data = await getStudyGroups({
        search: search.trim() || undefined,
        meetingType: selectedMeetingType || undefined,
        courseCode: selectedCourse.trim() || undefined,
        page,
        limit: 15,
      });

      setGroups(data.groups || []);
      setTotalPages(data.pagination?.pages || 1);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load study groups');
    } finally {
      setLoading(false);
    }
  }, [search, selectedMeetingType, selectedCourse, page]);

  useEffect(() => {
    fetchGroupsList();
  }, [fetchGroupsList]);

  const handleJoin = async (group) => {
    if (!isAuthenticated) {
      alert('Please log in to join study groups.');
      return;
    }
    try {
      await joinStudyGroup(group._id);
      // Optimistically update group state
      setGroups((prev) =>
        prev.map((g) =>
          g._id === group._id
            ? { ...g, isMember: true, memberCount: (g.memberCount || 0) + 1 }
            : g
        )
      );
    } catch (err) {
      alert(`Join failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleLeave = async (group) => {
    if (!window.confirm(`Leave study group "${group.name}"?`)) return;
    try {
      await leaveStudyGroup(group._id);
      setGroups((prev) =>
        prev.map((g) =>
          g._id === group._id
            ? { ...g, isMember: false, memberCount: Math.max(0, (g.memberCount || 1) - 1) }
            : g
        )
      );
    } catch (err) {
      alert(`Leave failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleDelete = async (groupId) => {
    if (!window.confirm('Are you sure you want to delete this study group?')) return;
    try {
      await deleteStudyGroup(groupId);
      setGroups((prev) => prev.filter((g) => g._id !== groupId));
    } catch (err) {
      alert(`Delete failed: ${err.response?.data?.message || err.message}`);
    }
  };

  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    if (!name.trim()) {
      setModalError('Group name is required.');
      return;
    }

    setIsSubmitting(true);
    setModalError('');

    try {
      const res = await createStudyGroup({
        name: name.trim(),
        description: description.trim(),
        courseCode: courseCode.trim().toUpperCase(),
        topic: topic.trim(),
        maxMembers: Number(maxMembers) || 10,
        meetingSchedule: meetingSchedule.trim(),
        meetingType,
        location: location.trim(),
        meetingLink: meetingLink.trim(),
      });

      setIsModalOpen(false);
      // Reset form
      setName('');
      setDescription('');
      setCourseCode('');
      setTopic('');
      setMaxMembers(10);
      setMeetingSchedule('');
      setMeetingType('in_person');
      setLocation('');
      setMeetingLink('');

      // Refresh list
      fetchGroupsList();

      // If conversation created, offer to jump into group chat
      if (res?.group?.conversation) {
        if (window.confirm('Study group created! Open group chat now?')) {
          navigate(`/chat/${res.group.conversation}`);
        }
      }
    } catch (err) {
      setModalError(err.response?.data?.message || err.message || 'Creation failed');
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={{ maxWidth: '960px', margin: '0 auto', padding: '16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          flexWrap: 'wrap',
          gap: '12px',
          borderBottom: '1px solid var(--glass-border)',
          paddingBottom: '16px',
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: '800', margin: '0 0 6px 0', color: 'var(--text-primary)' }}>
            👥 Campus Study Groups
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Form midterm prep pods, homework cohorts, and collaborative study sessions with peers.
          </p>
        </div>

        {isAuthenticated && (
          <button
            type="button"
            className="btn-accent"
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '9px 18px',
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
            }}
          >
            <span>+</span> Create Study Group
          </button>
        )}
      </div>

      {/* Filter Bar */}
      <div
        style={{
          display: 'flex',
          gap: '10px',
          marginBottom: '16px',
          flexWrap: 'wrap',
          alignItems: 'center',
        }}
      >
        <input
          type="text"
          className="glass-input-field"
          placeholder="Search by topic, group name, or subject..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{ flex: '1 1 200px' }}
        />

        <input
          type="text"
          className="glass-input-field"
          placeholder="Course code (e.g. CS201)..."
          value={selectedCourse}
          onChange={(e) => {
            setSelectedCourse(e.target.value);
            setPage(1);
          }}
          style={{ width: '180px', textTransform: 'uppercase' }}
        />
      </div>

      {/* Format Filter Pills */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '8px',
          marginBottom: '20px',
        }}
      >
        {MEETING_TYPES.map((fmt) => (
          <button
            key={fmt.id}
            type="button"
            onClick={() => {
              setSelectedMeetingType(fmt.id);
              setPage(1);
            }}
            style={{
              padding: '6px 14px',
              borderRadius: '20px',
              fontSize: '13px',
              fontWeight: 500,
              whiteSpace: 'nowrap',
              border: selectedMeetingType === fmt.id ? '1px solid var(--accent)' : '1px solid var(--glass-border)',
              backgroundColor: selectedMeetingType === fmt.id ? 'rgba(139, 147, 255, 0.22)' : 'rgba(255, 255, 255, 0.05)',
              color: selectedMeetingType === fmt.id ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: selectedMeetingType === fmt.id ? '0 0 12px rgba(139, 147, 255, 0.25)' : 'none',
              cursor: 'pointer',
              transition: 'all 0.15s ease',
            }}
          >
            {fmt.label}
          </button>
        ))}
      </div>

      {/* Error state */}
      {error && (
        <div
          style={{
            padding: '12px 16px',
            backgroundColor: 'rgba(239, 68, 68, 0.15)',
            border: '1px solid rgba(239, 68, 68, 0.3)',
            color: '#fca5a5',
            borderRadius: 'var(--radius-ctl)',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: 'var(--text-secondary)' }}>
          Loading study groups...
        </div>
      ) : groups.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: 'var(--glass-bg)',
            borderRadius: 'var(--radius-card)',
            border: '1px dashed var(--glass-border)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', color: 'var(--text-primary)' }}>
            No study groups found
          </h3>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Start a study squad for your upcoming classes and invite peers!
          </p>
        </div>
      ) : (
        /* Groups List */
        <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
          {groups.map((grp) => {
            const isOwner =
              user &&
              grp.creator &&
              (user._id === (grp.creator._id || grp.creator) || grp.isCreator);
            const isAdmin = user && user.role === 'admin';
            const isFull = (grp.memberCount || 0) >= (grp.maxMembers || 20);

            const formatMeetingType = (type) => {
              switch (type) {
                case 'virtual':
                  return '💻 Virtual';
                case 'hybrid':
                  return '🌐 Hybrid';
                default:
                  return '🏢 In-Person';
              }
            };

            return (
              <div
                key={grp._id}
                className="glass-panel-card"
                style={{
                  padding: '20px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '14px',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '14px',
                  }}
                >
                  <div style={{ flex: 1 }}>
                    <div
                      style={{
                        display: 'flex',
                        alignItems: 'center',
                        gap: '8px',
                        marginBottom: '6px',
                        flexWrap: 'wrap',
                      }}
                    >
                      {grp.courseCode && (
                        <span className="glass-tag-course">
                          {grp.courseCode}
                        </span>
                      )}
                      <span className="glass-tag-badge">
                        {formatMeetingType(grp.meetingType)}
                      </span>
                      {grp.topic && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 600,
                            padding: '3px 8px',
                            borderRadius: '6px',
                            backgroundColor: 'rgba(245, 158, 11, 0.15)',
                            border: '1px solid rgba(245, 158, 11, 0.3)',
                            color: '#fbbf24',
                          }}
                        >
                          🎯 {grp.topic}
                        </span>
                      )}
                    </div>

                    <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', fontWeight: 700, color: 'var(--text-primary)' }}>
                      {grp.name}
                    </h3>

                    {grp.description && (
                      <p
                        style={{
                          margin: '0 0 10px 0',
                          fontSize: '13.5px',
                          color: 'var(--text-secondary)',
                          lineHeight: '1.5',
                        }}
                      >
                        {grp.description}
                      </p>
                    )}

                    {/* Schedule and Location */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection: 'column',
                        gap: '6px',
                        fontSize: '13px',
                        color: 'var(--text-secondary)',
                      }}
                    >
                      {grp.meetingSchedule && (
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>📅 Schedule:</strong> {grp.meetingSchedule}
                        </div>
                      )}
                      {grp.location && (
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>📍 Location:</strong> {grp.location}
                        </div>
                      )}
                      {grp.meetingLink && grp.isMember && (
                        <div>
                          <strong style={{ color: 'var(--text-primary)' }}>🔗 Meeting Link:</strong>{' '}
                          <a
                            href={grp.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: 'var(--accent)', textDecoration: 'underline' }}
                          >
                            {grp.meetingLink}
                          </a>
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Actions Column */}
                  <div
                    style={{
                      display: 'flex',
                      flexDirection: 'column',
                      alignItems: 'flex-end',
                      gap: '10px',
                    }}
                  >
                    {/* Capacity badge */}
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: isFull ? '#f87171' : 'var(--accent)',
                        backgroundColor: isFull ? 'rgba(239, 68, 68, 0.15)' : 'rgba(139, 147, 255, 0.12)',
                        border: isFull ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(139, 147, 255, 0.25)',
                        padding: '3px 10px',
                        borderRadius: 'var(--radius-pill)',
                      }}
                    >
                      👥 {grp.memberCount || 0} / {grp.maxMembers || 20} members
                    </span>

                    {/* Join / Leave / Chat Buttons */}
                    {grp.isMember ? (
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {grp.conversation && (
                          <button
                            type="button"
                            onClick={() => navigate(`/chat/${grp.conversation}`)}
                            style={{
                              padding: '6px 14px',
                              backgroundColor: 'rgba(52, 211, 153, 0.2)',
                              border: '1px solid rgba(52, 211, 153, 0.4)',
                              color: '#34d399',
                              borderRadius: 'var(--radius-ctl)',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '6px',
                            }}
                          >
                            💬 Group Chat
                          </button>
                        )}
                        <button
                          type="button"
                          className="btn-secondary"
                          onClick={() => handleLeave(grp)}
                          style={{
                            padding: '6px 12px',
                            fontSize: '13px',
                          }}
                        >
                          Leave
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        className="btn-accent"
                        onClick={() => handleJoin(grp)}
                        disabled={isFull || !isAuthenticated}
                        style={{
                          padding: '7px 18px',
                          fontSize: '13px',
                          opacity: isFull ? 0.6 : 1,
                          cursor: isFull ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isFull ? 'Group Full' : 'Join Squad'}
                      </button>
                    )}

                    {(isOwner || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(grp._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#f87171',
                          cursor: 'pointer',
                          fontSize: '12px',
                          padding: '2px 6px',
                        }}
                      >
                        Delete Group
                      </button>
                    )}
                  </div>
                </div>

                {/* Footer Creator Details */}
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'center',
                    borderTop: '1px solid var(--glass-border)',
                    paddingTop: '10px',
                    fontSize: '12px',
                    color: 'var(--text-muted)',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Organized by</span>
                    <Link
                      to={`/u/${grp.creator?.username?.replace('u/', '') || 'deleted'}`}
                      style={{ color: 'var(--accent)', textDecoration: 'none', fontWeight: 600 }}
                    >
                      {grp.creator?.username || '[deleted]'}
                    </Link>
                    <span>• Started {new Date(grp.createdAt).toLocaleDateString()}</span>
                  </div>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Pagination */}
      {totalPages > 1 && (
        <div
          style={{
            display: 'flex',
            justifyContent: 'center',
            alignItems: 'center',
            gap: '12px',
            marginTop: '24px',
          }}
        >
          <button
            type="button"
            className="btn-secondary"
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
          >
            Previous
          </button>
          <span style={{ fontSize: '13px', color: 'var(--text-secondary)' }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            className="btn-secondary"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
          >
            Next
          </button>
        </div>
      )}

      {/* Create Study Group Modal */}
      {isModalOpen && (
        <div className="glass-modal-overlay" onClick={() => setIsModalOpen(false)}>
          <div className="glass-modal-dialog" onClick={(e) => e.stopPropagation()}>
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '18px',
                borderBottom: '1px solid var(--glass-border)',
                paddingBottom: '12px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '18px', color: 'var(--text-primary)', fontWeight: 700 }}>
                Create Study Group
              </h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  color: 'var(--text-muted)',
                  cursor: 'pointer',
                  padding: '4px',
                }}
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: 'rgba(239, 68, 68, 0.15)',
                  border: '1px solid rgba(239, 68, 68, 0.3)',
                  color: '#fca5a5',
                  borderRadius: 'var(--radius-ctl)',
                  marginBottom: '14px',
                  fontSize: '13px',
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  className="glass-input-field"
                  placeholder="e.g. CS201 Algorithms Midterm Squad"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                />
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Course Code
                  </label>
                  <input
                    type="text"
                    className="glass-input-field"
                    placeholder="e.g. CS201"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                  />
                </div>

                <div style={{ flex: '1 1 180px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Focus Topic
                  </label>
                  <input
                    type="text"
                    className="glass-input-field"
                    placeholder="e.g. Dynamic Programming"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '12px', marginBottom: '14px', flexWrap: 'wrap' }}>
                <div style={{ flex: '1 1 180px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Meeting Format
                  </label>
                  <select
                    className="glass-input-field"
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value)}
                    style={{ cursor: 'pointer' }}
                  >
                    <option value="in_person">In-Person</option>
                    <option value="virtual">Virtual</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>

                <div style={{ flex: '1 1 180px' }}>
                  <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                    Max Members
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    className="glass-input-field"
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(e.target.value)}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Schedule
                </label>
                <input
                  type="text"
                  className="glass-input-field"
                  placeholder="e.g. Tuesdays & Thursdays at 6 PM"
                  value={meetingSchedule}
                  onChange={(e) => setMeetingSchedule(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '14px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Location / Meeting Link
                </label>
                <input
                  type="text"
                  className="glass-input-field"
                  placeholder="e.g. Science Library Room 204 or Zoom link"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '12.5px', fontWeight: 600, marginBottom: '6px', color: 'var(--text-secondary)' }}>
                  Description
                </label>
                <textarea
                  rows="3"
                  className="glass-input-field"
                  placeholder="What goals, prerequisites, or topics will this group focus on?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ resize: 'vertical' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '10px' }}>
                <button
                  type="button"
                  className="btn-secondary"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-accent"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 20px',
                    cursor: isSubmitting ? 'not-allowed' : 'pointer',
                  }}
                >
                  {isSubmitting ? 'Creating...' : 'Create & Open Chat'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};

export default StudyGroupsPage;
