import { useState, useEffect, useCallback } from 'react';
import { Link } from 'react-router-dom';
import { useAuth } from '../context/AuthContext';
import {
  getEvents,
  createEvent,
  rsvpEvent,
  cancelRsvp,
  deleteEvent,
} from '../api/eventApi';

const CATEGORIES = [
  { key: 'all', label: 'All Categories', icon: '✨' },
  { key: 'academic', label: 'Academic', icon: '🎓' },
  { key: 'social', label: 'Social', icon: '🎉' },
  { key: 'career', label: 'Career', icon: '💼' },
  { key: 'sports', label: 'Sports', icon: '⚽' },
  { key: 'workshop', label: 'Workshop', icon: '🛠️' },
  { key: 'cultural', label: 'Cultural', icon: '🎭' },
  { key: 'other', label: 'Other', icon: '📌' },
];

const FORMATS = [
  { key: 'all', label: 'All Formats' },
  { key: 'in_person', label: '📍 In-Person' },
  { key: 'virtual', label: '🌐 Virtual' },
  { key: 'hybrid', label: '🔀 Hybrid' },
];

export default function EventsPage() {
  const { user, isAuthenticated } = useAuth();

  const [events, setEvents] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState(null);

  // Filters
  const [timeframe, setTimeframe] = useState('upcoming');
  const [selectedCategory, setSelectedCategory] = useState('all');
  const [selectedFormat, setSelectedFormat] = useState('all');
  const [searchQuery, setSearchQuery] = useState('');
  const [myRsvpsOnly, setMyRsvpsOnly] = useState(false);

  // Modal State
  const [showModal, setShowModal] = useState(false);
  const [modalSubmitting, setModalSubmitting] = useState(false);
  const [modalError, setModalError] = useState('');
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    category: 'social',
    format: 'in_person',
    location: '',
    virtualLink: '',
    startDate: '',
    endDate: '',
    capacity: 0,
    tags: '',
  });

  const fetchEventsList = useCallback(async () => {
    try {
      setLoading(true);
      setError(null);
      const params = {
        timeframe,
        search: searchQuery.trim() || undefined,
        category: selectedCategory !== 'all' ? selectedCategory : undefined,
        format: selectedFormat !== 'all' ? selectedFormat : undefined,
        myRsvps: myRsvpsOnly ? 'true' : undefined,
      };

      const res = await getEvents(params);
      if (res.data?.success) {
        setEvents(res.data.events || []);
      }
    } catch (err) {
      setError(err.response?.data?.message || 'Failed to load campus events');
    } finally {
      setLoading(false);
    }
  }, [timeframe, selectedCategory, selectedFormat, searchQuery, myRsvpsOnly]);

  useEffect(() => {
    fetchEventsList();
  }, [fetchEventsList]);

  // Handle RSVP status toggle
  const handleRsvp = async (eventId, newStatus) => {
    if (!isAuthenticated) return;

    // Optimistic UI update
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev._id !== eventId) return ev;
        const prevStatus = ev.userRsvpStatus;
        let delta = 0;
        if (newStatus === 'going' && prevStatus !== 'going') delta = 1;
        if (newStatus !== 'going' && prevStatus === 'going') delta = -1;

        return {
          ...ev,
          userRsvpStatus: newStatus,
          attendeeCount: Math.max(0, (ev.attendeeCount || 0) + delta),
        };
      })
    );

    try {
      const res = await rsvpEvent(eventId, newStatus);
      if (res.data?.success && res.data.event) {
        setEvents((prev) =>
          prev.map((ev) => (ev._id === eventId ? res.data.event : ev))
        );
      }
    } catch (err) {
      // Rollback on error
      fetchEventsList();
      alert(err.response?.data?.message || 'Failed to update RSVP');
    }
  };

  // Handle Cancel RSVP
  const handleCancelRsvp = async (eventId) => {
    if (!isAuthenticated) return;

    // Optimistic UI update
    setEvents((prev) =>
      prev.map((ev) => {
        if (ev._id !== eventId) return ev;
        const wasGoing = ev.userRsvpStatus === 'going';
        return {
          ...ev,
          userRsvpStatus: null,
          attendeeCount: wasGoing ? Math.max(0, (ev.attendeeCount || 0) - 1) : ev.attendeeCount,
        };
      })
    );

    try {
      const res = await cancelRsvp(eventId);
      if (res.data?.success && res.data.event) {
        setEvents((prev) =>
          prev.map((ev) => (ev._id === eventId ? res.data.event : ev))
        );
      }
    } catch (err) {
      fetchEventsList();
      alert(err.response?.data?.message || 'Failed to cancel RSVP');
    }
  };

  // Handle Delete Event
  const handleDelete = async (eventId) => {
    if (!window.confirm('Are you sure you want to delete this campus event?')) return;
    try {
      await deleteEvent(eventId);
      setEvents((prev) => prev.filter((ev) => ev._id !== eventId));
    } catch (err) {
      alert(err.response?.data?.message || 'Failed to delete event');
    }
  };

  // Handle Form Submit
  const handleCreateSubmit = async (e) => {
    e.preventDefault();
    setModalError('');

    if (!formData.title.trim()) {
      setModalError('Event title is required');
      return;
    }
    if (!formData.description.trim()) {
      setModalError('Event description is required');
      return;
    }
    if (!formData.startDate) {
      setModalError('Start date and time are required');
      return;
    }

    try {
      setModalSubmitting(true);
      const payload = {
        title: formData.title.trim(),
        description: formData.description.trim(),
        category: formData.category,
        format: formData.format,
        location: formData.location.trim(),
        virtualLink: formData.virtualLink.trim(),
        startDate: new Date(formData.startDate).toISOString(),
        endDate: formData.endDate ? new Date(formData.endDate).toISOString() : null,
        capacity: parseInt(formData.capacity, 10) || 0,
        tags: formData.tags
          .split(',')
          .map((t) => t.trim())
          .filter(Boolean),
      };

      const res = await createEvent(payload);
      if (res.data?.success) {
        setShowModal(false);
        setFormData({
          title: '',
          description: '',
          category: 'social',
          format: 'in_person',
          location: '',
          virtualLink: '',
          startDate: '',
          endDate: '',
          capacity: 0,
          tags: '',
        });
        fetchEventsList();
      }
    } catch (err) {
      setModalError(err.response?.data?.message || 'Failed to create event');
    } finally {
      setModalSubmitting(false);
    }
  };

  const formatDateBox = (dateStr) => {
    if (!dateStr) return { month: 'TBD', day: '--', time: '' };
    const d = new Date(dateStr);
    const month = d.toLocaleString('en-US', { month: 'short' }).toUpperCase();
    const day = d.getDate();
    const time = d.toLocaleString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true,
    });
    return { month, day, time };
  };

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '24px 16px' }}>
      {/* Header Banner */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          flexWrap: 'wrap',
          gap: '16px',
          marginBottom: '24px',
          paddingBottom: '20px',
          borderBottom: '1px solid #e2e0db',
        }}
      >
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: '800' }}>
            📅 Campus Events & Activities
          </h1>
          <p style={{ margin: 0, color: '#666', fontSize: '14px' }}>
            Discover campus workshops, hackathons, club meetups, and social gatherings.
          </p>
        </div>

        {isAuthenticated ? (
          <button
            onClick={() => setShowModal(true)}
            style={{
              padding: '10px 18px',
              backgroundColor: '#1a1a1a',
              color: '#fff',
              border: 'none',
              borderRadius: '8px',
              fontWeight: '600',
              fontSize: '14px',
              cursor: 'pointer',
              boxShadow: '0 2px 4px rgba(0,0,0,0.1)',
            }}
          >
            + Host an Event
          </button>
        ) : (
          <Link
            to="/login"
            style={{
              padding: '10px 18px',
              backgroundColor: '#f3f2ee',
              color: '#1a1a1a',
              border: '1px solid #d4d2cc',
              borderRadius: '8px',
              textDecoration: 'none',
              fontWeight: '600',
              fontSize: '14px',
            }}
          >
            Sign in to Host & RSVP
          </Link>
        )}
      </div>

      {/* Timeframe Tabs & Controls */}
      <div
        style={{
          display: 'flex',
          flexWrap: 'wrap',
          alignItems: 'center',
          justifyContent: 'space-between',
          gap: '12px',
          marginBottom: '20px',
        }}
      >
        {/* Timeframe Switcher */}
        <div style={{ display: 'flex', background: '#f0eee6', padding: '3px', borderRadius: '8px' }}>
          <button
            onClick={() => setTimeframe('upcoming')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              background: timeframe === 'upcoming' ? '#ffffff' : 'transparent',
              color: timeframe === 'upcoming' ? '#1a1a1a' : '#666',
              boxShadow: timeframe === 'upcoming' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Upcoming Events
          </button>
          <button
            onClick={() => setTimeframe('past')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: 'none',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              background: timeframe === 'past' ? '#ffffff' : 'transparent',
              color: timeframe === 'past' ? '#1a1a1a' : '#666',
              boxShadow: timeframe === 'past' ? '0 1px 3px rgba(0,0,0,0.1)' : 'none',
            }}
          >
            Past Events
          </button>
        </div>

        {/* Search Input */}
        <div style={{ flex: '1', minWidth: '220px', maxWidth: '340px' }}>
          <input
            type="text"
            placeholder="Search events, venues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            style={{
              width: '100%',
              padding: '8px 12px',
              fontSize: '13px',
              borderRadius: '8px',
              border: '1px solid #d4d2cc',
              backgroundColor: '#faf9f5',
            }}
          />
        </div>

        {/* Format Filter */}
        <select
          value={selectedFormat}
          onChange={(e) => setSelectedFormat(e.target.value)}
          style={{
            padding: '8px 12px',
            fontSize: '13px',
            borderRadius: '8px',
            border: '1px solid #d4d2cc',
            backgroundColor: '#faf9f5',
            cursor: 'pointer',
          }}
        >
          {FORMATS.map((fmt) => (
            <option key={fmt.key} value={fmt.key}>
              {fmt.label}
            </option>
          ))}
        </select>

        {/* My RSVPs Checkbox */}
        {isAuthenticated && (
          <label
            style={{
              display: 'flex',
              alignItems: 'center',
              gap: '6px',
              fontSize: '13px',
              cursor: 'pointer',
              userSelect: 'none',
              fontWeight: '500',
            }}
          >
            <input
              type="checkbox"
              checked={myRsvpsOnly}
              onChange={(e) => setMyRsvpsOnly(e.target.checked)}
              style={{ cursor: 'pointer' }}
            />
            My RSVPs only
          </label>
        )}
      </div>

      {/* Category Filter Pills */}
      <div
        style={{
          display: 'flex',
          gap: '8px',
          overflowX: 'auto',
          paddingBottom: '12px',
          marginBottom: '20px',
        }}
      >
        {CATEGORIES.map((cat) => {
          const isActive = selectedCategory === cat.key;
          return (
            <button
              key={cat.key}
              onClick={() => setSelectedCategory(cat.key)}
              style={{
                display: 'flex',
                alignItems: 'center',
                gap: '6px',
                padding: '6px 14px',
                borderRadius: '20px',
                border: '1px solid',
                borderColor: isActive ? '#1a1a1a' : '#d4d2cc',
                backgroundColor: isActive ? '#1a1a1a' : '#ffffff',
                color: isActive ? '#ffffff' : '#333333',
                fontSize: '13px',
                fontWeight: isActive ? '600' : '400',
                cursor: 'pointer',
                whiteSpace: 'nowrap',
                transition: 'all 0.15s ease',
              }}
            >
              <span>{cat.icon}</span>
              <span>{cat.label}</span>
            </button>
          );
        })}
      </div>

      {/* Content Stream */}
      {loading ? (
        <div style={{ textAlign: 'center', padding: '60px 0', color: '#666' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
          <p>Loading campus events...</p>
        </div>
      ) : error ? (
        <div
          style={{
            padding: '16px',
            backgroundColor: '#fee2e2',
            color: '#b91c1c',
            borderRadius: '8px',
            textAlign: 'center',
          }}
        >
          {error}
        </div>
      ) : events.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: '#ffffff',
            borderRadius: '12px',
            border: '1px dashed #d4d2cc',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗓️</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px' }}>No events found</h3>
          <p style={{ margin: '0 0 16px 0', color: '#666', fontSize: '14px' }}>
            {searchQuery || selectedCategory !== 'all' || selectedFormat !== 'all'
              ? 'Try relaxing your search or category filters.'
              : timeframe === 'upcoming'
              ? 'No upcoming events scheduled right now. Be the first to host one!'
              : 'No past events match your criteria.'}
          </p>
          {isAuthenticated && (
            <button
              onClick={() => setShowModal(true)}
              style={{
                padding: '8px 16px',
                backgroundColor: '#1a1a1a',
                color: '#fff',
                border: 'none',
                borderRadius: '6px',
                fontSize: '13px',
                fontWeight: '600',
                cursor: 'pointer',
              }}
            >
              + Host an Event
            </button>
          )}
        </div>
      ) : (
        <div style={{ display: 'flex', flexDirection: 'column', gap: '16px' }}>
          {events.map((ev) => {
            const { month, day, time } = formatDateBox(ev.startDate);
            const isFull = ev.capacity > 0 && ev.attendeeCount >= ev.capacity;
            const isOrganizer = user && ev.organizer && (ev.organizer._id === user._id || ev.organizer === user._id);
            const isAdmin = user && (user.role === 'admin' || user.isAdmin);

            return (
              <div
                key={ev._id}
                style={{
                  display: 'flex',
                  gap: '20px',
                  background: '#ffffff',
                  border: '1px solid #e2e0db',
                  borderRadius: '12px',
                  padding: '18px',
                  boxShadow: '0 1px 3px rgba(0,0,0,0.04)',
                  transition: 'box-shadow 0.15s ease',
                }}
              >
                {/* Date Calendar Box */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width: '68px',
                    minWidth: '68px',
                    height: '76px',
                    borderRadius: '10px',
                    backgroundColor: '#faf8f5',
                    border: '1px solid #e2e0db',
                    overflow: 'hidden',
                  }}
                >
                  <div
                    style={{
                      width: '100%',
                      background: '#1a1a1a',
                      color: '#ffffff',
                      fontSize: '11px',
                      fontWeight: '800',
                      textAlign: 'center',
                      padding: '3px 0',
                      letterSpacing: '0.5px',
                    }}
                  >
                    {month}
                  </div>
                  <div
                    style={{
                      fontSize: '24px',
                      fontWeight: '800',
                      color: '#1a1a1a',
                      lineHeight: '1.2',
                      marginTop: '2px',
                    }}
                  >
                    {day}
                  </div>
                </div>

                {/* Event Main Content */}
                <div style={{ flex: 1, minWidth: 0 }}>
                  <div
                    style={{
                      display: 'flex',
                      alignItems: 'center',
                      gap: '8px',
                      flexWrap: 'wrap',
                      marginBottom: '6px',
                    }}
                  >
                    {/* Category */}
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#e0e7ff',
                        color: '#3730a3',
                        fontWeight: '600',
                        textTransform: 'capitalize',
                      }}
                    >
                      {ev.category}
                    </span>

                    {/* Format */}
                    <span
                      style={{
                        fontSize: '11px',
                        padding: '2px 8px',
                        borderRadius: '4px',
                        backgroundColor: '#f3f4f6',
                        color: '#4b5563',
                        fontWeight: '500',
                      }}
                    >
                      {ev.format === 'in_person'
                        ? '📍 In-Person'
                        : ev.format === 'virtual'
                        ? '🌐 Virtual'
                        : '🔀 Hybrid'}
                    </span>

                    {/* Capacity Indicator */}
                    {ev.capacity > 0 && (
                      <span
                        style={{
                          fontSize: '11px',
                          padding: '2px 8px',
                          borderRadius: '4px',
                          backgroundColor: isFull ? '#fee2e2' : '#f0fdf4',
                          color: isFull ? '#b91c1c' : '#15803d',
                          fontWeight: '600',
                        }}
                      >
                        {isFull ? 'FULL' : `${ev.attendeeCount}/${ev.capacity} spots`}
                      </span>
                    )}

                    {/* Community link if associated */}
                    {ev.community && (
                      <Link
                        to={`/c/${ev.community.slug}`}
                        style={{
                          fontSize: '11px',
                          color: '#4f46e5',
                          textDecoration: 'none',
                          fontWeight: '600',
                        }}
                      >
                        c/{ev.community.name}
                      </Link>
                    )}
                  </div>

                  <h3
                    style={{
                      margin: '0 0 6px 0',
                      fontSize: '17px',
                      fontWeight: '700',
                      color: '#1a1a1a',
                    }}
                  >
                    {ev.title}
                  </h3>

                  <p
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: '13px',
                      color: '#555',
                      lineHeight: '1.45',
                      display: '-webkit-box',
                      WebkitLineClamp: 2,
                      WebkitBoxOrient: 'vertical',
                      overflow: 'hidden',
                    }}
                  >
                    {ev.description}
                  </p>

                  {/* Metadata Row: Time, Location, Organizer */}
                  <div
                    style={{
                      display: 'flex',
                      flexWrap: 'wrap',
                      gap: '16px',
                      fontSize: '12px',
                      color: '#666',
                      alignItems: 'center',
                    }}
                  >
                    <div>⏰ {time}</div>

                    {ev.location && (
                      <div style={{ display: 'flex', alignItems: 'center', gap: '4px' }}>
                        <span>📍</span>
                        <span>{ev.location}</span>
                      </div>
                    )}

                    {ev.virtualLink && (
                      <a
                        href={ev.virtualLink}
                        target="_blank"
                        rel="noreferrer"
                        style={{
                          color: '#2563eb',
                          textDecoration: 'underline',
                          display: 'flex',
                          alignItems: 'center',
                          gap: '2px',
                        }}
                      >
                        🔗 Join Online
                      </a>
                    )}

                    {ev.organizer && (
                      <div>
                        Hosted by{' '}
                        <strong style={{ color: '#1a1a1a' }}>
                          {ev.organizer.username}
                        </strong>
                      </div>
                    )}

                    <div style={{ color: '#059669', fontWeight: '600' }}>
                      👥 {ev.attendeeCount || 0} attending
                    </div>
                  </div>
                </div>

                {/* RSVP and Action Controls */}
                <div
                  style={{
                    display: 'flex',
                    flexDirection: 'column',
                    justifyContent: 'center',
                    alignItems: 'flex-end',
                    gap: '8px',
                    minWidth: '130px',
                  }}
                >
                  {isAuthenticated ? (
                    <>
                      <div style={{ display: 'flex', gap: '6px' }}>
                        <button
                          onClick={() => handleRsvp(ev._id, 'going')}
                          disabled={isFull && ev.userRsvpStatus !== 'going'}
                          style={{
                            padding: '6px 12px',
                            borderRadius: '6px',
                            border: '1px solid',
                            borderColor:
                              ev.userRsvpStatus === 'going' ? '#15803d' : '#d4d2cc',
                            backgroundColor:
                              ev.userRsvpStatus === 'going' ? '#dcfce7' : '#ffffff',
                            color:
                              ev.userRsvpStatus === 'going' ? '#15803d' : '#1a1a1a',
                            fontWeight: '600',
                            fontSize: '12px',
                            cursor:
                              isFull && ev.userRsvpStatus !== 'going'
                                ? 'not-allowed'
                                : 'pointer',
                            opacity:
                              isFull && ev.userRsvpStatus !== 'going' ? 0.5 : 1,
                          }}
                        >
                          {ev.userRsvpStatus === 'going' ? '✓ Going' : 'Going'}
                        </button>

                        <button
                          onClick={() => handleRsvp(ev._id, 'maybe')}
                          style={{
                            padding: '6px 10px',
                            borderRadius: '6px',
                            border: '1px solid',
                            borderColor:
                              ev.userRsvpStatus === 'maybe' ? '#b45309' : '#d4d2cc',
                            backgroundColor:
                              ev.userRsvpStatus === 'maybe' ? '#fef3c7' : '#ffffff',
                            color:
                              ev.userRsvpStatus === 'maybe' ? '#b45309' : '#666',
                            fontWeight: '600',
                            fontSize: '12px',
                            cursor: 'pointer',
                          }}
                        >
                          Maybe
                        </button>
                      </div>

                      {ev.userRsvpStatus && (
                        <button
                          onClick={() => handleCancelRsvp(ev._id)}
                          style={{
                            background: 'none',
                            border: 'none',
                            color: '#999',
                            fontSize: '11px',
                            cursor: 'pointer',
                            textDecoration: 'underline',
                            padding: 0,
                          }}
                        >
                          Withdraw RSVP
                        </button>
                      )}
                    </>
                  ) : (
                    <Link
                      to="/login"
                      style={{
                        padding: '6px 12px',
                        backgroundColor: '#f3f2ee',
                        color: '#1a1a1a',
                        border: '1px solid #d4d2cc',
                        borderRadius: '6px',
                        fontSize: '12px',
                        textDecoration: 'none',
                        fontWeight: '600',
                      }}
                    >
                      RSVP →
                    </Link>
                  )}

                  {(isOrganizer || isAdmin) && (
                    <button
                      onClick={() => handleDelete(ev._id)}
                      style={{
                        background: 'none',
                        border: 'none',
                        color: '#ef4444',
                        fontSize: '11px',
                        cursor: 'pointer',
                        padding: '2px 0',
                      }}
                    >
                      Delete Event
                    </button>
                  )}
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Host Event Modal */}
      {showModal && (
        <div
          style={{
            position: 'fixed',
            inset: 0,
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
              backgroundColor: '#ffffff',
              borderRadius: '12px',
              maxWidth: '560px',
              width: '100%',
              maxHeight: '90vh',
              overflowY: 'auto',
              padding: '24px',
              boxShadow: '0 20px 25px -5px rgba(0,0,0,0.1)',
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
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800' }}>
                🎉 Host a Campus Event
              </h2>
              <button
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: '#999',
                }}
              >
                ✕
              </button>
            </div>

            {modalError && (
              <div
                style={{
                  padding: '10px 14px',
                  backgroundColor: '#fee2e2',
                  color: '#b91c1c',
                  borderRadius: '6px',
                  fontSize: '13px',
                  marginBottom: '14px',
                }}
              >
                {modalError}
              </div>
            )}

            <form onSubmit={handleCreateSubmit}>
              {/* Title */}
              <div style={{ marginBottom: '14px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    marginBottom: '4px',
                  }}
                >
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  placeholder="e.g. AI Hackathon Kickoff & Team Matching"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d4d2cc',
                    fontSize: '14px',
                  }}
                />
              </div>

              {/* Category & Format */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '14px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      marginBottom: '4px',
                    }}
                  >
                    Category
                  </label>
                  <select
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d4d2cc',
                      fontSize: '14px',
                    }}
                  >
                    {CATEGORIES.filter((c) => c.key !== 'all').map((c) => (
                      <option key={c.key} value={c.key}>
                        {c.icon} {c.label}
                      </option>
                    ))}
                  </select>
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      marginBottom: '4px',
                    }}
                  >
                    Meeting Format
                  </label>
                  <select
                    value={formData.format}
                    onChange={(e) =>
                      setFormData({ ...formData, format: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d4d2cc',
                      fontSize: '14px',
                    }}
                  >
                    <option value="in_person">📍 In-Person</option>
                    <option value="virtual">🌐 Virtual</option>
                    <option value="hybrid">🔀 Hybrid</option>
                  </select>
                </div>
              </div>

              {/* Start Date & End Date */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '14px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      marginBottom: '4px',
                    }}
                  >
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d4d2cc',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      marginBottom: '4px',
                    }}
                  >
                    End Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d4d2cc',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>

              {/* Location & Virtual Link */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 1fr',
                  gap: '12px',
                  marginBottom: '14px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      marginBottom: '4px',
                    }}
                  >
                    Location / Venue
                  </label>
                  <input
                    type="text"
                    placeholder="e.g. Student Union Rm 302"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d4d2cc',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      marginBottom: '4px',
                    }}
                  >
                    Virtual Link
                  </label>
                  <input
                    type="url"
                    placeholder="https://zoom.us/j/..."
                    value={formData.virtualLink}
                    onChange={(e) =>
                      setFormData({ ...formData, virtualLink: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d4d2cc',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>

              {/* Capacity & Tags */}
              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: '1fr 2fr',
                  gap: '12px',
                  marginBottom: '14px',
                }}
              >
                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      marginBottom: '4px',
                    }}
                  >
                    Capacity (0 = unlimited)
                  </label>
                  <input
                    type="number"
                    min="0"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d4d2cc',
                      fontSize: '14px',
                    }}
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '13px',
                      fontWeight: '600',
                      marginBottom: '4px',
                    }}
                  >
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    placeholder="ai, networking, pizza"
                    value={formData.tags}
                    onChange={(e) =>
                      setFormData({ ...formData, tags: e.target.value })
                    }
                    style={{
                      width: '100%',
                      padding: '8px 12px',
                      borderRadius: '6px',
                      border: '1px solid #d4d2cc',
                      fontSize: '14px',
                    }}
                  />
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '18px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '13px',
                    fontWeight: '600',
                    marginBottom: '4px',
                  }}
                >
                  Description *
                </label>
                <textarea
                  rows="4"
                  required
                  placeholder="Tell students about the agenda, speakers, refreshments, or what to bring..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  style={{
                    width: '100%',
                    padding: '8px 12px',
                    borderRadius: '6px',
                    border: '1px solid #d4d2cc',
                    fontSize: '14px',
                    resize: 'vertical',
                  }}
                />
              </div>

              {/* Actions */}
              <div
                style={{
                  display: 'flex',
                  justifyContent: 'flex-end',
                  gap: '10px',
                }}
              >
                <button
                  type="button"
                  onClick={() => setShowModal(false)}
                  style={{
                    padding: '8px 16px',
                    background: '#f3f2ee',
                    border: '1px solid #d4d2cc',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: 'pointer',
                  }}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  disabled={modalSubmitting}
                  style={{
                    padding: '8px 18px',
                    background: '#1a1a1a',
                    color: '#fff',
                    border: 'none',
                    borderRadius: '6px',
                    fontWeight: '600',
                    fontSize: '13px',
                    cursor: modalSubmitting ? 'not-allowed' : 'pointer',
                    opacity: modalSubmitting ? 0.7 : 1,
                  }}
                >
                  {modalSubmitting ? 'Publishing...' : 'Publish Event'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
}
