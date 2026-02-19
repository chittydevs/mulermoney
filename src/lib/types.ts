export interface Transaction {
  transaction_id: string;
  sender_id: string;
  receiver_id: string;
  amount: number;
  timestamp: Date;
}

export interface GraphNode {
  id: string;
  inDegree: number;
  outDegree: number;
  totalIn: number;
  totalOut: number;
  transactions: Transaction[];
  isSuspicious: boolean;
  suspicionScore: number;
  detectedPatterns: string[];
  ringIds: string[];
}

export interface GraphEdge {
  source: string;
  target: string;
  transactions: Transaction[];
  totalAmount: number;
  count: number;
}

export interface FraudRing {
  ring_id: string;
  member_accounts: string[];
  pattern_type: string;
  risk_score: number;
}

export interface SuspiciousAccount {
  account_id: string;
  suspicion_score: number;
  detected_patterns: string[];
  ring_id: string | null;
}

export interface DetectionResult {
  suspicious_accounts: SuspiciousAccount[];
  fraud_rings: FraudRing[];
  summary: {
    total_accounts_analyzed: number;
    suspicious_accounts_flagged: number;
    fraud_rings_detected: number;
    processing_time_seconds: number;
  };
  graph: {
    nodes: GraphNode[];
    edges: GraphEdge[];
  };
}

export interface AnalysisProgress {
  stage: string;
  percent: number;
}
