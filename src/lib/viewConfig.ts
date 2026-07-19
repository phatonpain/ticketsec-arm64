import type { View } from '../hooks/useActiveView';

export interface ViewConfig {
  title: string;
  subtitle: string;
  breadcrumb: string;
}

export const VIEW_CONFIG: Record<View, ViewConfig> = {
  dashboard: {
    title: 'Security Operations Center',
    subtitle: 'Real-time ML ticket classification on AWS Graviton ARM64',
    breadcrumb: 'Security Operations Center',
  },
  detections: {
    title: 'Detections',
    subtitle: 'Search, sort and export classified tickets',
    breadcrumb: 'Detections',
  },
  predictions: {
    title: 'Live Predictions',
    subtitle: 'Classify new tickets via the inference API',
    breadcrumb: 'Live Predictions',
  },
  'threat-analytics': {
    title: 'Threat Analytics',
    subtitle: 'Category distribution and accuracy trends',
    breadcrumb: 'Threat Analytics',
  },
  'model-registry': {
    title: 'Model Registry',
    subtitle: 'Committed ML artifacts and evaluation results',
    breadcrumb: 'Model Registry',
  },
  'system-health': {
    title: 'System Health',
    subtitle: 'API probes, backoff status and session telemetry',
    breadcrumb: 'System Health',
  },
};
