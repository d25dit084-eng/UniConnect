import React from 'react';

export const CommunityActivityChart = () => {
  // Updated Demo Data: Mon 28, Tue 41, Wed 34, Thu 52, Fri 47, Sat 68, Sun 61
  const data = [
    { label: 'Mon', value: 28 },
    { label: 'Tue', value: 41 },
    { label: 'Wed', value: 34 },
    { label: 'Thu', value: 52 },
    { label: 'Fri', value: 47 },
    { label: 'Sat', value: 68 },
    { label: 'Sun', value: 61 },
  ];

  // SVG dimensions
  const width = 250;
  const height = 80;
  const paddingLeft = 20;
  const paddingRight = 10;
  const paddingTop = 10;
  const paddingBottom = 15;

  const chartWidth = width - paddingLeft - paddingRight;
  const chartHeight = height - paddingTop - paddingBottom;

  // Max value to scale heights
  const maxVal = 80;

  // Calculate coordinates
  const points = data.map((d, index) => {
    const x = paddingLeft + (index / (data.length - 1)) * chartWidth;
    const y = paddingTop + chartHeight - (d.value / maxVal) * chartHeight;
    return { x, y };
  });

  // Construct path string
  const pathD = points.reduce((acc, p, i) => {
    return i === 0 ? `M ${p.x} ${p.y}` : `${acc} L ${p.x} ${p.y}`;
  }, '');

  return (
    <div className="widget-card">
      <h4>Community Activity</h4>
      <p style={{ fontSize: '12px', color: 'var(--text-secondary)', marginBottom: '16px' }}>
        Weekly posts & comments activity
      </p>

      {/* SVG Line Graph */}
      <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
          <defs>
            <linearGradient id="activityGrad" x1="0" y1="0" x2="0" y2="1">
              <stop offset="0%" stopColor="var(--accent)" stopOpacity="0.28" />
              <stop offset="100%" stopColor="var(--accent)" stopOpacity="0.0" />
            </linearGradient>
          </defs>

          {/* Horizontal Grid lines */}
          <line
            x1={paddingLeft}
            y1={paddingTop}
            x2={width - paddingRight}
            y2={paddingTop}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="0.5"
            strokeDasharray="3"
          />
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight / 2}
            x2={width - paddingRight}
            y2={paddingTop + chartHeight / 2}
            stroke="rgba(255, 255, 255, 0.08)"
            strokeWidth="0.5"
            strokeDasharray="3"
          />
          <line
            x1={paddingLeft}
            y1={paddingTop + chartHeight}
            x2={width - paddingRight}
            y2={paddingTop + chartHeight}
            stroke="rgba(255, 255, 255, 0.12)"
            strokeWidth="0.5"
          />

          {/* Activity Area Fill */}
          <path
            d={`${pathD} L ${points[points.length - 1].x} ${paddingTop + chartHeight} L ${points[0].x} ${paddingTop + chartHeight} Z`}
            fill="url(#activityGrad)"
          />

          {/* Activity Line */}
          <path d={pathD} fill="none" stroke="var(--accent)" strokeWidth="2" strokeLinecap="round" strokeLinejoin="round" />

          {/* Axis Labels */}
          {data.map((d, i) => {
            const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
            return (
              <text
                key={i}
                x={x}
                y={height - 2}
                textAnchor="middle"
                style={{ fontSize: '8px', fill: 'var(--text-muted)', fontFamily: 'system-ui, sans-serif' }}
              >
                {d.label}
              </text>
            );
          })}

          {/* Value Labels */}
          <text
            x={paddingLeft - 4}
            y={paddingTop + 4}
            textAnchor="end"
            style={{ fontSize: '7px', fill: 'var(--text-muted)', fontFamily: 'system-ui, sans-serif' }}
          >
            80
          </text>
          <text
            x={paddingLeft - 4}
            y={paddingTop + chartHeight / 2 + 3}
            textAnchor="end"
            style={{ fontSize: '7px', fill: 'var(--text-muted)', fontFamily: 'system-ui, sans-serif' }}
          >
            40
          </text>
          <text
            x={paddingLeft - 4}
            y={paddingTop + chartHeight + 2}
            textAnchor="end"
            style={{ fontSize: '7px', fill: 'var(--text-muted)', fontFamily: 'system-ui, sans-serif' }}
          >
            0
          </text>
        </svg>
      </div>
    </div>
  );
};
export default CommunityActivityChart;
