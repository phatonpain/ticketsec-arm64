// @vitest-environment jsdom
/**
 * D1 — src/lib/artifacts.ts unit tests.
 *
 * Verifies the centralized status normalization and that the committed
 * artifacts are surfaced as ready (they all carry 'COMPLETE' or 'OK').
 */
import { describe, expect, it } from 'vitest';
import { artifacts, isArtifactReady } from '../../src/lib/artifacts';

describe('isArtifactReady', () => {
  it('treats "COMPLETE" as ready', () => {
    expect(isArtifactReady('COMPLETE')).toBe(true);
  });

  it('treats "OK" as ready', () => {
    expect(isArtifactReady('OK')).toBe(true);
  });

  it('treats lowercase "complete" as ready', () => {
    expect(isArtifactReady('complete')).toBe(true);
  });

  it('treats "PENDING" as not ready', () => {
    expect(isArtifactReady('PENDING')).toBe(false);
  });

  it('treats empty/missing status as not ready', () => {
    expect(isArtifactReady('')).toBe(false);
    expect(isArtifactReady(undefined)).toBe(false);
    expect(isArtifactReady(null)).toBe(false);
  });

  it('treats unexpected statuses as not ready', () => {
    expect(isArtifactReady('FAILED')).toBe(false);
    expect(isArtifactReady('RUNNING')).toBe(false);
  });
});

describe('committed artifacts', () => {
  it('eval results are ready and expose accuracy + dataset size', () => {
    expect(artifacts.eval.ready).toBe(true);
    expect(artifacts.eval.overallAccuracy).toBeCloseTo(0.9294, 4);
    expect(artifacts.eval.datasetSize).toBe(3058);
    expect(artifacts.eval.testSize).toBe(609);
    expect(artifacts.eval.sha256).toMatch(/^[a-f0-9]{64}$/);
  });

  it('latency artifact is ready and exposes p50/p95/sample count', () => {
    expect(artifacts.latency.ready).toBe(true);
    expect(artifacts.latency.p50Ms).toBeGreaterThan(0);
    expect(artifacts.latency.p95Ms).toBeGreaterThan(0);
    expect(artifacts.latency.sampleCount).toBe(100);
    expect(artifacts.latency.host).toContain('Graviton');
  });

  it('confusion matrix is ready and has 6 labels', () => {
    expect(artifacts.confusion.ready).toBe(true);
    expect(artifacts.confusion.labels).toHaveLength(6);
    expect(artifacts.confusion.matrix).toHaveLength(6);
  });

  it('probe results are ready', () => {
    expect(artifacts.probes.ready).toBe(true);
    expect(artifacts.probes.results?.length).toBeGreaterThan(0);
  });

  it('model meta is ready and matches eval sha256', () => {
    expect(artifacts.modelMeta.ready).toBe(true);
    expect(artifacts.modelMeta.sizeMb).toBe(0.38);
    expect(artifacts.modelMeta.sha256).toBe(artifacts.eval.sha256);
  });

  it('quantization info is parsed from markdown', () => {
    expect(artifacts.quantization.sizeText).toMatch(/401[\s,]?872\s*bytes/i);
    expect(artifacts.quantization.baselineAccuracy).toBeCloseTo(0.9278, 4);
    expect(artifacts.quantization.int8Accuracy).toBeCloseTo(0.9294, 4);
    expect(artifacts.quantization.delta).toBeCloseTo(0.0016, 4);
  });
});
