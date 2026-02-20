import { useState, useMemo } from 'react';
import { motion } from 'framer-motion';
import { Download, ArrowUpDown, Search } from 'lucide-react';
import type { DetectionResult } from '@/lib/types';

interface FraudRingTableProps {
  result: DetectionResult;
}

type SortKey = 'ring_id' | 'pattern_type' | 'risk_score' | 'members';

export default function FraudRingTable({ result }: FraudRingTableProps) {
  const [sortKey, setSortKey] = useState<SortKey>('risk_score');
  const [sortAsc, setSortAsc] = useState(false);
  const [filter, setFilter] = useState('');

  const sorted = useMemo(() => {
    let rings = [...result.fraud_rings];
    if (filter) {
      const f = filter.toLowerCase();
      rings = rings.filter(r =>
        r.ring_id.toLowerCase().includes(f) ||
        r.pattern_type.toLowerCase().includes(f) ||
        r.member_accounts.some(m => m.toLowerCase().includes(f))
      );
    }
    rings.sort((a, b) => {
      let cmp = 0;
      switch (sortKey) {
        case 'ring_id': cmp = a.ring_id.localeCompare(b.ring_id); break;
        case 'pattern_type': cmp = a.pattern_type.localeCompare(b.pattern_type); break;
        case 'risk_score': cmp = a.risk_score - b.risk_score; break;
        case 'members': cmp = a.member_accounts.length - b.member_accounts.length; break;
      }
      return sortAsc ? cmp : -cmp;
    });
    return rings;
  }, [result.fraud_rings, sortKey, sortAsc, filter]);

  const handleSort = (key: SortKey) => {
    if (sortKey === key) setSortAsc(!sortAsc);
    else { setSortKey(key); setSortAsc(false); }
  };

  const downloadJSON = () => {
    const output = {
      suspicious_accounts: result.suspicious_accounts,
      fraud_rings: result.fraud_rings,
      summary: result.summary,
    };
    const blob = new Blob([JSON.stringify(output, null, 2)], { type: 'application/json' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = 'detection_results.json';
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      className="rounded-lg border border-border bg-card"
    >
      <div className="flex flex-col gap-3 border-b border-border p-4 sm:flex-row sm:items-center sm:justify-between">
        <h3 className="font-mono text-xs uppercase tracking-wider text-muted-foreground">
          Fraud Ring Summary • {result.fraud_rings.length} rings detected
        </h3>
        <div className="flex items-center gap-2">
          <div className="relative">
            <Search className="absolute left-2 top-1/2 h-3 w-3 -translate-y-1/2 text-muted-foreground" />
            <input
              type="text"
              value={filter}
              onChange={(e) => setFilter(e.target.value)}
              placeholder="Filter..."
              className="h-8 rounded-sm border border-border bg-secondary pl-7 pr-3 font-mono text-xs text-foreground placeholder:text-muted-foreground focus:border-primary focus:outline-none"
            />
          </div>
          <button
            onClick={downloadJSON}
            className="flex h-8 items-center gap-1.5 rounded-sm border border-primary bg-primary/10 px-3 font-mono text-xs text-primary transition-colors hover:bg-primary/20"
          >
            <Download className="h-3 w-3" />
            Download JSON
          </button>
        </div>
      </div>

      <div className="overflow-x-auto">
        <table className="w-full">
          <thead>
            <tr className="border-b border-border">
              {[
                { key: 'ring_id' as SortKey, label: 'Ring ID' },
                { key: 'pattern_type' as SortKey, label: 'Pattern' },
                { key: 'members' as SortKey, label: 'Members' },
                { key: 'risk_score' as SortKey, label: 'Risk Score' },
              ].map(col => (
                <th
                  key={col.key}
                  onClick={() => handleSort(col.key)}
                  className="cursor-pointer px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground hover:text-foreground"
                >
                  <div className="flex items-center gap-1">
                    {col.label}
                    <ArrowUpDown className="h-3 w-3" />
                  </div>
                </th>
              ))}
              <th className="px-4 py-2 text-left font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
                Account IDs
              </th>
            </tr>
          </thead>
          <tbody>
            {sorted.map((ring, i) => (
              <motion.tr
                key={ring.ring_id}
                initial={{ opacity: 0 }}
                animate={{ opacity: 1 }}
                transition={{ delay: i * 0.02 }}
                className="border-b border-border/50 transition-colors hover:bg-secondary/30"
              >
                <td className="px-4 py-2.5 font-mono text-xs text-foreground">{ring.ring_id}</td>
                <td className="px-4 py-2.5">
                  <span className={`rounded-sm px-2 py-0.5 font-mono text-[10px] ${
                    ring.pattern_type.includes('cycle') ? 'bg-danger/20 text-danger' :
                    ring.pattern_type.includes('fan_in') || ring.pattern_type.includes('fan_out') ? 'bg-accent/20 text-accent' :
                    'bg-primary/20 text-primary'
                  }`}>
                    {ring.pattern_type}
                  </span>
                </td>
                <td className="px-4 py-2.5 font-mono text-xs text-foreground">{ring.member_accounts.length}</td>
                <td className="px-4 py-2.5">
                  <span className={`font-mono text-xs font-bold ${
                    ring.risk_score >= 70 ? 'text-danger' : ring.risk_score >= 40 ? 'text-accent' : 'text-primary'
                  }`}>
                    {ring.risk_score}
                  </span>
                </td>
                <td className="max-w-[300px] truncate px-4 py-2.5 font-mono text-[10px] text-muted-foreground">
                  {ring.member_accounts.join(', ')}
                </td>
              </motion.tr>
            ))}
            {sorted.length === 0 && (
              <tr>
                <td colSpan={5} className="px-4 py-8 text-center text-sm text-muted-foreground">
                  No fraud rings match the filter
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>
    </motion.div>
  );
}
