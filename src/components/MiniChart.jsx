// Lightweight SVG bar/line chart — no external library needed

export function BarChart({ data, valueKey, labelKey, color = '#FF3B30', height = 120 }) {
  if (!data || data.length === 0) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--label-4)', fontSize:13 }}>No data</div>;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const W = 100 / data.length;

  return (
    <div style={{ width:'100%', position:'relative' }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width:'100%', height, overflow:'visible' }}>
        {data.map((d, i) => {
          const v    = d[valueKey] || 0;
          const barH = (v / max) * (height - 20);
          const x    = i * W + W * 0.15;
          const w    = W * 0.7;
          const y    = height - barH - 2;
          return (
            <g key={i}>
              <rect x={x} y={y} width={w} height={barH} rx="2" fill={color} opacity="0.85" />
            </g>
          );
        })}
      </svg>
      {/* X labels */}
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
        {data.map((d, i) => (
          <div key={i} style={{ fontSize:10, color:'var(--label-4)', textAlign:'center', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {d[labelKey]}
          </div>
        ))}
      </div>
    </div>
  );
}

export function LineChart({ data, valueKey, labelKey, color = '#007AFF', height = 100 }) {
  if (!data || data.length < 2) return <div style={{ height, display:'flex', alignItems:'center', justifyContent:'center', color:'var(--label-4)', fontSize:13 }}>Not enough data</div>;
  const max = Math.max(...data.map(d => d[valueKey] || 0), 1);
  const pts = data.map((d, i) => {
    const x = (i / (data.length - 1)) * 98 + 1;
    const y = height - ((d[valueKey] || 0) / max) * (height - 10) - 5;
    return `${x},${y}`;
  });
  const areaBase = `L${pts[pts.length-1].split(',')[0]},${height} L${pts[0].split(',')[0]},${height} Z`;

  return (
    <div style={{ width:'100%' }}>
      <svg viewBox={`0 0 100 ${height}`} preserveAspectRatio="none" style={{ width:'100%', height, overflow:'visible' }}>
        <defs>
          <linearGradient id={`grad-${color.replace('#','')}`} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%" stopColor={color} stopOpacity="0.25" />
            <stop offset="100%" stopColor={color} stopOpacity="0.02" />
          </linearGradient>
        </defs>
        {/* Area fill */}
        <path d={`M${pts.join(' L')} ${areaBase}`} fill={`url(#grad-${color.replace('#','')})`} />
        {/* Line */}
        <polyline points={pts.join(' ')} fill="none" stroke={color} strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" />
        {/* Dots */}
        {pts.map((pt, i) => {
          const [x, y] = pt.split(',');
          return <circle key={i} cx={x} cy={y} r="2" fill={color} />;
        })}
      </svg>
      <div style={{ display:'flex', justifyContent:'space-between', marginTop:4 }}>
        {data.map((d, i) => (
          <div key={i} style={{ fontSize:10, color:'var(--label-4)', textAlign:'center', flex:1, overflow:'hidden', textOverflow:'ellipsis', whiteSpace:'nowrap' }}>
            {i === 0 || i === data.length-1 || (data.length <= 7) ? d[labelKey] : ''}
          </div>
        ))}
      </div>
    </div>
  );
}

export function DonutChart({ segments, size = 100 }) {
  // segments: [{ label, value, color }]
  const total = segments.reduce((s, sg) => s + sg.value, 0);
  if (!total) return <div style={{ width:size,height:size,display:'flex',alignItems:'center',justifyContent:'center',color:'var(--label-4)',fontSize:11 }}>No data</div>;

  const r = 38, cx = 50, cy = 50, circumference = 2 * Math.PI * r;
  let offset = 0;

  return (
    <svg width={size} height={size} viewBox="0 0 100 100">
      <circle cx={cx} cy={cy} r={r} fill="none" stroke="var(--bg-4)" strokeWidth="14" />
      {segments.map((sg, i) => {
        const dash = (sg.value / total) * circumference;
        const gap  = circumference - dash;
        const el   = (
          <circle key={i} cx={cx} cy={cy} r={r} fill="none"
            stroke={sg.color} strokeWidth="14"
            strokeDasharray={`${dash} ${gap}`}
            strokeDashoffset={-offset}
            style={{ transform:'rotate(-90deg)', transformOrigin:'50% 50%' }} />
        );
        offset += dash;
        return el;
      })}
      <text x="50" y="53" textAnchor="middle" fontSize="14" fontWeight="800" fill="var(--label)">
        ₹{total >= 100000 ? (total/100000).toFixed(1)+'L' : total >= 1000 ? (total/1000).toFixed(0)+'K' : total.toFixed(0)}
      </text>
    </svg>
  );
}
