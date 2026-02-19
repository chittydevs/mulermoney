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

// ─── CYCLE DETECTION (DFS-based, length 3-5) ───

export function detectCycles(graph: TransactionGraph): FraudRing[] {
  const rings: FraudRing[] = [];
  const allCycles: string[][] = [];
  const nodeIds = Array.from(graph.nodes.keys());

  for (const startNode of nodeIds) {
    const visited = new Set<string>();
    const path: string[] = [];
    dfs(graph, startNode, startNode, path, visited, allCycles, 5);
  }

  // Deduplicate cycles (normalize by sorting)
  const seen = new Set<string>();
  for (const cycle of allCycles) {
    const key = normalizeCycle(cycle);
    if (!seen.has(key)) {
      seen.add(key);
      const ringId = nextRingId();
      const riskScore = computeCycleRisk(graph, cycle);
      rings.push({
        ring_id: ringId,
        member_accounts: [...cycle],
        pattern_type: `cycle_length_${cycle.length}`,
        risk_score: Math.round(riskScore * 10) / 10,
      });

      // Mark nodes
      for (const nodeId of cycle) {
        const node = graph.nodes.get(nodeId)!;
        node.isSuspicious = true;
        node.detectedPatterns.push(`cycle_length_${cycle.length}`);
        node.ringIds.push(ringId);
      }
    }
  }

  return rings;
}

function dfs(
  graph: TransactionGraph,
  start: string,
  current: string,
  path: string[],
  visited: Set<string>,
  results: string[][],
  maxLen: number
) {
  if (path.length > maxLen) return;

  path.push(current);
  visited.add(current);

  for (const neighbor of graph.getNeighbors(current)) {
    if (neighbor === start && path.length >= 3) {
      results.push([...path]);
    } else if (!visited.has(neighbor) && path.length < maxLen) {
      dfs(graph, start, neighbor, path, visited, results, maxLen);
    }
  }

  path.pop();
  visited.delete(current);
}

function normalizeCycle(cycle: string[]): string {
  const rotations: string[] = [];
  for (let i = 0; i < cycle.length; i++) {
    const rotated = [...cycle.slice(i), ...cycle.slice(0, i)];
    rotations.push(rotated.join('->'));
  }
  return rotations.sort()[0];
}

function computeCycleRisk(graph: TransactionGraph, cycle: string[]): number {
  let score = 50;
  // Shorter cycles are more suspicious
  if (cycle.length === 3) score += 20;
  else if (cycle.length === 4) score += 10;

  // Check transaction velocity between cycle members
  let totalTx = 0;
  for (let i = 0; i < cycle.length; i++) {
    const from = cycle[i];
    const to = cycle[(i + 1) % cycle.length];
    const edge = graph.edges.get(`${from}->${to}`);
    if (edge) totalTx += edge.count;
  }
  if (totalTx > cycle.length * 2) score += 15;

  // Amount consistency
  const amounts: number[] = [];
  for (let i = 0; i < cycle.length; i++) {
    const from = cycle[i];
    const to = cycle[(i + 1) % cycle.length];
    const edge = graph.edges.get(`${from}->${to}`);
    if (edge) amounts.push(edge.totalAmount / edge.count);
  }
  if (amounts.length > 1) {
    const avg = amounts.reduce((a, b) => a + b, 0) / amounts.length;
    const variance = amounts.reduce((s, a) => s + Math.pow(a - avg, 2), 0) / amounts.length;
    const cv = Math.sqrt(variance) / (avg || 1);
    if (cv < 0.3) score += 10; // Consistent amounts are more suspicious
  }

  return Math.min(100, score);
}

// ─── SMURFING DETECTION (Fan-in / Fan-out) ───

