import React, { useMemo } from 'react';

interface LensScore {
  key: string;
  title: string;
  score: number; // 0-5
  color: string;
}

interface LensRadialChartProps {
  lenses: LensScore[];
  size?: number; // diameter in pixels
}

export const LensRadialChart: React.FC<LensRadialChartProps> = ({ lenses, size = 160 }) => {
  const radius = size / 2;
  const innerRadius = radius * 0.50;

  const segments = useMemo(() => {
    const segmentAngle = 360 / lenses.length; // 90° per lens
    
    return lenses.map((lens, index) => {
      const score = Math.max(0, Math.min(lens.score, 5)); // Clamp 0-5
      const filledAngle = (score / 5) * segmentAngle;
      
      const startAngle = index * segmentAngle - 90; // Start at top
      
      // Filled portion (color)
      const filledStart = startAngle;
      const filledEnd = startAngle + filledAngle;
      
      // Gray portion (incomplete)
      const grayStart = filledEnd;
      const grayEnd = startAngle + segmentAngle;
      
      const createArcPath = (angle1: number, angle2: number, color: string) => {
        const rad1 = (angle1 * Math.PI) / 180;
        const rad2 = (angle2 * Math.PI) / 180;
        
        const x1 = radius + innerRadius * Math.cos(rad1);
        const y1 = radius + innerRadius * Math.sin(rad1);
        const x2 = radius + innerRadius * Math.cos(rad2);
        const y2 = radius + innerRadius * Math.sin(rad2);
        
        const x3 = radius + radius * Math.cos(rad2);
        const y3 = radius + radius * Math.sin(rad2);
        const x4 = radius + radius * Math.cos(rad1);
        const y4 = radius + radius * Math.sin(rad1);
        
        const angle = angle2 - angle1;
        const largeArc = Math.abs(angle) > 180 ? 1 : 0;
        const sweep = angle > 0 ? 1 : 0;
        
        return {
          path: `M ${x1} ${y1} A ${innerRadius} ${innerRadius} 0 ${largeArc} ${sweep} ${x2} ${y2} L ${x3} ${y3} A ${radius} ${radius} 0 ${largeArc} ${1 - sweep} ${x4} ${y4} Z`,
          color,
        };
      };
      
      const filled = createArcPath(filledStart, filledEnd, lens.color);
      const gray = createArcPath(grayStart, grayEnd, '#d1d5db');
      
      return {
        key: lens.key,
        title: lens.title,
        filled,
        gray,
        score,
      };
    });
  }, [lenses, radius, innerRadius]);

  return (
    <div className="lens-radial-chart">
      <svg width={size} height={size} viewBox={`0 0 ${size} ${size}`}>
        {segments.map((segment) => (
          <g key={segment.key}>
            <path d={segment.gray.path} fill={segment.gray.color} />
            <path d={segment.filled.path} fill={segment.filled.color} opacity={0.9} />
          </g>
        ))}
      </svg>
      <div className="lens-radial-legend">
        {lenses.map((lens) => (
          <div key={lens.key} className="lens-radial-item">
            <div 
              className="lens-radial-dot" 
              style={{ backgroundColor: lens.color }}
            ></div>
            <div className="lens-radial-info">
              <div className="lens-radial-title">{lens.title}</div>
              <div className="lens-radial-score">{lens.score.toFixed(1)}/5</div>
            </div>
          </div>
        ))}
      </div>
    </div>
  );
};
