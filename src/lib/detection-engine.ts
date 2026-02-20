import type { TransactionGraph } from './graph-engine';
import type { FraudRing, Transaction } from './types';

let ringCounter = 0;

export function resetRingCounter() {
  ringCounter = 0;
}

function nextRingId(): string {
  ringCounter++;
  return `RING_${String(ringCounter).padStart(3, '0')}`;
}

// ─── CYCLE DETECTION (Iterative DFS, length 3-5) ───

export function detectCycles(graph: TransactionGraph): FraudRing[] {
  const rings: FraudRing[] = [];
  const allCycles: string[][] = [];
  const nodeIds = Array.from(graph.nodes.keys());

  for (const startNode of nodeIds) {
    // Iterative DFS with explicit stack
    const stack: { current: string; path: string[]; visited: Set<string> }[] = [];
    stack.push({ current: startNode, path: [], visited: new Set() });

    while (stack.length > 0) {
      const { current, path, visited } = stack.pop()!;
      
      if (path.length > 5) continue;

      const newPath = [...path, current];
      const newVisited = new Set(visited);
      newVisited.add(current);

      for (const neighbor of graph.getNeighbors(current)) {
        if (neighbor === startNode && newPath.length >= 3) {
          allCycles.push([...newPath]);
        } else if (!newVisited.has(neighbor) && newPath.length < 5) {
          stack.push({ current: neighbor, path: newPath, visited: newVisited });
        }
      }
    }
  }

  // Deduplicate: canonical key = sorted members
  const seen = new Set<string>();
  const candidateCycles: { key: string; cycle: string[] }[] = [];

  for (const cycle of allCycles) {
    const sorted = [...cycle].sort();
    const key = sorted.join(',');
    if (!seen.has(key)) {
      seen.add(key);
      candidateCycles.push({ key, cycle: sorted });
    }
  }

  // Remove subset cycles: if cycle A members ⊂ cycle B members, discard A
  const memberSets = candidateCycles.map(c => new Set(c.cycle));
  const isSubset = new Array(candidateCycles.length).fill(false);

  for (let i = 0; i < candidateCycles.length; i++) {
    if (isSubset[i]) continue;
    for (let j = 0; j < candidateCycles.length; j++) {
      if (i === j || isSubset[j]) continue;
      if (memberSets[i].size < memberSets[j].size) {
        // Check if i is subset of j
        let allIn = true;
        for (const m of memberSets[i]) {
          if (!memberSets[j].has(m)) { allIn = false; break; }
        }
        if (allIn) isSubset[i] = true;
      }
    }
  }

  for (let i = 0; i < candidateCycles.length; i++) {
    if (isSubset[i]) continue;
    const cycle = candidateCycles[i].cycle;
    const ringId = nextRingId();
    const riskScore = computeCycleRisk(graph, cycle);
    
    rings.push({
      ring_id: ringId,
      member_accounts: cycle,
      pattern_type: `cycle_length_${cycle.length}`,
      risk_score: Math.round(riskScore * 10) / 10,
    });

    for (const nodeId of cycle) {
      const node = graph.nodes.get(nodeId)!;
      node.isSuspicious = true;
      node.detectedPatterns.push(`cycle_length_${cycle.length}`);
      node.ringIds.push(ringId);
    }
  }

  return rings;
}

function computeCycleRisk(graph: TransactionGraph, cycle: string[]): number {
  let score = 50;
  // Longer cycles = higher risk (layered laundering)
  if (cycle.length === 3) score += 15;
  else if (cycle.length === 4) score += 25;
  else if (cycle.length === 5) score += 35;

  // Transaction velocity
  let totalTx = 0;
  for (let i = 0; i < cycle.length; i++) {
    const from = cycle[i];
    const to = cycle[(i + 1) % cycle.length];
    const edge = graph.edges.get(`${from}->${to}`);
    if (edge) totalTx += edge.count;
  }
  if (totalTx > cycle.length * 2) score += 10;

  return Math.min(100, score);
}

// ─── SMURFING DETECTION (Fan-in / Fan-out with 72h window) ───

export function detectSmurfing(graph: TransactionGraph): FraudRing[] {
  const rings: FraudRing[] = [];
  const WINDOW_MS = 72 * 60 * 60 * 1000;
  const THRESHOLD = 10;
  const flaggedAggregators = new Set<string>(); // One ring per aggregator

  for (const [nodeId, node] of graph.nodes) {
    // Skip legitimate high-volume accounts
    if (isLegitimate(node)) continue;

    // Fan-in: many senders -> this node within 72h
    if (!flaggedAggregators.has(`in_${nodeId}`)) {
      const incomingSenders = graph.getIncoming(nodeId);
      if (incomingSenders.length >= THRESHOLD) {
        const windowSenders = getTemporalCounterparts(graph, incomingSenders, nodeId, 'incoming', WINDOW_MS);
        if (windowSenders && windowSenders.size >= THRESHOLD) {
          flaggedAggregators.add(`in_${nodeId}`);
          const ringId = nextRingId();
          const members = [nodeId, ...Array.from(windowSenders)].sort();
          rings.push({
            ring_id: ringId,
            member_accounts: members,
            pattern_type: 'fan_in_72h',
            risk_score: Math.round(Math.min(100, 60 + windowSenders.size * 2) * 10) / 10,
          });
          node.isSuspicious = true;
          node.detectedPatterns.push('fan_in_72h');
          node.ringIds.push(ringId);
          for (const s of windowSenders) {
            const sNode = graph.nodes.get(s)!;
            sNode.isSuspicious = true;
            sNode.detectedPatterns.push('fan_in_72h');
            sNode.ringIds.push(ringId);
          }
        }
      }
    }

    // Fan-out: this node -> many receivers within 72h
    if (!flaggedAggregators.has(`out_${nodeId}`)) {
      const outgoingReceivers = graph.getNeighbors(nodeId);
      if (outgoingReceivers.length >= THRESHOLD) {
        const windowReceivers = getTemporalCounterparts(graph, outgoingReceivers, nodeId, 'outgoing', WINDOW_MS);
        if (windowReceivers && windowReceivers.size >= THRESHOLD) {
          flaggedAggregators.add(`out_${nodeId}`);
          const ringId = nextRingId();
          const members = [nodeId, ...Array.from(windowReceivers)].sort();
          rings.push({
            ring_id: ringId,
            member_accounts: members,
            pattern_type: 'fan_out_72h',
            risk_score: Math.round(Math.min(100, 60 + windowReceivers.size * 2) * 10) / 10,
          });
          node.isSuspicious = true;
          node.detectedPatterns.push('fan_out_72h');
          node.ringIds.push(ringId);
          for (const s of windowReceivers) {
            const sNode = graph.nodes.get(s)!;
            sNode.isSuspicious = true;
            sNode.detectedPatterns.push('fan_out_72h');
            sNode.ringIds.push(ringId);
          }
        }
      }
    }
  }

  return rings;
}

