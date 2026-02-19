import type { Transaction, GraphNode, GraphEdge } from './types';

export class TransactionGraph {
  nodes: Map<string, GraphNode> = new Map();
  edges: Map<string, GraphEdge> = new Map();
  adjacency: Map<string, Set<string>> = new Map();
  reverseAdjacency: Map<string, Set<string>> = new Map();

  constructor(transactions: Transaction[]) {
    this.build(transactions);
  }

  private build(transactions: Transaction[]) {
    for (const tx of transactions) {
      this.ensureNode(tx.sender_id);
      this.ensureNode(tx.receiver_id);

      const senderNode = this.nodes.get(tx.sender_id)!;
      senderNode.outDegree++;
      senderNode.totalOut += tx.amount;
      senderNode.transactions.push(tx);

      const receiverNode = this.nodes.get(tx.receiver_id)!;
      receiverNode.inDegree++;
      receiverNode.totalIn += tx.amount;
      receiverNode.transactions.push(tx);

      const edgeKey = `${tx.sender_id}->${tx.receiver_id}`;
      if (!this.edges.has(edgeKey)) {
        this.edges.set(edgeKey, {
          source: tx.sender_id,
          target: tx.receiver_id,
          transactions: [],
          totalAmount: 0,
          count: 0,
        });
      }
      const edge = this.edges.get(edgeKey)!;
      edge.transactions.push(tx);
      edge.totalAmount += tx.amount;
      edge.count++;

      if (!this.adjacency.has(tx.sender_id)) this.adjacency.set(tx.sender_id, new Set());
      this.adjacency.get(tx.sender_id)!.add(tx.receiver_id);

      if (!this.reverseAdjacency.has(tx.receiver_id)) this.reverseAdjacency.set(tx.receiver_id, new Set());
      this.reverseAdjacency.get(tx.receiver_id)!.add(tx.sender_id);
    }
  }

  private ensureNode(id: string) {
    if (!this.nodes.has(id)) {
      this.nodes.set(id, {
        id,
        inDegree: 0,
        outDegree: 0,
        totalIn: 0,
        totalOut: 0,
        transactions: [],
        isSuspicious: false,
        suspicionScore: 0,
        detectedPatterns: [],
        ringIds: [],
      });
    }
  }

  getNeighbors(nodeId: string): string[] {
    return Array.from(this.adjacency.get(nodeId) || []);
  }

  getIncoming(nodeId: string): string[] {
    return Array.from(this.reverseAdjacency.get(nodeId) || []);
  }

  getNodeArray(): GraphNode[] {
    return Array.from(this.nodes.values());
  }

  getEdgeArray(): GraphEdge[] {
    return Array.from(this.edges.values());
  }

  getTotalTransactions(nodeId: string): number {
    const node = this.nodes.get(nodeId);
    return node ? node.inDegree + node.outDegree : 0;
  }
}
