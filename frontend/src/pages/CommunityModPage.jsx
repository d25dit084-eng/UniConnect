import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import {
  getCommunityDetails,
  getCommunityModReports,
  actionCommunityModReport,
  getCommunityModSettings,
  updateCommunityModSettings,
} from '../api/communityApi';
import { useAuth } from '../context/AuthContext';

export const CommunityModPage = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [activeTab, setActiveTab] = useState('triage'); // 'triage' | 'automod'
  const [community, setCommunity] = useState(null);
  const [reports, setReports] = useState([]);
  const [statusFilter, setStatusFilter] = useState('');
  const [loading, setLoading] = useState(true);
  const [actioningId, setActioningId] = useState(null);
  const [error, setError] = useState('');
  const [feedback, setFeedback] = useState('');

  // Automod Settings State
  const [automodEnabled, setAutomodEnabled] = useState(true);
  const [keywords, setKeywords] = useState([]);
  const [newKeyword, setNewKeyword] = useState('');
  const [savingSettings, setSavingSettings] = useState(false);

  const loadData = async () => {
    setLoading(true);
    setError('');
    try {
      const detailsRes = await getCommunityDetails(slug);
      const commObj = detailsRes.data.community;
      setCommunity(commObj);

      // Verify moderator authority
      const isMod =
        commObj.memberRole === 'moderator' ||
        commObj.memberRole === 'owner' ||
        (user && user.role === 'admin');

      if (!isMod) {
        setError('403 - You are not authorized to moderate this community.');
        setLoading(false);
        return;
      }

      // Fetch reports
      const reportsRes = await getCommunityModReports(slug, statusFilter);
      setReports(reportsRes.data.reports || []);

      // Fetch automod settings
      const settingsRes = await getCommunityModSettings(slug);
      setAutomodEnabled(settingsRes.data.community.automodEnabled);
      setKeywords(settingsRes.data.community.automodKeywords || []);
    } catch (err) {
      setError(err.response?.data?.message || err.message || 'Failed to load moderation data');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadData();
  }, [slug, statusFilter]);

  const handleAction = async (reportId, action, defaultNote = '') => {
    const note = window.prompt(`Add a note for this ${action} action:`, defaultNote);
    if (note === null) return; // User cancelled prompt

    setActioningId(reportId);
    try {
      await actionCommunityModReport(slug, reportId, action, note);
      setFeedback(`Action '${action}' applied successfully.`);
      setTimeout(() => setFeedback(''), 4000);
      // Reload reports
      const reportsRes = await getCommunityModReports(slug, statusFilter);
      setReports(reportsRes.data.reports || []);
    } catch (err) {
      alert(`Action failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setActioningId(null);
    }
  };

  const handleAddKeyword = (e) => {
    e.preventDefault();
    const clean = newKeyword.trim().toLowerCase();
    if (!clean) return;
    if (keywords.includes(clean)) {
      alert('Keyword already exists in this list.');
      return;
    }
    setKeywords([...keywords, clean]);
    setNewKeyword('');
  };

  const handleRemoveKeyword = (kwToRemove) => {
    setKeywords(keywords.filter((k) => k !== kwToRemove));
  };

  const handleSaveSettings = async () => {
    setSavingSettings(true);
    try {
      await updateCommunityModSettings(slug, {
        automodEnabled,
        automodKeywords: keywords,
      });
      setFeedback('Automod rules and keyword filters saved successfully.');
      setTimeout(() => setFeedback(''), 4000);
    } catch (err) {
      alert(`Failed to save settings: ${err.response?.data?.message || err.message}`);
    } finally {
      setSavingSettings(false);
    }
  };

  if (loading) {
    return <div className="loading-indicator">Loading moderation queue...</div>;
  }

  if (error) {
    return (
      <div style={{ padding: '24px', maxWidth: '800px', margin: '0 auto' }}>
        <div className="error-indicator">{error}</div>
        <button
          type="button"
          onClick={() => navigate(`/c/${slug}`)}
          style={{ marginTop: '12px', padding: '8px 16px' }}
        >
          ← Back to Community
        </button>
      </div>
    );
  }

  const pendingCount = reports.filter((r) => r.status === 'pending').length;

  return (
    <div style={{ maxWidth: '980px', margin: '0 auto', padding: '20px 16px' }}>
      {/* Header */}
      <div
        style={{
          display: 'flex',
          justifyContent: 'space-between',
          alignItems: 'center',
          marginBottom: '20px',
          borderBottom: '1px solid #e2e8f0',
          paddingBottom: '16px',
        }}
      >
        <div>
          <button
            type="button"
            onClick={() => navigate(`/c/${slug}`)}
            style={{
              background: 'transparent',
              border: 'none',
              cursor: 'pointer',
              color: '#64748b',
              fontSize: '13px',
              padding: 0,
              marginBottom: '6px',
            }}
          >
            ← Back to c/{community?.name}
          </button>
          <h1 style={{ margin: 0, fontSize: '24px', fontWeight: '700', color: '#0f172a' }}>
            Moderation Center: c/{community?.name}
          </h1>
          <p style={{ margin: '4px 0 0 0', fontSize: '13px', color: '#64748b' }}>
            Manage community reports, review automod flags, and customize content filtering rules.
          </p>
        </div>
      </div>

      {feedback && (
        <div
          style={{
            background: '#ecfdf5',
            color: '#065f46',
            border: '1px solid #a7f3d0',
            padding: '10px 14px',
            borderRadius: '6px',
            marginBottom: '16px',
            fontSize: '13px',
          }}
        >
          ✓ {feedback}
        </div>
      )}

      {/* Tabs */}
      <div style={{ display: 'flex', gap: '8px', marginBottom: '20px' }}>
        <button
          type="button"
          onClick={() => setActiveTab('triage')}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            background: activeTab === 'triage' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'triage' ? '#ffffff' : '#334155',
          }}
        >
          🛡 Reports Queue ({pendingCount} pending)
        </button>
        <button
          type="button"
          onClick={() => setActiveTab('automod')}
          style={{
            padding: '8px 16px',
            fontSize: '14px',
            fontWeight: '600',
            border: 'none',
            borderRadius: '6px',
            cursor: 'pointer',
            background: activeTab === 'automod' ? '#0f172a' : '#f1f5f9',
            color: activeTab === 'automod' ? '#ffffff' : '#334155',
          }}
        >
          🤖 Automod Rules & Keyword Filters ({keywords.length})
        </button>
      </div>

      {/* TAB 1: Triage Queue */}
      {activeTab === 'triage' && (
        <div>
          {/* Status Filters */}
          <div
            style={{
              display: 'flex',
              gap: '6px',
              marginBottom: '16px',
              alignItems: 'center',
            }}
          >
            <span style={{ fontSize: '13px', color: '#64748b', marginRight: '6px' }}>Filter:</span>
            {['', 'pending', 'actioned', 'dismissed'].map((st) => (
              <button
                key={st}
                type="button"
                onClick={() => setStatusFilter(st)}
                style={{
                  padding: '4px 10px',
                  fontSize: '12px',
                  borderRadius: '14px',
                  border: statusFilter === st ? '1px solid #0f172a' : '1px solid #cbd5e1',
                  background: statusFilter === st ? '#0f172a' : '#ffffff',
                  color: statusFilter === st ? '#ffffff' : '#475569',
                  cursor: 'pointer',
                  textTransform: 'capitalize',
                }}
              >
                {st || 'All Reports'}
              </button>
            ))}
          </div>

          {reports.length === 0 ? (
            <div
              style={{
                textAlign: 'center',
                padding: '40px 20px',
                background: '#ffffff',
                border: '1px solid #e2e8f0',
                borderRadius: '8px',
                color: '#64748b',
              }}
            >
              🎉 No reports found matching current filter for c/{community?.name}.
            </div>
          ) : (
            <div style={{ display: 'flex', flexDirection: 'column', gap: '14px' }}>
              {reports.map((rep) => {
                const isQuarantined = rep.targetPreview?.status === 'hidden';
                return (
                  <div
                    key={rep._id}
                    style={{
                      background: '#ffffff',
                      border: rep.isAutomod ? '1px solid #f59e0b' : '1px solid #e2e8f0',
                      borderRadius: '8px',
                      padding: '16px',
                      boxShadow: '0 1px 3px rgba(0,0,0,0.05)',
                    }}
                  >
                    {/* Header Row */}
                    <div
                      style={{
                        display: 'flex',
                        justifyContent: 'space-between',
                        alignItems: 'center',
                        marginBottom: '10px',
                      }}
                    >
                      <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                        {rep.isAutomod ? (
                          <span
                            style={{
                              background: '#fef3c7',
                              color: '#92400e',
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '3px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            🤖 AUTOMOD [{rep.automodRule}]
                          </span>
                        ) : (
                          <span
                            style={{
                              background: '#fee2e2',
                              color: '#991b1b',
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '3px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            🚩 USER REPORT ({rep.reason})
                          </span>
                        )}

                        <span
                          style={{
                            background: '#f1f5f9',
                            color: '#475569',
                            fontSize: '11px',
                            fontWeight: '600',
                            padding: '3px 8px',
                            borderRadius: '4px',
                            textTransform: 'uppercase',
                          }}
                        >
                          {rep.targetType}
                        </span>

                        {isQuarantined && (
                          <span
                            style={{
                              background: '#fef2f2',
                              color: '#dc2626',
                              fontSize: '11px',
                              fontWeight: '700',
                              padding: '3px 8px',
                              borderRadius: '4px',
                            }}
                          >
                            🔒 Quarantined / Hidden
                          </span>
                        )}
                      </div>

                      <span
                        style={{
                          fontSize: '11px',
                          color: '#64748b',
                        }}
                      >
                        {new Date(rep.createdAt).toLocaleDateString()} at{' '}
                        {new Date(rep.createdAt).toLocaleTimeString([], {
                          hour: '2-digit',
                          minute: '2-digit',
                        })}
                      </span>
                    </div>

                    {/* Target Content Preview */}
                    <div
                      style={{
                        background: '#f8fafc',
                        padding: '12px',
                        borderRadius: '6px',
                        marginBottom: '12px',
                        borderLeft: isQuarantined ? '4px solid #ef4444' : '4px solid #94a3b8',
                      }}
                    >
                      {rep.targetPreview?.title && (
                        <div
                          style={{
                            fontWeight: '700',
                            fontSize: '14px',
                            marginBottom: '4px',
                            color: '#0f172a',
                          }}
                        >
                          {rep.targetPreview.title}
                        </div>
                      )}
                      <div
                        style={{
                          fontSize: '13px',
                          color: '#334155',
                          whiteSpace: 'pre-wrap',
                          lineHeight: '1.4',
                        }}
                      >
                        {rep.targetPreview?.snippet || '(No content preview available)'}
                      </div>

                      <div
                        style={{
                          marginTop: '6px',
                          fontSize: '11px',
                          color: '#64748b',
                          display: 'flex',
                          gap: '12px',
                        }}
                      >
                        <span>
                          Author:{' '}
                          <strong>
                            {rep.targetPreview?.author?.alias ||
                              rep.targetPreview?.author?.username ||
                              'Anonymous'}
                          </strong>
                        </span>
                        <span>
                          Content Status: <strong>{rep.targetPreview?.status || 'unknown'}</strong>
                        </span>
                      </div>
                    </div>

                    {/* Report Reason & Description */}
                    <div style={{ fontSize: '12px', color: '#475569', marginBottom: '14px' }}>
                      <div>
                        <strong>Flag Details:</strong> {rep.description || rep.reason}
                      </div>
                      {rep.reporter && (
                        <div style={{ marginTop: '2px', color: '#64748b' }}>
                          Reported by: u/{rep.reporter.username}
                        </div>
                      )}
                      {rep.moderationNote && (
                        <div style={{ marginTop: '4px', color: '#0369a1' }}>
                          Mod Note: {rep.moderationNote}
                        </div>
                      )}
                    </div>

                    {/* Actions Row */}
                    <div
                      style={{
                        display: 'flex',
                        gap: '8px',
                        justifyContent: 'flex-end',
                        alignItems: 'center',
                        borderTop: '1px solid #f1f5f9',
                        paddingTop: '12px',
                      }}
                    >
                      <span
                        style={{
                          fontSize: '11px',
                          color:
                            rep.status === 'pending'
                              ? '#d97706'
                              : rep.status === 'actioned'
                              ? '#dc2626'
                              : '#16a34a',
                          fontWeight: '700',
                          textTransform: 'uppercase',
                          marginRight: 'auto',
                        }}
                      >
                        Status: {rep.status}
                      </span>

                      {rep.status === 'pending' ? (
                        <>
                          <button
                            type="button"
                            onClick={() =>
                              handleAction(
                                rep._id,
                                'approve',
                                isQuarantined ? 'Unhide and approve content' : 'Dismiss flag'
                              )
                            }
                            disabled={actioningId === rep._id}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              borderRadius: '6px',
                              border: '1px solid #10b981',
                              background: '#ecfdf5',
                              color: '#065f46',
                              cursor: 'pointer',
                            }}
                          >
                            ✓ {isQuarantined ? 'Restore & Approve' : 'Approve Content'}
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleAction(rep._id, 'remove', 'Removed for community rule violation')
                            }
                            disabled={actioningId === rep._id}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              borderRadius: '6px',
                              border: '1px solid #ef4444',
                              background: '#ef4444',
                              color: '#ffffff',
                              cursor: 'pointer',
                            }}
                          >
                            ✕ Remove Content
                          </button>

                          <button
                            type="button"
                            onClick={() =>
                              handleAction(
                                rep._id,
                                'warn_author',
                                'Please review community posting guidelines.'
                              )
                            }
                            disabled={actioningId === rep._id}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              fontWeight: '600',
                              borderRadius: '6px',
                              border: '1px solid #f59e0b',
                              background: '#fffbeb',
                              color: '#92400e',
                              cursor: 'pointer',
                            }}
                          >
                            ⚠️ Warn Author
                          </button>

                          <button
                            type="button"
                            onClick={() => handleAction(rep._id, 'dismiss', 'Dismissed by mod')}
                            disabled={actioningId === rep._id}
                            style={{
                              padding: '6px 12px',
                              fontSize: '12px',
                              borderRadius: '6px',
                              border: '1px solid #cbd5e1',
                              background: '#ffffff',
                              color: '#475569',
                              cursor: 'pointer',
                            }}
                          >
                            Dismiss
                          </button>
                        </>
                      ) : (
                        <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                          Reviewed by {rep.reviewedBy?.username || 'moderator'}
                        </span>
                      )}
                    </div>
                  </div>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* TAB 2: Automod Rules & Custom Filters */}
      {activeTab === 'automod' && (
        <div
          style={{
            background: '#ffffff',
            border: '1px solid #e2e8f0',
            borderRadius: '8px',
            padding: '24px',
          }}
        >
          <div style={{ marginBottom: '24px' }}>
            <h3 style={{ margin: '0 0 8px 0', fontSize: '18px', fontWeight: '700' }}>
              Automated Content Protection
            </h3>
            <p style={{ margin: 0, fontSize: '13px', color: '#64748b' }}>
              Posts and comments matching these filters are quarantined automatically for moderator
              review before reaching other students.
            </p>
          </div>

          {/* Toggle Switch */}
          <div
            style={{
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'space-between',
              padding: '14px 16px',
              background: '#f8fafc',
              borderRadius: '8px',
              marginBottom: '24px',
            }}
          >
            <div>
              <div style={{ fontWeight: '600', fontSize: '14px', color: '#0f172a' }}>
                Enable Automod Filter for c/{community?.name}
              </div>
              <div style={{ fontSize: '12px', color: '#64748b' }}>
                Automatically quarantine posts containing prohibited terms
              </div>
            </div>
            <label style={{ display: 'flex', alignItems: 'center', cursor: 'pointer', gap: '8px' }}>
              <input
                type="checkbox"
                checked={automodEnabled}
                onChange={(e) => setAutomodEnabled(e.target.checked)}
                style={{ width: '18px', height: '18px', cursor: 'pointer' }}
              />
              <span style={{ fontSize: '13px', fontWeight: '600' }}>
                {automodEnabled ? 'Active' : 'Disabled'}
              </span>
            </label>
          </div>

          {/* Global Active Rules Info */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 10px 0', fontSize: '14px', fontWeight: '700', color: '#334155' }}>
              Global Campus Protection Rules (Active)
            </h4>
            <div style={{ display: 'grid', gap: '8px' }}>
              <div
                style={{
                  padding: '10px 14px',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                🎓 <strong>Academic Dishonesty:</strong> Exam leaks, essay buying, homework cheating
                solicitations.
              </div>
              <div
                style={{
                  padding: '10px 14px',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                🛡 <strong>Scams & Phishing:</strong> Fake giveaways, telegram hacking, carding,
                fraudulent links.
              </div>
              <div
                style={{
                  padding: '10px 14px',
                  background: '#f1f5f9',
                  borderRadius: '6px',
                  fontSize: '13px',
                }}
              >
                🚫 <strong>Severe Harassment:</strong> Prohibited toxic slurs and targeted threats.
              </div>
            </div>
          </div>

          {/* Community Custom Banned Keywords */}
          <div style={{ marginBottom: '24px' }}>
            <h4 style={{ margin: '0 0 8px 0', fontSize: '14px', fontWeight: '700', color: '#334155' }}>
              Custom Community Banned Keywords
            </h4>
            <p style={{ margin: '0 0 12px 0', fontSize: '12px', color: '#64748b' }}>
              Add specific words or phrases that should trigger an automod quarantine in this community.
            </p>

            {/* Keyword Chips */}
            <div
              style={{
                display: 'flex',
                flexWrap: 'wrap',
                gap: '8px',
                marginBottom: '14px',
                minHeight: '36px',
              }}
            >
              {keywords.length === 0 ? (
                <span style={{ fontSize: '12px', color: '#94a3b8', fontStyle: 'italic' }}>
                  No custom banned keywords added yet.
                </span>
              ) : (
                keywords.map((kw) => (
                  <span
                    key={kw}
                    style={{
                      display: 'inline-flex',
                      alignItems: 'center',
                      gap: '6px',
                      background: '#fee2e2',
                      color: '#991b1b',
                      fontSize: '12px',
                      fontWeight: '600',
                      padding: '4px 10px',
                      borderRadius: '16px',
                    }}
                  >
                    {kw}
                    <button
                      type="button"
                      onClick={() => handleRemoveKeyword(kw)}
                      style={{
                        background: 'transparent',
                        border: 'none',
                        color: '#991b1b',
                        cursor: 'pointer',
                        fontWeight: '700',
                        padding: 0,
                        lineHeight: 1,
                      }}
                      title="Remove keyword"
                    >
                      ×
                    </button>
                  </span>
                ))
              )}
            </div>

            {/* Add Keyword Form */}
            <form onSubmit={handleAddKeyword} style={{ display: 'flex', gap: '8px' }}>
              <input
                type="text"
                value={newKeyword}
                onChange={(e) => setNewKeyword(e.target.value)}
                placeholder="Enter word or phrase (e.g. ticketscalper)..."
                style={{
                  flex: 1,
                  padding: '8px 12px',
                  fontSize: '13px',
                  border: '1px solid #cbd5e1',
                  borderRadius: '6px',
                }}
              />
              <button
                type="submit"
                style={{
                  padding: '8px 16px',
                  fontSize: '13px',
                  fontWeight: '600',
                  borderRadius: '6px',
                  border: '1px solid #0f172a',
                  background: '#0f172a',
                  color: '#ffffff',
                  cursor: 'pointer',
                }}
              >
                + Add Filter
              </button>
            </form>
          </div>

          {/* Save Button */}
          <div style={{ display: 'flex', justifyContent: 'flex-end', borderTop: '1px solid #f1f5f9', paddingTop: '16px' }}>
            <button
              type="button"
              onClick={handleSaveSettings}
              disabled={savingSettings}
              style={{
                padding: '10px 20px',
                fontSize: '14px',
                fontWeight: '600',
                borderRadius: '6px',
                border: 'none',
                background: '#2563eb',
                color: '#ffffff',
                cursor: 'pointer',
              }}
            >
              {savingSettings ? 'Saving Settings...' : 'Save Moderation Settings'}
            </button>
          </div>
        </div>
      )}
    </div>
  );
};

export default CommunityModPage;
