import React, { useState, useEffect } from 'react';
import { useParams, useNavigate } from 'react-router-dom';
import { getCommunityDetails } from '../api/communityApi';
import { listAllReports, reviewReport, moderatePost, moderateComment } from '../api/adminApi';
import { useAuth } from '../context/AuthContext';

export const CommunityModPage = () => {
  const { slug } = useParams();
  const { user } = useAuth();
  const navigate = useNavigate();

  const [community, setCommunity] = useState(null);
  const [reports, setReports] = useState([]);
  const [loading, setLoading] = useState(true);
  const [actioning, setActioning] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const bootstrap = async () => {
      setLoading(true);
      setError('');
      try {
        const detailsRes = await getCommunityDetails(slug);
        const commObj = detailsRes.data.community;
        setCommunity(commObj);

        // Security check
        const isMod = commObj.memberRole === 'moderator' || commObj.memberRole === 'owner';
        const isAdmin = user && user.role === 'admin';
        if (!isMod && !isAdmin) {
          setError('403 - You are not authorized to moderate this community.');
          setLoading(false);
          return;
        }

        // Fetch reports
        const reportsRes = await listAllReports(1, 100); // get all recent reports
        // Filter reports specifically for this community
        const filtered = (reportsRes.data.reports || []).filter(
          (r) => r.community === commObj._id || (r.community?._id && r.community._id === commObj._id)
        );
        setReports(filtered);
      } catch (err) {
        setError(err.response?.data?.message || err.message || 'Failed to initialize mod page');
      } finally {
        setLoading(false);
      }
    };

    bootstrap();
  }, [slug, user]);

  const handleActionReport = async (reportId, status, targetType, targetId) => {
    if (!window.confirm(`Perform '${status}' on this report?`)) return;
    setActioning(true);
    try {
      // 1. Review the report document
      await reviewReport(reportId, status, `Community Moderator actioned: ${status}`);

      // 2. If actioned, let's moderate the post or comment and remove it!
      if (status === 'actioned') {
        if (targetType === 'post') {
          await moderatePost(targetId, 'removed');
        } else if (targetType === 'comment') {
          await moderateComment(targetId, 'removed');
        }
      }

      alert('Action completed successfully.');
      // Refresh list
      const reportsRes = await listAllReports(1, 100);
      const filtered = (reportsRes.data.reports || []).filter(
        (r) => r.community === community._id || (r.community?._id && r.community._id === community._id)
      );
      setReports(filtered);
    } catch (err) {
      alert(`Action failed: ${err.response?.data?.message || err.message}`);
    } finally {
      setActioning(false);
    }
  };

  if (loading) return <div className="loading-indicator">Loading moderation details...</div>;
  if (error) return <div className="error-indicator">{error}</div>;

  return (
    <div style={{ border: '1px solid #000', padding: '15px', background: '#fff' }}>
      <h2 style={{ borderBottom: '1px solid #000', paddingBottom: '6px', marginBottom: '15px' }}>
        Moderation Center: c/{community?.name}
      </h2>

      <div style={{ marginBottom: '20px' }}>
        <h4>Reported Content in c/{community?.name}</h4>
        <p style={{ fontSize: '11px', color: '#555', marginBottom: '10px' }}>
          Pending user flags and content reviews
        </p>

        {reports.length > 0 ? (
          <table style={{ width: '100%', borderCollapse: 'collapse', fontSize: '12px' }}>
            <thead>
              <tr style={{ background: '#f0f0f0', borderBottom: '1px solid #000' }}>
                <th style={{ padding: '6px', textAlign: 'left' }}>Reporter</th>
                <th style={{ padding: '6px', textAlign: 'left' }}>Target</th>
                <th style={{ padding: '6px', textAlign: 'left' }}>Reason</th>
                <th style={{ padding: '6px', textAlign: 'left' }}>Description</th>
                <th style={{ padding: '6px', textAlign: 'left' }}>Status</th>
                <th style={{ padding: '6px', textAlign: 'right' }}>Actions</th>
              </tr>
            </thead>
            <tbody>
              {reports.map((rep) => (
                <tr key={rep._id} style={{ borderBottom: '1px dotted #ccc' }}>
                  <td style={{ padding: '6px' }}>u/{rep.reporter?.username || 'deleted'}</td>
                  <td style={{ padding: '6px' }}>
                    <strong>{rep.targetType}</strong>
                    <br />
                    <span style={{ fontSize: '10px', color: '#666' }}>ID: {rep.targetId}</span>
                  </td>
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
                      <span style={{ fontStyle: 'italic', color: '#666' }}>Reviewed</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        ) : (
          <div className="empty-indicator">No reports pending for c/{community?.name}.</div>
        )}
      </div>

      <button type="button" onClick={() => navigate(`/c/${slug}`)}>
        Back to Community
      </button>
    </div>
  );
};
export default CommunityModPage;
