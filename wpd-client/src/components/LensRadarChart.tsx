import React, { useMemo } from 'react';

interface LensScore {
  key: string;
  title: string;
  score: number; // 0-5
  color: string;
  image?: string; // Path to lens SVG image
}

interface LensRadarChartProps {
  lenses: LensScore[];
  size?: number; // diameter in pixels
  showLabels?: boolean;
}

export const LensRadarChart: React.FC<LensRadarChartProps> = ({ lenses, size = 200, showLabels = true }) => {
  const padding = 40; // Add padding for icon space
  const svgSize = size + padding * 2; // Total SVG size with padding
  const radius = size / 2;
  const centerX = radius + padding;
  const centerY = radius + padding;
  const maxScore = 5;
  const levels = 5; // Number of concentric circles (0, 1, 2, 3, 4, 5)
  const angleSlice = (Math.PI * 2) / lenses.length;

  const points = useMemo(() => {
    return lenses.map((lens, i) => {
      const angle = angleSlice * i - Math.PI / 2;
      const distance = (lens.score / maxScore) * (radius * 0.75);
      return {
        key: lens.key,
        x: centerX + distance * Math.cos(angle),
        y: centerY + distance * Math.sin(angle),
        angle,
        distance,
      };
    });
  }, [lenses, angleSlice, radius, centerX, centerY]);

  const gridLines = useMemo(() => {
    const lines = [];
    for (let level = 1; level <= levels; level++) {
      const levelRadius = (level / maxScore) * (radius * 0.75);
      lines.push(
        <circle
          key={`level-${level}`}
          cx={centerX}
          cy={centerY}
          r={levelRadius}
          fill="none"
          stroke="#e5e7eb"
          strokeWidth="1"
          opacity="0.5"
        />
      );
    }
    return lines;
  }, [centerX, centerY, radius]);

  const axisLines = lenses.map((_, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const x = centerX + (radius * 0.75) * Math.cos(angle);
    const y = centerY + (radius * 0.75) * Math.sin(angle);
    return (
      <line
        key={`axis-${i}`}
        x1={centerX}
        y1={centerY}
        x2={x}
        y2={y}
        stroke="#d1d5db"
        strokeWidth="1"
      />
    );
  });

  const polygonPath = points
    .map((p, i) => `${i === 0 ? 'M' : 'L'} ${p.x} ${p.y}`)
    .join(' ') + ' Z';

  const labels = lenses.map((lens, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const labelDistance = (radius * 0.75) + 32;
    const x = centerX + labelDistance * Math.cos(angle);
    const y = centerY + labelDistance * Math.sin(angle);
    const iconSize = 40;
    
    // Render colored icon using foreignObject with color filter
    if (lens.image) {
      return (
        <g key={`label-${i}`}>
          <foreignObject
            x={x - iconSize / 2}
            y={y - iconSize / 2}
            width={iconSize}
            height={iconSize}
          >
            <img
              src={lens.image}
              alt={lens.title}
              style={{
                width: '100%',
                height: '100%',
                objectFit: 'contain',
              }}
              title={lens.title}
            />
          </foreignObject>
          {/* Apply color overlay */}
          <circle
            cx={x}
            cy={y}
            r={iconSize / 2 + 2}
            fill={lens.color}
            opacity="0.15"
          />
        </g>
      );
    }
    
    return (
      <text
        key={`label-${i}`}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="12"
        fontWeight="500"
        fill="#374151"
        className="lens-radar-label"
      >
        {lens.title}
      </text>
    );
  });

  const scoreLabels = lenses.map((lens, i) => {
    const angle = angleSlice * i - Math.PI / 2;
    const scoreDistance = ((lens.score + 0.5) / maxScore) * (radius * 0.75);
    const x = centerX + scoreDistance * Math.cos(angle);
    const y = centerY + scoreDistance * Math.sin(angle);
    
    return (
      <text
        key={`score-${i}`}
        x={x}
        y={y}
        textAnchor="middle"
        dominantBaseline="middle"
        fontSize="12"
        fontWeight="600"
        fill={lens.color}
        className="lens-radar-score"
      >
        {lens.score.toFixed(1)}
      </text>
    );
  });

  return (
    <div className="lens-radar-chart">
      <svg width={size} height={size} viewBox={`0 0 ${svgSize} ${svgSize}`}>
        {/* Grid circles */}
        {gridLines}
        
        {/* Axis lines */}
        {axisLines}
        
        {/* Data polygon fill */}
        <path
          d={polygonPath}
          fill="url(#radarGradient)"
          opacity="0.3"
          stroke="url(#radarStroke)"
          strokeWidth="2"
        />
        
        {/* Gradient definition */}
        <defs>
          <linearGradient id="radarGradient" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0066CC" stopOpacity="0.3" />
            <stop offset="100%" stopColor="#9933CC" stopOpacity="0.3" />
          </linearGradient>
          <linearGradient id="radarStroke" x1="0%" y1="0%" x2="100%" y2="100%">
            <stop offset="0%" stopColor="#0066CC" />
            <stop offset="100%" stopColor="#9933CC" />
          </linearGradient>
        </defs>
        
        {/* Center dot */}
        <circle cx={centerX} cy={centerY} r="3" fill="#d1d5db" />
        
        {/* Score labels */}
        {scoreLabels}
        
        {/* Axis labels */}
        {showLabels && labels}
      </svg>
    </div>
  );
};
