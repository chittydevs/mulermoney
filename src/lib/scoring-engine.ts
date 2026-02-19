import type { TransactionGraph } from './graph-engine';
import type { GraphNode } from './types';

export function computeSuspicionScores(graph: TransactionGraph): void {
  const nodes = graph.getNodeArray();
  
  // Compute betweenness centrality (approximated for performance)
  const betweenness = approximateBetweenness(graph);
  
  // Compute max degree for normalization
  const maxDegree = Math.max(1, ...nodes.map(n => n.inDegree + n.outDegree));
  const maxBetweenness = Math.max(1, ...Array.from(betweenness.values()));

  for (const node of nodes) {
    if (!node.isSuspicious) {
      node.suspicionScore = 0;
      continue;
    }

    let score = 0;

    // Pattern count (0-30 points)
    const uniquePatterns = new Set(node.detectedPatterns);
    score += Math.min(30, uniquePatterns.size * 12);

    // Ring membership (0-20 points)
    const uniqueRings = new Set(node.ringIds);
    score += Math.min(20, uniqueRings.size * 8);

    // Transaction velocity (0-15 points)
    const txCount = node.inDegree + node.outDegree;
    const velocity = txCount / maxDegree;
    score += velocity * 15;

    // Amount anomaly (0-15 points)
    if (node.transactions.length > 0) {
      const amounts = node.transactions.map(t => t.amount);
      const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
      const variance = amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amounts.length;
      const cv = Math.sqrt(variance) / (avg || 1);
      // Very consistent amounts are suspicious (structured transactions)
      if (cv < 0.2) score += 15;
      else if (cv < 0.5) score += 8;
    }

    // Centrality (0-10 points)
    const bc = betweenness.get(node.id) || 0;
    score += (bc / maxBetweenness) * 10;

    // Temporal clustering (0-10 points)
    if (node.transactions.length > 2) {
      const timestamps = node.transactions.map(t => t.timestamp.getTime()).sort();
      let clustered = 0;
      for (let i = 1; i < timestamps.length; i++) {
        if (timestamps[i] - timestamps[i - 1] < 3600000) clustered++; // within 1 hour
      }
      score += Math.min(10, (clustered / timestamps.length) * 15);
    }

    node.suspicionScore = Math.round(Math.min(100, score) * 10) / 10;
  }
}

function approximateBetweenness(graph: TransactionGraph): Map<string, number> {
  const bc = new Map<string, number>();
  const nodeIds = Array.from(graph.nodes.keys());
  
  for (const id of nodeIds) bc.set(id, 0);

  // Sample subset for performance (max 200 nodes)
  const sampleSize = Math.min(nodeIds.length, 200);
  const sample = nodeIds.slice(0, sampleSize);

  for (const source of sample) {
    const dist = new Map<string, number>();
    const sigma = new Map<string, number>();
    const pred = new Map<string, string[]>();
    const delta = new Map<string, number>();
    
    for (const id of nodeIds) {
      dist.set(id, -1);
      sigma.set(id, 0);
      pred.set(id, []);
      delta.set(id, 0);
    }

    dist.set(source, 0);
    sigma.set(source, 1);
    
    const queue: string[] = [source];
    const stack: string[] = [];

    while (queue.length > 0) {
      const v = queue.shift()!;
      stack.push(v);

      for (const w of graph.getNeighbors(v)) {
        if (dist.get(w)! < 0) {
          queue.push(w);
          dist.set(w, dist.get(v)! + 1);
        }
        if (dist.get(w) === dist.get(v)! + 1) {
          sigma.set(w, sigma.get(w)! + sigma.get(v)!);
          pred.get(w)!.push(v);
        }
      }
    }

    while (stack.length > 0) {
      const w = stack.pop()!;
      for (const v of pred.get(w)!) {
        delta.set(v, delta.get(v)! + (sigma.get(v)! / sigma.get(w)!) * (1 + delta.get(w)!));
      }
      if (w !== source) {
        bc.set(w, bc.get(w)! + delta.get(w)!);
      }
    }
  }

  return bc;
}
