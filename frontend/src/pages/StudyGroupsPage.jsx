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
        }}
      >
        <div>
          <h1 style={{ fontSize: '24px', fontWeight: 'bold', margin: '0 0 4px 0' }}>
            👥 Campus Study Groups
          </h1>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            Form midterm prep pods, homework cohorts, and collaborative study sessions with peers.
          </p>
        </div>

        {isAuthenticated && (
          <button
            type="button"
            onClick={() => setIsModalOpen(true)}
            style={{
              padding: '9px 18px',
              backgroundColor: '#1d4ed8',
              color: '#ffffff',
              borderRadius: '6px',
              border: 'none',
              fontWeight: 600,
              fontSize: '14px',
              cursor: 'pointer',
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
          placeholder="Search by topic, group name, or subject..."
          value={search}
          onChange={(e) => {
            setSearch(e.target.value);
            setPage(1);
          }}
          style={{
            flex: '1 1 200px',
            padding: '8px 14px',
            borderRadius: '6px',
            border: '1px solid #dcdcdc',
            fontSize: '14px',
          }}
        />

        <input
          type="text"
          placeholder="Course code (e.g. CS201)..."
          value={selectedCourse}
          onChange={(e) => {
            setSelectedCourse(e.target.value);
            setPage(1);
          }}
          style={{
            width: '180px',
            padding: '8px 12px',
            borderRadius: '6px',
            border: '1px solid #dcdcdc',
            fontSize: '14px',
            textTransform: 'uppercase',
          }}
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
              border: selectedMeetingType === fmt.id ? '1px solid #1d4ed8' : '1px solid #e0dfdb',
              backgroundColor: selectedMeetingType === fmt.id ? '#eff6ff' : '#ffffff',
              color: selectedMeetingType === fmt.id ? '#1d4ed8' : '#4b5563',
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
            padding: '12px',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: '6px',
            marginBottom: '16px',
          }}
        >
          {error}
        </div>
      )}

      {/* Loading state */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '40px 0', color: '#666' }}>
          Loading study groups...
        </div>
      ) : groups.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            backgroundColor: '#faf9f6',
            borderRadius: '8px',
            border: '1px dashed #dcdcdc',
          }}
        >
          <div style={{ fontSize: '32px', marginBottom: '8px' }}>👥</div>
          <h3 style={{ margin: '0 0 6px 0', fontSize: '17px', color: '#1a1a1b' }}>
            No study groups found
          </h3>
          <p style={{ margin: 0, color: '#777', fontSize: '14px' }}>
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
                style={{
                  backgroundColor: '#ffffff',
                  borderRadius: '8px',
                  border: '1px solid #e5e5e5',
                  padding: '18px',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: '12px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                }}
              >
                <div
                  style={{
                    display: 'flex',
                    justifyContent: 'space-between',
                    alignItems: 'flex-start',
                    gap: '12px',
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
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 700,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#e0e7ff',
                            color: '#3730a3',
                          }}
                        >
                          {grp.courseCode}
                        </span>
                      )}
                      <span
                        style={{
                          fontSize: '11px',
                          fontWeight: 600,
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: '#f3f4f6',
                          color: '#4b5563',
                        }}
                      >
                        {formatMeetingType(grp.meetingType)}
                      </span>
                      {grp.topic && (
                        <span
                          style={{
                            fontSize: '11px',
                            fontWeight: 500,
                            padding: '2px 8px',
                            borderRadius: '4px',
                            backgroundColor: '#fef3c7',
                            color: '#92400e',
                          }}
                        >
                          🎯 {grp.topic}
                        </span>
                      )}
                    </div>

                    <h3 style={{ margin: '0 0 6px 0', fontSize: '18px', color: '#111827' }}>
                      {grp.name}
                    </h3>

                    {grp.description && (
                      <p
                        style={{
                          margin: '0 0 10px 0',
                          fontSize: '13px',
                          color: '#4b5563',
                          lineHeight: '1.4',
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
                        gap: '4px',
                        fontSize: '13px',
                        color: '#4b5563',
                      }}
                    >
                      {grp.meetingSchedule && (
                        <div>
                          <strong>📅 Schedule:</strong> {grp.meetingSchedule}
                        </div>
                      )}
                      {grp.location && (
                        <div>
                          <strong>📍 Location:</strong> {grp.location}
                        </div>
                      )}
                      {grp.meetingLink && grp.isMember && (
                        <div>
                          <strong>🔗 Meeting Link:</strong>{' '}
                          <a
                            href={grp.meetingLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            style={{ color: '#2563eb' }}
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
                      gap: '8px',
                    }}
                  >
                    {/* Capacity badge */}
                    <span
                      style={{
                        fontSize: '12px',
                        fontWeight: 600,
                        color: isFull ? '#dc2626' : '#2563eb',
                        backgroundColor: isFull ? '#fee2e2' : '#eff6ff',
                        padding: '3px 8px',
                        borderRadius: '12px',
                      }}
                    >
                      👥 {grp.memberCount || 0} / {grp.maxMembers || 20} members
                    </span>

                    {/* Join / Leave / Chat Buttons */}
                    {grp.isMember ? (
                      <div style={{ display: 'flex', gap: '6px', alignItems: 'center' }}>
                        {grp.conversation && (
                          <button
                            type="button"
                            onClick={() => navigate(`/chat/${grp.conversation}`)}
                            style={{
                              padding: '6px 12px',
                              backgroundColor: '#10b981',
                              color: '#fff',
                              border: 'none',
                              borderRadius: '6px',
                              fontSize: '13px',
                              fontWeight: 600,
                              cursor: 'pointer',
                              display: 'flex',
                              alignItems: 'center',
                              gap: '4px',
                            }}
                          >
                            <span>💬</span> Group Chat
                          </button>
                        )}
                        <button
                          type="button"
                          onClick={() => handleLeave(grp)}
                          style={{
                            padding: '6px 12px',
                            backgroundColor: '#fff',
                            color: '#6b7280',
                            border: '1px solid #d1d5db',
                            borderRadius: '6px',
                            fontSize: '13px',
                            cursor: 'pointer',
                          }}
                        >
                          Leave
                        </button>
                      </div>
                    ) : (
                      <button
                        type="button"
                        onClick={() => handleJoin(grp)}
                        disabled={isFull}
                        style={{
                          padding: '6px 16px',
                          backgroundColor: isFull ? '#9ca3af' : '#1d4ed8',
                          color: '#fff',
                          border: 'none',
                          borderRadius: '6px',
                          fontSize: '13px',
                          fontWeight: 600,
                          cursor: isFull ? 'not-allowed' : 'pointer',
                        }}
                      >
                        {isFull ? 'Group Full' : 'Join Group'}
                      </button>
                    )}

                    {(isOwner || isAdmin) && (
                      <button
                        type="button"
                        onClick={() => handleDelete(grp._id)}
                        style={{
                          background: 'none',
                          border: 'none',
                          color: '#dc2626',
                          cursor: 'pointer',
                          fontSize: '12px',
                          padding: '2px 4px',
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
                    borderTop: '1px solid #f3f4f6',
                    paddingTop: '8px',
                    fontSize: '12px',
                    color: '#6b7280',
                  }}
                >
                  <div style={{ display: 'flex', alignItems: 'center', gap: '6px' }}>
                    <span>Organized by</span>
                    <Link
                      to={`/u/${grp.creator?.username?.replace('u/', '') || 'deleted'}`}
                      style={{ color: '#2563eb', textDecoration: 'none', fontWeight: 500 }}
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
            disabled={page <= 1}
            onClick={() => setPage((p) => Math.max(1, p - 1))}
            style={{
              padding: '6px 14px',
              border: '1px solid #dcdcdc',
              background: '#fff',
              borderRadius: '4px',
              cursor: page <= 1 ? 'not-allowed' : 'pointer',
            }}
          >
            Previous
          </button>
          <span style={{ fontSize: '13px', color: '#666' }}>
            Page {page} of {totalPages}
          </span>
          <button
            type="button"
            disabled={page >= totalPages}
            onClick={() => setPage((p) => Math.min(totalPages, p + 1))}
            style={{
              padding: '6px 14px',
              border: '1px solid #dcdcdc',
              background: '#fff',
              borderRadius: '4px',
              cursor: page >= totalPages ? 'not-allowed' : 'pointer',
            }}
          >
            Next
          </button>
        </div>
      )}

      {/* Create Study Group Modal */}
      {isModalOpen && (
        <div
          style={{
            position: 'fixed',
            top: 0,
            left: 0,
            right: 0,
            bottom: 0,
            backgroundColor: 'rgba(0,0,0,0.5)',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            zIndex: 1000,
            padding: '16px',
          }}
        >
          <div
            style={{
              backgroundColor: '#fff',
              borderRadius: '8px',
              maxWidth: '520px',
              width: '100%',
              padding: '24px',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
          >
            <div
              style={{
                display: 'flex',
                justifyContent: 'space-between',
                alignItems: 'center',
                marginBottom: '16px',
              }}
            >
              <h2 style={{ margin: 0, fontSize: '18px' }}>Create Study Group</h2>
              <button
                type="button"
                onClick={() => setIsModalOpen(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '18px',
                  cursor: 'pointer',
                }}
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div
                style={{
                  padding: '8px 12px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '4px',
                  marginBottom: '12px',
                  fontSize: '13px',
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Group Name *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. CS201 Algorithms Midterm Squad"
                  value={name}
                  onChange={(e) => setName(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Course Code
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. CS201"
                    value={courseCode}
                    onChange={(e) => setCourseCode(e.target.value.toUpperCase())}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Focus Topic
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Dynamic Programming"
                    value={topic}
                    onChange={(e) => setTopic(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
              </div>

              <div style={{ display: 'flex', gap: '10px', marginBottom: '12px' }}>
                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Meeting Format
                  </label>
                  <select
                    value={meetingType}
                    onChange={(e) => setMeetingType(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc', backgroundColor: '#fff' }}
                  >
                    <option value="in_person">In-Person</option>
                    <option value="virtual">Virtual</option>
                    <option value="hybrid">Hybrid</option>
                  </select>
                </div>

                <div style={{ flex: 1 }}>
                  <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                    Max Members
                  </label>
                  <input
                    type="number"
                    min={2}
                    max={50}
                    value={maxMembers}
                    onChange={(e) => setMaxMembers(e.target.value)}
                    style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                  />
                </div>
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Schedule
                </label>
                <input
                  type="text"
                  placeholder="e.g. Tuesdays & Thursdays at 6 PM"
                  value={meetingSchedule}
                  onChange={(e) => setMeetingSchedule(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div style={{ marginBottom: '12px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Location / Meeting Link
                </label>
                <input
                  type="text"
                  placeholder="e.g. Science Library Room 204 or Zoom link"
                  value={location}
                  onChange={(e) => setLocation(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div style={{ marginBottom: '16px' }}>
                <label style={{ display: 'block', fontSize: '13px', fontWeight: 600, marginBottom: '4px' }}>
                  Description
                </label>
                <textarea
                  rows="3"
                  placeholder="What goals, prerequisites, or topics will this group focus on?"
                  value={description}
                  onChange={(e) => setDescription(e.target.value)}
                  style={{ width: '100%', padding: '8px', borderRadius: '4px', border: '1px solid #ccc' }}
                />
              </div>

              <div style={{ display: 'flex', justifyContent: 'flex-end', gap: '8px' }}>
                <button
                  type="button"
                  onClick={() => setIsModalOpen(false)}
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 16px',
                    border: '1px solid #dcdcdc',
                    background: '#fff',
                    borderRadius: '4px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={isSubmitting}
                  style={{
                    padding: '8px 18px',
                    backgroundColor: '#1d4ed8',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '4px',
                    fontWeight: 600,
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
