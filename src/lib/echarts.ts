/**
 * fixpack-v2 — applies: FIX-07.
 * Original: src/lib/echarts.ts (26 lines) — THE real module-registration point.
 *
 * ROOT CAUSE [CONFIRMED from source + console S6]: the modular echarts/core
 * build registered GridComponent but NOT the ECharts-6 containment feature,
 * so every cartesian chart logged
 *   "[ECharts] Specified `grid.containLabel` but no
 *    `use(LegacyGridContainLabel)`; use `grid.outerBounds` instead."
 * and silently ignored containLabel (axis labels could clip).
 *
 * Fix — Option A (minimal, layout-safe): register LegacyGridContainLabel from
 * echarts/features. Every existing `grid: { …, containLabel: true }`
 * (ThreatBarChart, PerformanceLineChart) works as originally intended; zero
 * option changes, zero layout regression risk. echarts@^6.1.0 already ships
 * the feature — no new dependency.
 * (Option B — migrating to grid.outerBounds* — remains available later; not
 * needed to kill the warning.)
 */

import { init, use as registerEchartsModules, type EChartsCoreOption, type EChartsType } from 'echarts/core';
import { BarChart, LineChart, PieChart, HeatmapChart } from 'echarts/charts';
import {
  TooltipComponent,
  LegendComponent,
  GridComponent,
  GraphicComponent,
  TitleComponent,
  VisualMapComponent,
} from 'echarts/components';
import { LegacyGridContainLabel } from 'echarts/features';
import { CanvasRenderer } from 'echarts/renderers';

registerEchartsModules([
  BarChart,
  LineChart,
  PieChart,
  HeatmapChart,
  TooltipComponent,
  LegendComponent,
  GridComponent,
  GraphicComponent,
  TitleComponent,
  VisualMapComponent,
  LegacyGridContainLabel, // FIX-07: honors grid.containLabel on ECharts 6
  CanvasRenderer,
]);

export { init };
export type { EChartsCoreOption, EChartsType };