export function detectSmurfing(graph: TransactionGraph): FraudRing[] {
  const rings: FraudRing[] = [];
  const WINDOW_MS = 72 * 60 * 60 * 1000; // 72 hours
  const THRESHOLD = 10;

  for (const [nodeId, node] of graph.nodes) {
    // Fan-in: many senders -> this node within window
    const incomingSenders = graph.getIncoming(nodeId);
    if (incomingSenders.length >= THRESHOLD) {
      const windows = getTemporalWindows(graph, incomingSenders, nodeId, 'incoming', WINDOW_MS);
      for (const window of windows) {
        if (window.senders.size >= THRESHOLD && !isLegitimate(node)) {
          const ringId = nextRingId();
          const members = [nodeId, ...Array.from(window.senders)];
          rings.push({
            ring_id: ringId,
            member_accounts: members,
            pattern_type: 'fan_in_smurfing',
            risk_score: Math.round(Math.min(100, 60 + window.senders.size * 2) * 10) / 10,
          });
          node.isSuspicious = true;
          node.detectedPatterns.push('fan_in_smurfing');
          node.ringIds.push(ringId);
          for (const s of window.senders) {
            const sNode = graph.nodes.get(s)!;
            sNode.isSuspicious = true;
            sNode.detectedPatterns.push('fan_in_smurfing');
            sNode.ringIds.push(ringId);
          }
        }
      }
    }

    // Fan-out: this node -> many receivers within window
    const outgoingReceivers = graph.getNeighbors(nodeId);
    if (outgoingReceivers.length >= THRESHOLD) {
      const windows = getTemporalWindows(graph, outgoingReceivers, nodeId, 'outgoing', WINDOW_MS);
      for (const window of windows) {
        if (window.senders.size >= THRESHOLD && !isLegitimate(node)) {
          const ringId = nextRingId();
          const members = [nodeId, ...Array.from(window.senders)];
          rings.push({
            ring_id: ringId,
            member_accounts: members,
            pattern_type: 'fan_out_smurfing',
            risk_score: Math.round(Math.min(100, 60 + window.senders.size * 2) * 10) / 10,
          });
          node.isSuspicious = true;
          node.detectedPatterns.push('fan_out_smurfing');
          node.ringIds.push(ringId);
          for (const s of window.senders) {
            const sNode = graph.nodes.get(s)!;
            sNode.isSuspicious = true;
            sNode.detectedPatterns.push('fan_out_smurfing');
            sNode.ringIds.push(ringId);
          }
        }
      }
    }
  }

  return rings;
}

interface TemporalWindow {
  senders: Set<string>;
}

function getTemporalWindows(
  graph: TransactionGraph,
  counterparts: string[],
  nodeId: string,
  direction: 'incoming' | 'outgoing',
  windowMs: number
): TemporalWindow[] {
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

  const windows: TemporalWindow[] = [];
  if (txs.length === 0) return windows;

  // Sliding window
  let start = 0;
  const senders = new Set<string>();
  for (let end = 0; end < txs.length; end++) {
    senders.add(txs[end].counterpart);
    while (txs[end].timestamp - txs[start].timestamp > windowMs) {
      start++;
    }
    // Recompute senders in window
    const windowSenders = new Set<string>();
    for (let i = start; i <= end; i++) {
      windowSenders.add(txs[i].counterpart);
    }
    if (windowSenders.size >= 10) {
      windows.push({ senders: windowSenders });
      return windows; // One window is enough
    }
  }

  return windows;
}

function isLegitimate(node: import('./types').GraphNode): boolean {
  const totalTx = node.inDegree + node.outDegree;
  // High volume with consistent long-term activity
  if (totalTx > 100) return true;
  return false;
}

// ─── SHELL NETWORK DETECTION ───

export function detectShellNetworks(graph: TransactionGraph): FraudRing[] {
  const rings: FraudRing[] = [];
  const MIN_HOPS = 3;

  for (const [startId] of graph.nodes) {
    const visited = new Set<string>();
    const chains = findShellChains(graph, startId, [], visited, MIN_HOPS);
    
    for (const chain of chains) {
      const intermediates = chain.slice(1, -1);
      const allShell = intermediates.every(id => {
        const total = graph.getTotalTransactions(id);
        return total >= 2 && total <= 3;
      });

      if (allShell && hasRapidForwarding(graph, chain)) {
        const ringId = nextRingId();
        rings.push({
          ring_id: ringId,
          member_accounts: [...chain],
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
  current: string,
  path: string[],
  visited: Set<string>,
  minLen: number,
  maxLen: number = 6
): string[][] {
  const results: string[][] = [];
  path.push(current);
  visited.add(current);

  if (path.length >= minLen) {
    results.push([...path]);
  }

  if (path.length < maxLen) {
    for (const neighbor of graph.getNeighbors(current)) {
      if (!visited.has(neighbor)) {
        const neighborTotal = graph.getTotalTransactions(neighbor);
        // Only follow through low-activity intermediates
        if (neighborTotal <= 3 || path.length === 0) {
          results.push(...findShellChains(graph, neighbor, path, visited, minLen, maxLen));
        }
      }
    }
  }

  path.pop();
  visited.delete(current);
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
      if (diffHours < 24) return true;
    }
  }
  return false;
}
