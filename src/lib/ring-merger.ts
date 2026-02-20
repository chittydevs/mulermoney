import type { FraudRing } from './types';

/**
 * Merge rings that share ≥ 70% member overlap.
 * Also removes subset rings (A ⊂ B → discard A).
 */
export function mergeOverlappingRings(rings: FraudRing[]): FraudRing[] {
  if (rings.length === 0) return [];

  // Build member sets
  const memberSets = rings.map(r => new Set(r.member_accounts));

  // Track which rings are merged into others
  const merged = new Array(rings.length).fill(false);
  const groups: number[][] = [];

  for (let i = 0; i < rings.length; i++) {
    if (merged[i]) continue;
    const group = [i];
    merged[i] = true;

    for (let j = i + 1; j < rings.length; j++) {
      if (merged[j]) continue;

      const overlap = intersection(memberSets[i], memberSets[j]);
      const overlapRatioI = overlap / memberSets[i].size;
      const overlapRatioJ = overlap / memberSets[j].size;

      // Subset: if A ⊂ B or B ⊂ A, merge
      // Or if ≥ 70% overlap on either side
      if (overlapRatioI >= 0.7 || overlapRatioJ >= 0.7) {
        group.push(j);
        merged[j] = true;
        // Expand the reference set to the union for transitive merging
        for (const m of memberSets[j]) memberSets[i].add(m);
      }
    }

    groups.push(group);
  }

  // Build merged rings
  const result: FraudRing[] = [];
  let ringCounter = 0;

  for (const group of groups) {
    ringCounter++;
    const unionMembers = new Set<string>();
    const patterns = new Set<string>();
    let maxRisk = 0;

    for (const idx of group) {
      for (const m of rings[idx].member_accounts) unionMembers.add(m);
      patterns.add(rings[idx].pattern_type);
      maxRisk = Math.max(maxRisk, rings[idx].risk_score);
    }

    // Use highest severity pattern
    const patternType = selectHighestSeverity(patterns);

    result.push({
      ring_id: `RING_${String(ringCounter).padStart(3, '0')}`,
      member_accounts: Array.from(unionMembers).sort(),
      pattern_type: patternType,
      risk_score: maxRisk, // Will be recalculated after scoring
    });
  }

  return result;
}

function intersection(a: Set<string>, b: Set<string>): number {
  let count = 0;
  for (const item of a) {
    if (b.has(item)) count++;
  }
  return count;
}

const SEVERITY_ORDER = [
  'shell_network',
  'cycle_length_5',
  'cycle_length_4',
  'cycle_length_3',
  'fan_in_72h',
  'fan_out_72h',
];

function selectHighestSeverity(patterns: Set<string>): string {
  for (const p of SEVERITY_ORDER) {
    if (patterns.has(p)) return p;
  }
  // Fallback: return first pattern that contains a known keyword
  for (const p of patterns) {
    if (p.includes('cycle')) return p;
    if (p.includes('fan')) return p;
    if (p.includes('shell')) return p;
  }
  return Array.from(patterns)[0] || 'unknown';
}
