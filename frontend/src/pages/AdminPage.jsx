import React, { useState, useEffect } from 'react';
import { getAdminStats, listAllReports, reviewReport, moderatePost, moderateComment } from '../api/adminApi';

export const AdminPage = () => {
  const [stats, setStats] = useState(null);
  const [reports, setReports] = useState([]);
  const [reportStatus, setReportStatus] = useState('pending');
  const [targetType, setTargetType] = useState('');
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [reportsLoading, setReportsLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [error, setError] = useState('');

  const fetchStats = async () => {
    try {
      const statsRes = await getAdminStats();
      setStats(statsRes.data);
    } catch (err) {
      console.error('[AdminStats] Load failed:', err.message);
    } finally {
      setLoading(false);
    }
  };

  const fetchReports = async () => {
    setReportsLoading(true);
    try {
      const res = await listAllReports(page, 20, reportStatus || undefined, targetType || undefined);
      setReports(res.data.reports || []);
      setTotalPages(res.data.pagination?.pages || 1);
    } catch (err) {
      console.error('[AdminReports] Load failed:', err.message);
    } finally {
      setReportsLoading(false);
    }
  };

  useEffect(() => {
    fetchStats();
  }, []);

  useEffect(() => {
    fetchReports();
  }, [reportStatus, targetType, page]);

  const handleActionReport = async (reportId, status, targetType, targetId) => {
    if (!window.confirm(`Moderate this report as '${status}'?`)) return;
    setActioning(true);
    try {
      // 1. Set report status
      await reviewReport(reportId, status, `Admin moderation action: ${status}`);

      // 2. If 'actioned', automatically hide/delete the offensive post or comment
      if (status === 'actioned') {
        if (targetType === 'post') {
          await moderatePost(targetId, 'removed');
        } else if (targetType === 'comment') {
          await moderateComment(targetId, 'removed');
        }
      }

      alert(`Report moderated successfully.`);
      fetchStats();
      fetchReports();
    } catch (err) {
      alert(`Moderation action failed: ${err.message}`);
    } finally {
      setActioning(false);
    }
  };

  if (loading) return <div className="loading-indicator">Loading admin statistics...</div>;

  return (
    <div className="admin-page-card">
      <h2 style={{ borderBottom: '1px solid #e2e0db', paddingBottom: '6px', marginBottom: '15px' }}>
        Admin Dashboard
      </h2>

      {/* Metrics Row */}
      {stats && (
        <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fit, minmax(100px, 1fr))', gap: '10px', marginBottom: '25px' }}>
          {[
            { label: 'Total Users', val: stats.totalUsers },
            { label: 'Verified', val: stats.verifiedUsers },
            { label: 'Total Posts', val: stats.totalPosts },
            { label: 'Total Comments', val: stats.totalComments },
            { label: 'Total Votes', val: stats.totalVotes },
          ].map((item, idx) => (
            <div key={idx} style={{ border: '1px solid #000', padding: '8px', textAlign: 'center', background: '#fafafa' }}>
              <div style={{ fontSize: '10px', textTransform: 'uppercase', color: '#666' }}>{item.label}</div>
              <div style={{ fontSize: '18px', fontWeight: 'bold', marginTop: '4px' }}>{item.val}</div>
            </div>
          ))}
        </div>
      )}

      {/* Global Reports Manager */}
      <div>
        <h3 style={{ borderBottom: '1px dotted #000', paddingBottom: '4px', marginBottom: '10px' }}>
          Global Platform Reports (Pending: {stats?.pendingReports || 0})
        </h3>

        {/* Filter Toolbar */}
        <div style={{ display: 'flex', gap: '15px', marginBottom: '15px', alignItems: 'center' }}>
          <label style={{ fontSize: '12px' }}>
            Filter Status:{' '}
            <select value={reportStatus} onChange={(e) => { setReportStatus(e.target.value); setPage(1); }}>
              <option value="">All Statuses</option>
              <option value="pending">Pending</option>
              <option value="reviewed">Reviewed</option>
              <option value="dismissed">Dismissed</option>
              <option value="actioned">Actioned (Removed)</option>
            </select>
          </label>

          <label style={{ fontSize: '12px' }}>
            Filter Target Type:{' '}
            <select value={targetType} onChange={(e) => { setTargetType(e.target.value); setPage(1); }}>
              <option value="">All Types</option>
              <option value="post">Posts</option>
              <option value="comment">Comments</option>
              <option value="community">Communities</option>
              <option value="user">Users</option>
              <option value="message">Messages</option>
            </select>
          </label>
        </div>

        {reportsLoading ? (
          <div className="loading-indicator">Loading reports list...</div>
        ) : reports.length > 0 ? (
          <>
            <div className="table-responsive">
            <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
              <thead>
                <tr style={{ background: '#f0f0f0', borderBottom: '1px solid #000' }}>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Reporter</th>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Type</th>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Target ID</th>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Reason</th>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Description</th>
                  <th style={{ padding: '6px', textAlign: 'left' }}>Status</th>
                  <th style={{ padding: '6px', textAlign: 'right' }}>Moderator Action</th>
                </tr>
              </thead>
              <tbody>
                {reports.map((rep) => (
                  <tr key={rep._id} style={{ borderBottom: '1px dotted #ccc' }}>
                    <td style={{ padding: '6px' }}>
                      {rep.reporter?.username ? `u/${rep.reporter.username}` : '[deleted]'}
                      <br />
                      <span style={{ fontSize: '9px', color: '#666' }}>{rep.reporter?.email}</span>
                    </td>
                    <td style={{ padding: '6px' }}>{rep.targetType}</td>
                    <td style={{ padding: '6px', wordBreak: 'break-all' }}>{rep.targetId}</td>
                    <td style={{ padding: '6px' }}>{rep.reason}</td>
                    <td style={{ padding: '6px' }}>{rep.description || '(none)'}</td>
                    <td style={{ padding: '6px' }}>{rep.status}</td>
                    <td style={{ padding: '6px', textAlign: 'right' }}>
                      {rep.status === 'pending' ? (
                        <div style={{ display: 'flex', gap: '5px', justifyContent: 'flex-end' }}>
                          <button
                            type="button"
                            onClick={() => handleActionReport(rep._id, 'dismissed', rep.targetType, rep.targetId)}
                            disabled={actioning}
                          >
                            Dismiss
                          </button>
                          <button
                            type="button"
                            onClick={() => handleActionReport(rep._id, 'actioned', rep.targetType, rep.targetId)}
                            disabled={actioning}
                            style={{ color: '#fff', background: '#c00', borderColor: '#c00' }}
                          >
                            Action (Remove)
                          </button>
                        </div>
                      ) : (
                        <span style={{ color: '#666', fontStyle: 'italic' }}>Reviewed</span>
                      )}
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
            </div>

            <div className="pagination-controls">
              <button onClick={() => setPage((p) => Math.max(1, p - 1))} disabled={page === 1}>
                Previous
              </button>
              <span style={{ fontSize: '13px' }}>Page {page} of {totalPages}</span>
              <button onClick={() => setPage((p) => Math.min(totalPages, p + 1))} disabled={page === totalPages}>
                Next
              </button>
            </div>
          </>
        ) : (
          <div className="empty-indicator">No reports matching filters.</div>
        )}
      </div>
    </div>
  );
};
export default AdminPage;
