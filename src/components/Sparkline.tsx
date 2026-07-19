import React from 'react';

interface SparklineProps {
  data: number[];
  color?: string;
  fillColor?: string;
  height?: number;
  width?: number | string;
  strokeWidth?: number;
}

function hexToRgba(hex: string, alpha: number): string {
  const clean = hex.replace('#', '');
  const r = parseInt(clean.substring(0, 2), 16);
  const g = parseInt(clean.substring(2, 4), 16);
  const b = parseInt(clean.substring(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

function deriveFillColor(color: string): string {
  if (color.startsWith('#')) return hexToRgba(color, 0.08);
  if (color.startsWith('rgba(')) return color.replace(/[\d.]+\)$/, '0.08)');
  if (color.startsWith('rgb(')) return color.replace(')', ', 0.08)');
  return color;
}

export const Sparkline: React.FC<SparklineProps> = ({
  data,
  color = '#06B6D4',
  fillColor,
  height = 36,
  width = '100%',
  strokeWidth = 1.5,
}) => {
  if (!data || data.length < 2) return <div style={{ width, height }} aria-hidden="true" />;

  const resolvedFillColor = fillColor ?? deriveFillColor(color);
  const min = Math.min(...data);
  const max = Math.max(...data);
  const range = max - min || 1;
  const padding = 2;
  const viewWidth = 100;
  const viewHeight = height;

  const points = data.map((value, index) => {
    const x = (index / (data.length - 1)) * viewWidth;
    const y = viewHeight - padding - ((value - min) / range) * (viewHeight - padding * 2);
    return [x, y];
  });

  const linePath = points.map((p, i) => `${i === 0 ? 'M' : 'L'} ${p[0]} ${p[1]}`).join(' ');
  const areaPath = `${linePath} L ${points[points.length - 1][0]} ${viewHeight} L ${points[0][0]} ${viewHeight} Z`;

  return (
    <div style={{ width, height }} aria-hidden="true">
      <svg width="100%" height="100%" viewBox={`0 0 ${viewWidth} ${viewHeight}`} preserveAspectRatio="none">
        <path d={areaPath} fill={resolvedFillColor} />
        <path d={linePath} fill="none" stroke={color} strokeWidth={strokeWidth} vectorEffect="non-scaling-stroke" />
      </svg>
    </div>
  );
};
