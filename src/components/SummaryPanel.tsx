import { motion } from 'framer-motion';
import { Shield, Users, AlertTriangle, Clock, Activity, Network } from 'lucide-react';
import type { DetectionResult } from '@/lib/types';

interface SummaryPanelProps {
  result: DetectionResult;
  onAccountSelect: (id: string) => void;
}

export default function SummaryPanel({ result, onAccountSelect }: SummaryPanelProps) {
  const { summary, suspicious_accounts } = result;

  const stats = [
    { label: 'Accounts Analyzed', value: summary.total_accounts_analyzed, icon: Users, color: 'text-primary' },
    { label: 'Flagged Accounts', value: summary.suspicious_accounts_flagged, icon: AlertTriangle, color: 'text-danger' },
    { label: 'Fraud Rings', value: summary.fraud_rings_detected, icon: Network, color: 'text-accent' },
    { label: 'Processing Time', value: `${summary.processing_time_seconds}s`, icon: Clock, color: 'text-muted-foreground' },
  ];

  return (
    <div className="flex h-full flex-col overflow-hidden">
      {/* Stats */}
      <div className="grid grid-cols-2 gap-2 p-3">
        {stats.map((stat, i) => (
          <motion.div
            key={stat.label}
            initial={{ opacity: 0, scale: 0.9 }}
            animate={{ opacity: 1, scale: 1 }}
            transition={{ delay: i * 0.1 }}
            className="rounded-md border border-border bg-secondary/50 p-3"
          >
            <div className="flex items-center gap-2">
              <stat.icon className={`h-3.5 w-3.5 ${stat.color}`} />
              <span className="text-[10px] uppercase tracking-wider text-muted-foreground">{stat.label}</span>
            </div>
            <p className={`mt-1 font-mono text-xl font-bold ${stat.color}`}>{stat.value}</p>
          </motion.div>
        ))}
      </div>

      {/* Detection breakdown */}
      <div className="border-t border-border px-3 py-2">
        <div className="flex items-center gap-2 mb-2">
          <Activity className="h-3.5 w-3.5 text-primary" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">Detection Breakdown</span>
        </div>
        <div className="grid grid-cols-3 gap-1.5 text-center">
          {[
            { label: 'Cycles', count: result.fraud_rings.filter(r => r.pattern_type.includes('cycle')).length, color: 'text-danger' },
            { label: 'Smurfing', count: result.fraud_rings.filter(r => r.pattern_type.includes('smurf')).length, color: 'text-accent' },
            { label: 'Shell', count: result.fraud_rings.filter(r => r.pattern_type.includes('shell')).length, color: 'text-primary' },
          ].map(d => (
            <div key={d.label} className="rounded-sm border border-border bg-card p-2">
              <p className={`font-mono text-lg font-bold ${d.color}`}>{d.count}</p>
              <p className="text-[9px] uppercase text-muted-foreground">{d.label}</p>
            </div>
          ))}
        </div>
      </div>

      {/* Suspicious accounts list */}
      <div className="flex-1 overflow-hidden border-t border-border">
        <div className="flex items-center gap-2 px-3 py-2">
          <Shield className="h-3.5 w-3.5 text-danger" />
          <span className="text-[10px] uppercase tracking-wider text-muted-foreground">
            Suspicious Accounts ({suspicious_accounts.length})
          </span>
        </div>
        <div className="h-full overflow-y-auto px-3 pb-16 space-y-1">
          {suspicious_accounts.slice(0, 50).map((acc, i) => (
            <motion.button
              key={acc.account_id}
              initial={{ opacity: 0, x: -10 }}
              animate={{ opacity: 1, x: 0 }}
              transition={{ delay: i * 0.02 }}
              onClick={() => onAccountSelect(acc.account_id)}
              className="flex w-full items-center justify-between rounded-sm border border-border bg-secondary/30 px-2.5 py-1.5 text-left transition-colors hover:bg-secondary/60"
            >
              <div className="min-w-0">
                <p className="truncate font-mono text-xs text-foreground">{acc.account_id}</p>
                <p className="text-[9px] text-muted-foreground">{acc.detected_patterns.join(', ')}</p>
              </div>
              <div className={`ml-2 flex-shrink-0 rounded-sm px-2 py-0.5 font-mono text-xs font-bold ${
                acc.suspicion_score >= 70 ? 'bg-danger/20 text-danger' :
                acc.suspicion_score >= 40 ? 'bg-accent/20 text-accent' :
                'bg-primary/20 text-primary'
              }`}>
                {acc.suspicion_score}
              </div>
            </motion.button>
          ))}
        </div>
      </div>
    </div>
  );
}
