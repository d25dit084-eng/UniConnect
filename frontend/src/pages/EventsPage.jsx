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
        <div>
          <h1 style={{ margin: '0 0 6px 0', fontSize: '26px', fontWeight: '800', color: 'var(--text-primary)' }}>
            📅 Campus Events & Activities
          </h1>
          <p style={{ margin: 0, color: 'var(--text-secondary)', fontSize: '14px' }}>
            Discover campus workshops, hackathons, club meetups, and social gatherings.
          </p>
        </div>

        {isAuthenticated ? (
          <button
            type="button"
            className="btn-accent"
            onClick={() => setShowModal(true)}
            style={{
              padding: '10px 18px',
              fontSize: '14px',
              cursor: 'pointer',
            }}
          >
            + Host an Event
          </button>
        ) : (
          <Link
            to="/login"
            className="btn-secondary"
            style={{
              padding: '10px 18px',
              borderRadius: 'var(--radius-ctl)',
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
        <div style={{ display: 'flex', background: 'rgba(255, 255, 255, 0.05)', border: '1px solid var(--glass-border)', padding: '3px', borderRadius: 'var(--radius-ctl)' }}>
          <button
            onClick={() => setTimeframe('upcoming')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: timeframe === 'upcoming' ? '1px solid var(--accent)' : '1px solid transparent',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              background: timeframe === 'upcoming' ? 'rgba(139, 147, 255, 0.22)' : 'transparent',
              color: timeframe === 'upcoming' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: timeframe === 'upcoming' ? '0 0 10px rgba(139, 147, 255, 0.25)' : 'none',
            }}
          >
            Upcoming Events
          </button>
          <button
            onClick={() => setTimeframe('past')}
            style={{
              padding: '6px 16px',
              borderRadius: '6px',
              border: timeframe === 'past' ? '1px solid var(--accent)' : '1px solid transparent',
              fontSize: '13px',
              fontWeight: '600',
              cursor: 'pointer',
              background: timeframe === 'past' ? 'rgba(139, 147, 255, 0.22)' : 'transparent',
              color: timeframe === 'past' ? '#ffffff' : 'var(--text-secondary)',
              boxShadow: timeframe === 'past' ? '0 0 10px rgba(139, 147, 255, 0.25)' : 'none',
            }}
          >
            Past Events
          </button>
        </div>

        {/* Search Input */}
        <div style={{ flex: '1', minWidth: '220px', maxWidth: '340px' }}>
          <input
            type="text"
            className="glass-input-field"
            placeholder="Search events, venues..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
          />
        </div>

        {/* Format Filter */}
        <select
          value={selectedFormat}
          className="glass-input-field"
          onChange={(e) => setSelectedFormat(e.target.value)}
          style={{ width: '150px', cursor: 'pointer' }}
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
              gap: '8px',
              fontSize: '13px',
              cursor: 'pointer',
              userSelect: 'none',
              fontWeight: '500',
              color: 'var(--text-secondary)',
            }}
          >
            <input
              type="checkbox"
              checked={myRsvpsOnly}
              onChange={(e) => setMyRsvpsOnly(e.target.checked)}
              style={{ cursor: 'pointer', accentColor: 'var(--accent)' }}
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
                borderColor: isActive ? 'var(--accent)' : 'var(--glass-border)',
                backgroundColor: isActive ? 'rgba(139, 147, 255, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                color: isActive ? '#ffffff' : 'var(--text-secondary)',
                boxShadow: isActive ? '0 0 12px rgba(139, 147, 255, 0.25)' : 'none',
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
        <div style={{ textAlign: 'center', padding: '60px 0', color: 'var(--text-secondary)' }}>
          <div style={{ fontSize: '28px', marginBottom: '8px' }}>⏳</div>
          <p>Loading campus events...</p>
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
      ) : events.length === 0 ? (
        <div
          style={{
            textAlign: 'center',
            padding: '60px 20px',
            background: 'var(--glass-bg)',
            borderRadius: 'var(--radius-card)',
            border: '1px dashed var(--glass-border)',
            backdropFilter: 'var(--glass-blur)',
            WebkitBackdropFilter: 'var(--glass-blur)',
          }}
        >
          <div style={{ fontSize: '40px', marginBottom: '12px' }}>🗓️</div>
          <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', color: 'var(--text-primary)', fontWeight: 700 }}>
            No events found
          </h3>
          <p style={{ margin: '0 0 16px 0', color: 'var(--text-secondary)', fontSize: '14px' }}>
            {searchQuery || selectedCategory !== 'all' || selectedFormat !== 'all'
              ? 'Try relaxing your search or category filters.'
              : timeframe === 'upcoming'
              ? 'No upcoming events scheduled right now. Be the first to host one!'
              : 'No past events match your criteria.'}
          </p>
          {isAuthenticated && (
            <button
              onClick={() => setShowModal(true)}
              className="btn-accent"
              style={{
                padding: '8px 18px',
                fontSize: '13px',
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
                className="glass-panel-card"
                style={{
                  display: 'flex',
                  gap: '20px',
                  padding: '20px',
                }}
              >
                {/* Date Calendar Box */}
                <div className="glass-date-box">
                  <div className="glass-date-box-month">
                    {month}
                  </div>
                  <div className="glass-date-box-day">
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
                    <span className="glass-tag-badge" style={{ textTransform: 'capitalize' }}>
                      {ev.category}
                    </span>

                    {/* Format */}
                    <span className="glass-tag-badge">
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
                          borderRadius: '6px',
                          backgroundColor: isFull ? 'rgba(239, 68, 68, 0.15)' : 'rgba(52, 211, 153, 0.15)',
                          color: isFull ? '#f87171' : '#34d399',
                          border: isFull ? '1px solid rgba(239, 68, 68, 0.3)' : '1px solid rgba(52, 211, 153, 0.3)',
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
                          fontSize: '11.5px',
                          color: 'var(--accent)',
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
                      fontSize: '18px',
                      fontWeight: '700',
                      color: 'var(--text-primary)',
                    }}
                  >
                    {ev.title}
                  </h3>

                  <p
                    style={{
                      margin: '0 0 12px 0',
                      fontSize: '13.5px',
                      color: 'var(--text-secondary)',
                      lineHeight: '1.5',
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
                      fontSize: '12.5px',
                      color: 'var(--text-muted)',
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
                          color: 'var(--accent)',
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
                        <strong style={{ color: 'var(--text-primary)' }}>
                          {ev.organizer.username}
                        </strong>
                      </div>
                    )}

                    <div style={{ color: 'var(--success)', fontWeight: '600' }}>
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
                            borderRadius: 'var(--radius-ctl)',
                            border: '1px solid',
                            borderColor:
                              ev.userRsvpStatus === 'going' ? 'rgba(52, 211, 153, 0.6)' : 'var(--glass-border)',
                            backgroundColor:
                              ev.userRsvpStatus === 'going' ? 'rgba(52, 211, 153, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                            color:
                              ev.userRsvpStatus === 'going' ? '#34d399' : 'var(--text-primary)',
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
                            borderRadius: 'var(--radius-ctl)',
                            border: '1px solid',
                            borderColor:
                              ev.userRsvpStatus === 'maybe' ? 'rgba(245, 158, 11, 0.6)' : 'var(--glass-border)',
                            backgroundColor:
                              ev.userRsvpStatus === 'maybe' ? 'rgba(245, 158, 11, 0.22)' : 'rgba(255, 255, 255, 0.05)',
                            color:
                              ev.userRsvpStatus === 'maybe' ? '#fbbf24' : 'var(--text-secondary)',
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
                            color: 'var(--text-muted)',
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
                      className="btn-secondary"
                      style={{
                        padding: '6px 14px',
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
                        color: '#f87171',
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
        <div className="glass-modal-overlay" onClick={() => setShowModal(false)}>
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
              <h2 style={{ margin: 0, fontSize: '20px', fontWeight: '800', color: 'var(--text-primary)' }}>
                🎉 Host a Campus Event
              </h2>
              <button
                type="button"
                onClick={() => setShowModal(false)}
                style={{
                  background: 'none',
                  border: 'none',
                  fontSize: '20px',
                  cursor: 'pointer',
                  color: 'var(--text-muted)',
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
                  fontSize: '13px',
                  marginBottom: '16px',
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
                    fontSize: '12.5px',
                    fontWeight: '600',
                    marginBottom: '6px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Event Title *
                </label>
                <input
                  type="text"
                  required
                  className="glass-input-field"
                  placeholder="e.g. AI Hackathon Kickoff & Team Matching"
                  value={formData.title}
                  onChange={(e) =>
                    setFormData({ ...formData, title: e.target.value })
                  }
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
                      fontSize: '12.5px',
                      fontWeight: '600',
                      marginBottom: '6px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Category
                  </label>
                  <select
                    className="glass-input-field"
                    value={formData.category}
                    onChange={(e) =>
                      setFormData({ ...formData, category: e.target.value })
                    }
                    style={{ cursor: 'pointer' }}
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
                      fontSize: '12.5px',
                      fontWeight: '600',
                      marginBottom: '6px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Meeting Format
                  </label>
                  <select
                    className="glass-input-field"
                    value={formData.format}
                    onChange={(e) =>
                      setFormData({ ...formData, format: e.target.value })
                    }
                    style={{ cursor: 'pointer' }}
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
                      fontSize: '12.5px',
                      fontWeight: '600',
                      marginBottom: '6px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Start Date & Time *
                  </label>
                  <input
                    type="datetime-local"
                    required
                    className="glass-input-field"
                    value={formData.startDate}
                    onChange={(e) =>
                      setFormData({ ...formData, startDate: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      marginBottom: '6px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    End Date & Time (Optional)
                  </label>
                  <input
                    type="datetime-local"
                    className="glass-input-field"
                    value={formData.endDate}
                    onChange={(e) =>
                      setFormData({ ...formData, endDate: e.target.value })
                    }
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
                      fontSize: '12.5px',
                      fontWeight: '600',
                      marginBottom: '6px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Location / Venue
                  </label>
                  <input
                    type="text"
                    className="glass-input-field"
                    placeholder="e.g. Student Union Rm 302"
                    value={formData.location}
                    onChange={(e) =>
                      setFormData({ ...formData, location: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      marginBottom: '6px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Virtual Link
                  </label>
                  <input
                    type="url"
                    className="glass-input-field"
                    placeholder="https://zoom.us/j/..."
                    value={formData.virtualLink}
                    onChange={(e) =>
                      setFormData({ ...formData, virtualLink: e.target.value })
                    }
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
                      fontSize: '12.5px',
                      fontWeight: '600',
                      marginBottom: '6px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Capacity (0 = unlimited)
                  </label>
                  <input
                    type="number"
                    min="0"
                    className="glass-input-field"
                    value={formData.capacity}
                    onChange={(e) =>
                      setFormData({ ...formData, capacity: e.target.value })
                    }
                  />
                </div>

                <div>
                  <label
                    style={{
                      display: 'block',
                      fontSize: '12.5px',
                      fontWeight: '600',
                      marginBottom: '6px',
                      color: 'var(--text-secondary)',
                    }}
                  >
                    Tags (comma separated)
                  </label>
                  <input
                    type="text"
                    className="glass-input-field"
                    placeholder="ai, networking, pizza"
                    value={formData.tags}
                    onChange={(e) =>
                      setFormData({ ...formData, tags: e.target.value })
                    }
                  />
                </div>
              </div>

              {/* Description */}
              <div style={{ marginBottom: '18px' }}>
                <label
                  style={{
                    display: 'block',
                    fontSize: '12.5px',
                    fontWeight: '600',
                    marginBottom: '6px',
                    color: 'var(--text-secondary)',
                  }}
                >
                  Description *
                </label>
                <textarea
                  rows="4"
                  required
                  className="glass-input-field"
                  placeholder="Tell students about the agenda, speakers, refreshments, or what to bring..."
                  value={formData.description}
                  onChange={(e) =>
                    setFormData({ ...formData, description: e.target.value })
                  }
                  style={{ resize: 'vertical' }}
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
                  className="btn-secondary"
                  onClick={() => setShowModal(false)}
                >
                  Cancel
                </button>
                <button
                  type="submit"
                  className="btn-accent"
                  disabled={modalSubmitting}
                  style={{
                    padding: '8px 20px',
                    cursor: modalSubmitting ? 'not-allowed' : 'pointer',
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
