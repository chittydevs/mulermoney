import type { FraudRing } from './types';

/**
 * Deduplicate and merge fraud rings:
 * 1. Remove exact duplicate member sets (across detectors)
 * 2. Remove subset rings (A ⊂ B → discard A)
 * 3. Merge rings sharing ≥ 50% member overlap using union-find for transitive closure
 */
export function mergeOverlappingRings(rings: FraudRing[]): FraudRing[] {
  if (rings.length === 0) return [];

  // ── Step 1: Exact dedup by canonical member key ──
  const uniqueMap = new Map<string, FraudRing>();
  for (const ring of rings) {
    const key = [...ring.member_accounts].sort().join(',');
    const existing = uniqueMap.get(key);
    if (!existing || SEVERITY_RANK[ring.pattern_type] < SEVERITY_RANK[existing.pattern_type]) {
      uniqueMap.set(key, { ...ring, member_accounts: [...ring.member_accounts].sort() });
    }
  }
  let deduped = Array.from(uniqueMap.values());

  // ── Step 2: Remove subsets ──
  const memberSets = deduped.map(r => new Set(r.member_accounts));
  const isSubset = new Array(deduped.length).fill(false);

  for (let i = 0; i < deduped.length; i++) {
    if (isSubset[i]) continue;
    for (let j = 0; j < deduped.length; j++) {
      if (i === j || isSubset[j]) continue;
      if (memberSets[i].size < memberSets[j].size && isSubsetOf(memberSets[i], memberSets[j])) {
        isSubset[i] = true;
        break;
      }
    }
  }
  deduped = deduped.filter((_, i) => !isSubset[i]);

  // ── Step 3: Union-Find merge for ≥ 50% overlap ──
  const n = deduped.length;
  const parent = Array.from({ length: n }, (_, i) => i);

  function find(x: number): number {
    while (parent[x] !== x) { parent[x] = parent[parent[x]]; x = parent[x]; }
    return x;
  }
  function union(a: number, b: number) {
    const ra = find(a), rb = find(b);
    if (ra !== rb) parent[ra] = rb;
  }

  const sets = deduped.map(r => new Set(r.member_accounts));

  for (let i = 0; i < n; i++) {
    for (let j = i + 1; j < n; j++) {
      const overlap = intersection(sets[i], sets[j]);
      const ratioI = overlap / sets[i].size;
      const ratioJ = overlap / sets[j].size;
      // Merge if ≥ 50% overlap on either side, or one is subset of the other
      if (ratioI >= 0.5 || ratioJ >= 0.5) {
        union(i, j);
      }
    }
  }

  // Group by root
  const groups = new Map<number, number[]>();
  for (let i = 0; i < n; i++) {
    const root = find(i);
    if (!groups.has(root)) groups.set(root, []);
    groups.get(root)!.push(i);
  }

  // Build merged rings
  const result: FraudRing[] = [];
  let ringCounter = 0;

  for (const group of groups.values()) {
    ringCounter++;
    const unionMembers = new Set<string>();
    const patterns = new Set<string>();
    let maxRisk = 0;

    for (const idx of group) {
      for (const m of deduped[idx].member_accounts) unionMembers.add(m);
      patterns.add(deduped[idx].pattern_type);
      maxRisk = Math.max(maxRisk, deduped[idx].risk_score);
    }

    result.push({
      ring_id: `RING_${String(ringCounter).padStart(3, '0')}`,
      member_accounts: Array.from(unionMembers).sort(),
      pattern_type: selectHighestSeverity(patterns),
      risk_score: maxRisk,
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

function isSubsetOf(a: Set<string>, b: Set<string>): boolean {
  for (const item of a) {
    if (!b.has(item)) return false;
  }
  return true;
}

const SEVERITY_ORDER = [
  'shell_network',
  'cycle_length_5',
  'cycle_length_4',
  'cycle_length_3',
  'fan_in_72h',
  'fan_out_72h',
];

const SEVERITY_RANK: Record<string, number> = {};
SEVERITY_ORDER.forEach((p, i) => { SEVERITY_RANK[p] = i; });

function selectHighestSeverity(patterns: Set<string>): string {
  for (const p of SEVERITY_ORDER) {
    if (patterns.has(p)) return p;
  }
  return Array.from(patterns)[0] || 'unknown';
}
