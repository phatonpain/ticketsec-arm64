/**
 * D1 — Single source of truth for committed ML artifacts.
 *
 * All surfaces that display eval/latency/model-meta data consume this loader.
 * Status normalization is centralized: 'OK' | 'COMPLETE' | 'complete' → ready;
 * anything else (including 'PENDING', missing files, malformed JSON) → pending.
 */

import evalResultsJson from '../../model/eval_results.json';
import confusionMatrixJson from '../../model/confusion_matrix.json';
import latencyT4gJson from '../../model/latency_t4g_micro.json';
import probeResultsJson from '../../model/probe_results.json';
import artifactMetaJson from '../../model/artifact_meta.json';
import quantizationMd from '../../model/quantization.md?raw';
import calibrationJson from '../../model/calibration.json';

export interface PerClassMetric {
  precision: number;
  recall: number;
  f1: number;
  support: number;
}

export interface EvalArtifact {
  status: string;
  ready: boolean;
  generatedAt?: string;
  sha256?: string;
  datasetSize?: number;
  trainSize?: number;
  testSize?: number;
  overallAccuracy?: number;
  perClassMetrics?: Record<string, PerClassMetric>;
  methodology?: {
    split?: string;
    categories?: string[];
    f1Floor?: number;
  };
  ablation?: Array<{
    candidate_id: string;
    overall_accuracy: number;
    min_f1: number;
    all_f1_above_floor: boolean;
  }>;
  winnerCandidateId?: string;
  deployedCandidateId?: string;
  deployedNote?: string;
}

export interface ConfusionArtifact {
  status: string;
  ready: boolean;
  generatedAt?: string;
  sha256?: string;
  labels?: string[];
  matrix?: number[][];
}

export interface LatencyArtifact {
  status: string;
  ready: boolean;
  generatedAt?: string;
  host?: string;
  endpoint?: string;
  sampleCount?: number;
  p50Ms?: number;
  p95Ms?: number;
  interpretation?: string;
}

export interface ProbeResult {
  id: string;
  expected_vs_actual?: {
    expected: string | null;
    actual: string | null;
    matched: boolean;
  };
}

export interface ProbeArtifact {
  status: string;
  ready: boolean;
  generatedAt?: string;
  probeSuiteSha256?: string;
  probeCount?: number;
  probesRun?: number;
  expectationMismatches?: number;
  results?: ProbeResult[];
}

export interface ModelMetaArtifact {
  status: string;
  ready: boolean;
  generatedAt?: string;
  sha256?: string;
  sizeBytes?: number;
  sizeMb?: number;
  memoryMaxMb?: number;
}

export interface QuantizationInfo {
  sizeText: string;
  baselineAccuracy?: number;
  int8Accuracy?: number;
  delta?: number;
}

export interface SampleConfidence {
  predicted_category: string;
  confidence: number;
  probabilities: Record<string, number>;
}

export interface CalibrationArtifact {
  status: string;
  ready: boolean;
  generatedAt?: string;
  sha256?: string;
  eceBefore?: number;
  eceAfter?: number;
  brierBefore?: number;
  brierAfter?: number;
  temperature?: number;
  assessment?: string;
  sampleConfidences?: {
    before: Record<string, SampleConfidence>;
    after: Record<string, SampleConfidence>;
  };
}

/**
 * Normalize artifact status values across the ML pipeline.
 * Generators may emit 'OK' (older scripts) or 'COMPLETE' (current scripts).
 */
export function isArtifactReady(status: unknown): boolean {
  if (typeof status !== 'string') return false;
  const normalized = status.trim().toLowerCase();
  return normalized === 'ok' || normalized === 'complete';
}

function evalArtifact(): EvalArtifact {
  const raw = evalResultsJson as Record<string, unknown>;
  const status = String(raw.status ?? 'PENDING');
  return {
    status,
    ready: isArtifactReady(status),
    generatedAt: raw.generated_at as string | undefined,
    sha256: raw.artifact_sha256 as string | undefined,
    datasetSize: raw.dataset_size as number | undefined,
    trainSize: raw.train_size as number | undefined,
    testSize: raw.test_size as number | undefined,
    overallAccuracy: raw.overall_accuracy as number | undefined,
    perClassMetrics: raw.per_class_metrics as Record<string, PerClassMetric> | undefined,
    methodology: raw.methodology as EvalArtifact['methodology'],
    ablation: raw.ablation as EvalArtifact['ablation'],
    winnerCandidateId: raw.winner_candidate_id as string | undefined,
    deployedCandidateId: raw.deployed_candidate_id as string | undefined,
    deployedNote: raw.deployed_note as string | undefined,
  };
}

