import { describe, expect, it } from 'vitest';
import { overallRisk } from '../../src/domain/risk.ts';

describe('overallRisk', () => {
  it('takes the max severity across interaction pairs', () => {
    expect(overallRisk([{ status: 'interaction', severity: 'minor' }, { status: 'interaction', severity: 'major' }])).toBe('high');
    expect(overallRisk([{ status: 'interaction', severity: 'moderate' }, { status: 'no_record' }])).toBe('medium');
    expect(overallRisk([{ status: 'interaction', severity: 'minor' }])).toBe('low');
  });
  it('missing severity counts as medium', () => {
    expect(overallRisk([{ status: 'interaction' }])).toBe('medium');
  });
  it('no interactions but unresolved/no_record is unknown, never none', () => {
    expect(overallRisk([{ status: 'no_record' }])).toBe('unknown');
    expect(overallRisk([{ status: 'unresolved' }, { status: 'no_record' }])).toBe('unknown');
  });
  it('none only when nothing to flag', () => {
    expect(overallRisk([])).toBe('none');
  });
});
