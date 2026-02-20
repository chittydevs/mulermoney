import type { TransactionGraph } from './graph-engine';
import type { FraudRing } from './types';

/**
 * Upgraded weighted scoring model.
 * Base = 20, pattern bonuses, capped at 100.
 */
export function computeSuspicionScores(graph: TransactionGraph): void {
  const nodes = graph.getNodeArray();

  for (const node of nodes) {
    if (!node.isSuspicious) {
      node.suspicionScore = 0;
      continue;
    }

    let score = 20; // Base score

    const patterns = new Set(node.detectedPatterns);

    // Pattern-based scoring
    if (patterns.has('cycle_length_3')) score += 20;
    if (patterns.has('cycle_length_4')) score += 30;
    if (patterns.has('cycle_length_5')) score += 40;
    if (patterns.has('fan_in_72h')) score += 35;
    if (patterns.has('fan_out_72h')) score += 35;
    if (patterns.has('shell_network')) score += 25;

    // Multiple ring membership bonus
    const uniqueRings = new Set(node.ringIds);
    if (uniqueRings.size > 1) score += 10;

    // False positive reduction: no 72-hour clustering → reduce
    if (node.transactions.length > 2) {
      const timestamps = node.transactions.map(t => t.timestamp.getTime()).sort();
      let hasClustering = false;
      for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] - timestamps[i - 1] < 72 * 60 * 60 * 1000) {
          hasClustering = true;
          break;
        }
      }
      if (!hasClustering) score -= 10;
    }

    // False positive: only one-direction flow
    if ((node.inDegree === 0 || node.outDegree === 0) && !patterns.has('fan_in_72h') && !patterns.has('fan_out_72h')) {
      score -= 5;
    }

    node.suspicionScore = Math.round(Math.min(100, Math.max(0, score)) * 10) / 10;
  }
}

/**
 * Recalculate ring risk scores as average of member suspicion scores.
 * Longer cycles produce higher risk.
 */
export function computeRingRiskScores(graph: TransactionGraph, rings: FraudRing[]): void {
  for (const ring of rings) {
    let totalScore = 0;
    let count = 0;
    for (const memberId of ring.member_accounts) {
      const node = graph.nodes.get(memberId);
      if (node) {
        totalScore += node.suspicionScore;
        count++;
      }
    }
    if (count > 0) {
      ring.risk_score = Math.round((totalScore / count) * 10) / 10;
    }
  }
}
