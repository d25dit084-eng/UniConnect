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
    { label: 'Sun', value: 61 }
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
    <div style={{ border: '1px solid #e0e0e0', padding: '16px', background: '#ffffff', borderRadius: '4px', marginBottom: '20px' }}>
      <h4 style={{ fontSize: '12px', textTransform: 'uppercase', color: '#111111', fontWeight: 'bold', marginBottom: '4px', letterSpacing: '0.05em' }}>
        Community Activity
      </h4>
      <p style={{ fontSize: '11px', color: '#666666', marginBottom: '15px' }}>
        Weekly posts & comments activity
      </p>

      {/* SVG Line Graph */}
      <div style={{ position: 'relative', width: '100%', height: `${height}px` }}>
        <svg viewBox={`0 0 ${width} ${height}`} style={{ width: '100%', height: '100%' }}>
          {/* Horizontal Grid lines */}
          <line x1={paddingLeft} y1={paddingTop} x2={width - paddingRight} y2={paddingTop} stroke="#e0e0e0" strokeWidth="0.5" strokeDasharray="3" />
          <line x1={paddingLeft} y1={paddingTop + chartHeight / 2} x2={width - paddingRight} y2={paddingTop + chartHeight / 2} stroke="#e0e0e0" strokeWidth="0.5" strokeDasharray="3" />
          <line x1={paddingLeft} y1={paddingTop + chartHeight} x2={width - paddingRight} y2={paddingTop + chartHeight} stroke="#e0e0e0" strokeWidth="0.5" />

          {/* Activity Line */}
          <path d={pathD} fill="none" stroke="#1a1a1a" strokeWidth="1.5" />

          {/* Axis Labels */}
          {data.map((d, i) => {
            const x = paddingLeft + (i / (data.length - 1)) * chartWidth;
            return (
              <text
                key={i}
                x={x}
                y={height - 2}
                textAnchor="middle"
                style={{ fontSize: '7px', fill: '#666666', fontFamily: 'monospace' }}
              >
                {d.label}
              </text>
            );
          })}

          {/* Value Labels */}
          <text x={paddingLeft - 4} y={paddingTop + 4} textAnchor="end" style={{ fontSize: '6px', fill: '#888888', fontFamily: 'monospace' }}>80</text>
          <text x={paddingLeft - 4} y={paddingTop + chartHeight / 2 + 3} textAnchor="end" style={{ fontSize: '6px', fill: '#888888', fontFamily: 'monospace' }}>40</text>
          <text x={paddingLeft - 4} y={paddingTop + chartHeight + 2} textAnchor="end" style={{ fontSize: '6px', fill: '#888888', fontFamily: 'monospace' }}>0</text>
        </svg>
      </div>
    </div>
  );
};
export default CommunityActivityChart;
