import React, { useEffect, useRef } from 'react';
import { init, type EChartsCoreOption, type EChartsType } from '../lib/echarts';

interface EChartsProps {
  option: EChartsCoreOption;
  style?: React.CSSProperties;
  onChartReady?: (chart: EChartsType) => void;
}

export const ECharts: React.FC<EChartsProps> = ({ option, style, onChartReady }) => {
  const containerRef = useRef<HTMLDivElement>(null);
  const chartRef = useRef<EChartsType | null>(null);

  useEffect(() => {
    if (!containerRef.current) return undefined;

    const chart = init(containerRef.current);
    chartRef.current = chart;
    chart.setOption(option);
    onChartReady?.(chart);

    const handleResize = () => chart.resize();
    window.addEventListener('resize', handleResize);

    return () => {
      window.removeEventListener('resize', handleResize);
      chart.dispose();
      chartRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [onChartReady]);

  useEffect(() => {
    chartRef.current?.setOption(option, true);
  }, [option]);

  return <div ref={containerRef} style={style} />;
};
