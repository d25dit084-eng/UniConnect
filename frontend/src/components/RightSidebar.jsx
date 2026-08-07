import React from 'react';
import { Link } from 'react-router-dom';
import { CommunityContest } from './CommunityContest';
import { CommunityActivityChart } from './CommunityActivityChart';
import { CommunityPulse } from './CommunityPulse';

export const RightSidebar = () => {
  // Active Communities list
  const activeCommunities = [
    { rank: '01', name: 'c/chaos', slug: 'chaos', growth: '+18.7%' },
    { rank: '02', name: 'c/play-round', slug: 'play-round', growth: '+12.4%' }
  ];

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
          {activeCommunities.map((item) => (
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
          ))}
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
