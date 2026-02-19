import type { Transaction, DetectionResult, AnalysisProgress } from './types';
import { TransactionGraph } from './graph-engine';
import { detectCycles, detectSmurfing, detectShellNetworks, resetRingCounter } from './detection-engine';
import { computeSuspicionScores } from './scoring-engine';

export async function analyzeTransactions(
  transactions: Transaction[],
  onProgress: (p: AnalysisProgress) => void
): Promise<DetectionResult> {
  const startTime = performance.now();
  resetRingCounter();

  onProgress({ stage: 'Building transaction graph...', percent: 10 });
  await tick();

  const graph = new TransactionGraph(transactions);

  onProgress({ stage: 'Detecting circular fund routing...', percent: 25 });
  await tick();

  const cycleRings = detectCycles(graph);

  onProgress({ stage: 'Detecting smurfing patterns...', percent: 50 });
  await tick();

  const smurfRings = detectSmurfing(graph);

  onProgress({ stage: 'Detecting shell networks...', percent: 70 });
  await tick();

  const shellRings = detectShellNetworks(graph);

  onProgress({ stage: 'Computing suspicion scores...', percent: 85 });
  await tick();

  computeSuspicionScores(graph);

  onProgress({ stage: 'Generating results...', percent: 95 });
  await tick();

  const allRings = [...cycleRings, ...smurfRings, ...shellRings];
  
  const suspiciousAccounts = graph.getNodeArray()
    .filter(n => n.isSuspicious)
    .sort((a, b) => b.suspicionScore - a.suspicionScore)
    .map(n => ({
      account_id: n.id,
      suspicion_score: n.suspicionScore,
      detected_patterns: [...new Set(n.detectedPatterns)],
      ring_id: n.ringIds[0] || null,
    }));

  const elapsed = (performance.now() - startTime) / 1000;

  onProgress({ stage: 'Analysis complete', percent: 100 });

  return {
    suspicious_accounts: suspiciousAccounts,
    fraud_rings: allRings,
    summary: {
      total_accounts_analyzed: graph.nodes.size,
      suspicious_accounts_flagged: suspiciousAccounts.length,
      fraud_rings_detected: allRings.length,
      processing_time_seconds: Math.round(elapsed * 10) / 10,
    },
    graph: {
      nodes: graph.getNodeArray(),
      edges: graph.getEdgeArray(),
    },
  };
}

function tick(): Promise<void> {
  return new Promise(resolve => setTimeout(resolve, 10));
}
