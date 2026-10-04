import React, { useEffect, useState } from 'react';
import { Link } from 'react-router-dom';
import { CommunityContest } from './CommunityContest';
import { CommunityActivityChart } from './CommunityActivityChart';
import { CommunityPulse } from './CommunityPulse';
import { listCommunities } from '../api/communityApi';

export const RightSidebar = () => {
  const [activeCommunities, setActiveCommunities] = useState([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    const fetchActive = async () => {
      try {
        const res = await listCommunities('', 'members');
        const communitiesList = res.data?.communities || [];
        const formatted = communitiesList.slice(0, 5).map((c, idx) => ({
          rank: String(idx + 1).padStart(2, '0'),
          name: `c/${c.name}`,
          slug: c.slug,
          growth: `${c.membersCount || 0} members`
        }));
        setActiveCommunities(formatted);
      } catch (err) {
        console.error('[RightSidebar] Failed to fetch active communities:', err.message);
      } finally {
        setLoading(false);
      }
    };
    fetchActive();
  }, []);

  return (
    <aside className="right-sidebar">
      {/* 1. Community Challenges Card */}
      <CommunityContest />

      {/* 2. Community Activity Card */}
      <CommunityActivityChart />

      {/* 3. Community Pulse (5% Live Widget) */}
      <CommunityPulse />

      {/* 4. Active Communities Card */}
      <div style={{ border: '1px solid #e0e0e0', padding: '16px', background: '#ffffff', borderRadius: '4px' }}>
        <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#111111', fontWeight: 'bold', marginBottom: '12px', letterSpacing: '0.05em' }}>
          Active Communities
        </h4>
        
        <div style={{ display: 'flex', flexDirection: 'column', gap: '8px' }}>
          {loading ? (
            <div style={{ fontSize: '11px', color: '#888' }}>Loading...</div>
          ) : activeCommunities.length > 0 ? (
            activeCommunities.map((item) => (
              <div 
                key={item.rank} 
                style={{ 
                  display: 'flex', 
                  justifyContent: 'space-between', 
                  alignItems: 'center', 
                  fontSize: '12px',
                  paddingBottom: '6px',
                  borderBottom: '1px dashed #e0e0e0'
                }}
              >
                <div style={{ display: 'flex', gap: '8px', alignItems: 'center' }}>
                  <span style={{ color: '#888888', fontFamily: 'monospace' }}>{item.rank}</span>
                  <Link to={`/c/${item.slug}`} style={{ fontWeight: '500', color: '#1a1a1a' }}>
                    {item.name}
                  </Link>
                </div>
                <span style={{ color: '#090', fontFamily: 'monospace', fontSize: '11px', fontWeight: '500' }}>
                  {item.growth}
                </span>
              </div>
            ))
          ) : (
            <div style={{ fontSize: '11px', color: '#888', fontStyle: 'italic' }}>
              No active communities yet
            </div>
          )}
        </div>

        <div style={{ marginTop: '12px', textAlign: 'center' }}>
          <Link to="/communities" style={{ fontSize: '11px', textDecoration: 'underline', color: '#666666' }}>
            Explore All Communities
          </Link>
        </div>
      </div>
    </aside>
  );
};
export default RightSidebar;
