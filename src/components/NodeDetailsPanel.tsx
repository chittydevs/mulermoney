import { motion } from 'framer-motion';
import { X, AlertTriangle, ArrowDownLeft, ArrowUpRight } from 'lucide-react';
import type { DetectionResult } from '@/lib/types';

interface NodeDetailsPanelProps {
  result: DetectionResult;
  nodeId: string;
  onClose: () => void;
}

export default function NodeDetailsPanel({ result, nodeId, onClose }: NodeDetailsPanelProps) {
  const node = result.graph.nodes.find(n => n.id === nodeId);
  const account = result.suspicious_accounts.find(a => a.account_id === nodeId);
  const rings = result.fraud_rings.filter(r => r.member_accounts.includes(nodeId));

  if (!node) return null;

  const recentTx = [...node.transactions]
    .sort((a, b) => b.timestamp.getTime() - a.timestamp.getTime())
    .slice(0, 20);

  return (
    <motion.div
      initial={{ opacity: 0, x: 20 }}
      animate={{ opacity: 1, x: 0 }}
      className="flex h-full flex-col overflow-hidden"
    >
      <div className="flex items-center justify-between border-b border-border p-3">
        <div>
          <p className="font-mono text-sm font-bold text-foreground">{nodeId}</p>
          <p className="text-[10px] text-muted-foreground">Account Details</p>
        </div>
        <button onClick={onClose} className="rounded p-1 text-muted-foreground hover:bg-secondary hover:text-foreground">
          <X className="h-4 w-4" />
        </button>
      </div>

      <div className="flex-1 overflow-y-auto p-3 space-y-4">
        {/* Score */}
        {account && (
          <div className={`rounded-md border p-3 ${
            account.suspicion_score >= 70 ? 'border-danger/50 bg-danger/10' :
            account.suspicion_score >= 40 ? 'border-accent/50 bg-accent/10' :
            'border-primary/50 bg-primary/10'
          }`}>
            <div className="flex items-center gap-2">
              <AlertTriangle className={`h-4 w-4 ${
                account.suspicion_score >= 70 ? 'text-danger' : account.suspicion_score >= 40 ? 'text-accent' : 'text-primary'
              }`} />
              <span className="text-xs font-medium text-foreground">Suspicion Score</span>
            </div>
            <p className="mt-1 font-mono text-3xl font-black text-foreground">{account.suspicion_score}</p>
            <div className="mt-2 flex flex-wrap gap-1">
              {account.detected_patterns.map(p => (
                <span key={p} className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{p}</span>
              ))}
            </div>
          </div>
        )}

        {/* Stats */}
        <div className="grid grid-cols-2 gap-2">
          {[
            { label: 'In-Degree', value: node.inDegree },
            { label: 'Out-Degree', value: node.outDegree },
            { label: 'Total In', value: `$${node.totalIn.toLocaleString()}` },
            { label: 'Total Out', value: `$${node.totalOut.toLocaleString()}` },
          ].map(s => (
            <div key={s.label} className="rounded-sm border border-border bg-card p-2">
              <p className="text-[9px] uppercase text-muted-foreground">{s.label}</p>
              <p className="font-mono text-sm font-bold text-foreground">{s.value}</p>
            </div>
          ))}
        </div>

        {/* Rings */}
        {rings.length > 0 && (
          <div>
            <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Fraud Rings</p>
            {rings.map(ring => (
              <div key={ring.ring_id} className="mb-1.5 rounded-sm border border-border bg-secondary/30 p-2">
                <div className="flex items-center justify-between">
                  <span className="font-mono text-xs text-foreground">{ring.ring_id}</span>
                  <span className="font-mono text-xs text-danger">{ring.risk_score}</span>
                </div>
                <p className="text-[9px] text-muted-foreground">{ring.pattern_type} • {ring.member_accounts.length} members</p>
              </div>
            ))}
          </div>
        )}

        {/* Transaction history */}
        <div>
          <p className="mb-2 text-[10px] uppercase tracking-wider text-muted-foreground">Recent Transactions</p>
          <div className="space-y-1">
            {recentTx.map(tx => {
              const isSender = tx.sender_id === nodeId;
              return (
                <div key={tx.transaction_id} className="flex items-center gap-2 rounded-sm border border-border bg-card p-2">
                  {isSender ? (
                    <ArrowUpRight className="h-3 w-3 flex-shrink-0 text-danger" />
                  ) : (
                    <ArrowDownLeft className="h-3 w-3 flex-shrink-0 text-success" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-mono text-[10px] text-foreground">
                      {isSender ? `→ ${tx.receiver_id}` : `← ${tx.sender_id}`}
                    </p>
                    <p className="text-[9px] text-muted-foreground">{tx.timestamp.toLocaleString()}</p>
                  </div>
                  <span className={`font-mono text-xs font-medium ${isSender ? 'text-danger' : 'text-success'}`}>
                    ${tx.amount.toLocaleString()}
                  </span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </motion.div>
  );
}