function getTemporalCounterparts(
  graph: TransactionGraph,
  counterparts: string[],
  nodeId: string,
  direction: 'incoming' | 'outgoing',
  windowMs: number
): Set<string> | null {
  const txs: { counterpart: string; timestamp: number }[] = [];

  for (const cp of counterparts) {
    const edgeKey = direction === 'incoming' ? `${cp}->${nodeId}` : `${nodeId}->${cp}`;
    const edge = graph.edges.get(edgeKey);
    if (edge) {
      for (const tx of edge.transactions) {
        txs.push({ counterpart: cp, timestamp: tx.timestamp.getTime() });
      }
    }
  }

  txs.sort((a, b) => a.timestamp - b.timestamp);
  if (txs.length === 0) return null;

  // Sliding window
  let start = 0;
  let bestWindow: Set<string> | null = null;

  for (let end = 0; end < txs.length; end++) {
    while (txs[end].timestamp - txs[start].timestamp > windowMs) {
      start++;
    }
    const windowSenders = new Set<string>();
    for (let i = start; i <= end; i++) {
      windowSenders.add(txs[i].counterpart);
    }
    if (windowSenders.size >= 10) {
      if (!bestWindow || windowSenders.size > bestWindow.size) {
        bestWindow = windowSenders;
      }
    }
  }

  return bestWindow;
}

function isLegitimate(node: import('./types').GraphNode): boolean {
  const totalTx = node.inDegree + node.outDegree;
  if (totalTx > 100) return true;
  return false;
}

// ─── SHELL NETWORK DETECTION ───

export function detectShellNetworks(graph: TransactionGraph): FraudRing[] {
  const rings: FraudRing[] = [];
  const MIN_HOPS = 3;
  const seenChainKeys = new Set<string>();

  for (const [startId] of graph.nodes) {
    const chains = findShellChains(graph, startId, MIN_HOPS);
    
    for (const chain of chains) {
      const intermediates = chain.slice(1, -1);
      const allShell = intermediates.every(id => {
        const total = graph.getTotalTransactions(id);
        return total >= 2 && total <= 3;
      });

      if (allShell && hasRapidForwarding(graph, chain)) {
        const sorted = [...chain].sort();
        const key = sorted.join(',');
        if (seenChainKeys.has(key)) continue;
        seenChainKeys.add(key);

        const ringId = nextRingId();
        rings.push({
          ring_id: ringId,
          member_accounts: sorted,
          pattern_type: 'shell_network',
          risk_score: Math.round(Math.min(100, 55 + chain.length * 8) * 10) / 10,
        });

        for (const nodeId of chain) {
          const node = graph.nodes.get(nodeId)!;
          node.isSuspicious = true;
          node.detectedPatterns.push('shell_network');
          node.ringIds.push(ringId);
        }
      }
    }
  }

  return rings;
}

function findShellChains(
  graph: TransactionGraph,
  startId: string,
  minLen: number,
  maxLen: number = 6
): string[][] {
  const results: string[][] = [];
  // Iterative DFS
  const stack: { current: string; path: string[]; visited: Set<string> }[] = [];
  stack.push({ current: startId, path: [], visited: new Set() });

  while (stack.length > 0) {
    const { current, path, visited } = stack.pop()!;
    const newPath = [...path, current];
    const newVisited = new Set(visited);
    newVisited.add(current);

    if (newPath.length >= minLen) {
      results.push([...newPath]);
    }

    if (newPath.length < maxLen) {
      for (const neighbor of graph.getNeighbors(current)) {
        if (!newVisited.has(neighbor)) {
          const neighborTotal = graph.getTotalTransactions(neighbor);
          if (neighborTotal <= 3 || newPath.length === 1) {
            stack.push({ current: neighbor, path: newPath, visited: newVisited });
          }
        }
      }
    }
  }

  return results;
}

function hasRapidForwarding(graph: TransactionGraph, chain: string[]): boolean {
  for (let i = 0; i < chain.length - 2; i++) {
    const edge1 = graph.edges.get(`${chain[i]}->${chain[i + 1]}`);
    const edge2 = graph.edges.get(`${chain[i + 1]}->${chain[i + 2]}`);
    if (edge1 && edge2) {
      const lastIn = Math.max(...edge1.transactions.map(t => t.timestamp.getTime()));
      const firstOut = Math.min(...edge2.transactions.map(t => t.timestamp.getTime()));
      const diffHours = (firstOut - lastIn) / (1000 * 60 * 60);
      if (diffHours < 72) return true;
    }
  }
  return false;
}