function confusionArtifact(): ConfusionArtifact {
  const raw = confusionMatrixJson as Record<string, unknown>;
  const status = String(raw.status ?? 'PENDING');
  return {
    status,
    ready: isArtifactReady(status),
    generatedAt: raw.generated_at as string | undefined,
    sha256: raw.artifact_sha256 as string | undefined,
    labels: raw.labels as string[] | undefined,
    matrix: raw.matrix as number[][] | undefined,
  };
}

function latencyArtifact(): LatencyArtifact {
  const raw = latencyT4gJson as Record<string, unknown>;
  const status = String(raw.status ?? 'PENDING');
  return {
    status,
    ready: isArtifactReady(status),
    generatedAt: raw.generated_at as string | undefined,
    host: raw.host as string | undefined,
    endpoint: raw.endpoint as string | undefined,
    sampleCount: raw.sample_count as number | undefined,
    p50Ms: raw.p50_ms as number | undefined,
    p95Ms: raw.p95_ms as number | undefined,
    interpretation: (raw.measurement_protocol as { interpretation?: string } | undefined)?.interpretation,
  };
}

function probeArtifact(): ProbeArtifact {
  const raw = probeResultsJson as Record<string, unknown>;
  const status = String(raw.status ?? 'PENDING');
  return {
    status,
    ready: isArtifactReady(status),
    generatedAt: raw.generated_at as string | undefined,
    probeSuiteSha256: raw.probe_suite_sha256 as string | undefined,
    probeCount: raw.probe_count as number | undefined,
    probesRun: raw.probes_run as number | undefined,
    expectationMismatches: raw.expectation_mismatches as number | undefined,
    results: raw.results as ProbeResult[] | undefined,
  };
}

function modelMetaArtifact(): ModelMetaArtifact {
  const raw = artifactMetaJson as Record<string, unknown>;
  const status = String(raw.status ?? 'OK');
  return {
    status,
    ready: isArtifactReady(status),
    generatedAt: raw.generated_at as string | undefined,
    sha256: raw.artifact_sha256 as string | undefined,
    sizeBytes: raw.size_bytes as number | undefined,
    sizeMb: raw.size_mb as number | undefined,
    memoryMaxMb: raw.memory_max_mb as number | undefined,
  };
}

function calibrationArtifact(): CalibrationArtifact {
  const raw = calibrationJson as Record<string, unknown>;
  const status = String(raw.status ?? 'PENDING');
  return {
    status,
    ready: isArtifactReady(status),
    generatedAt: raw.generated_at as string | undefined,
    sha256: raw.artifact_sha256 as string | undefined,
    eceBefore: raw.ece_before as number | undefined,
    eceAfter: raw.ece_after as number | undefined,
    brierBefore: raw.brier_before as number | undefined,
    brierAfter: raw.brier_after as number | undefined,
    temperature: raw.temperature as number | undefined,
    assessment: raw.calibration_assessment as string | undefined,
    sampleConfidences: raw.sample_confidences as CalibrationArtifact['sampleConfidences'],
  };
}

function extractArtifactSize(md: string): string {
  const match = md.match(/INT8 ONNX.*?\|\s*([\d.,]+\s*bytes)\s*\|/i);
  if (match) return match[1].trim();
  const fallback = md.match(/INT8 ONNX.*?\(\s*([\d.,]+\s*bytes)\s*\)/i);
  return fallback ? fallback[1].trim() : '—';
}

function extractQuantizationInfo(md: string): QuantizationInfo {
  const sizeText = extractArtifactSize(md);
  const baselineMatch = md.match(/Sklearn pipeline accuracy:\s*([\d.]+)/i);
  const int8Match = md.match(/INT8 ONNX accuracy:\s*([\d.]+)/i);
  const baselineAccuracy = baselineMatch ? parseFloat(baselineMatch[1]) : undefined;
  const int8Accuracy = int8Match ? parseFloat(int8Match[1]) : undefined;
  const delta = baselineAccuracy != null && int8Accuracy != null
    ? int8Accuracy - baselineAccuracy
    : undefined;
  return { sizeText, baselineAccuracy, int8Accuracy, delta };
}

export function loadArtifactMeta(): ModelMetaArtifact {
  return modelMetaArtifact();
}

export const artifacts = {
  eval: evalArtifact(),
  confusion: confusionArtifact(),
  latency: latencyArtifact(),
  probes: probeArtifact(),
  modelMeta: modelMetaArtifact(),
  quantization: extractQuantizationInfo(quantizationMd),
  calibration: calibrationArtifact(),
};
