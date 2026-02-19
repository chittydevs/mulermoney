import { useState } from 'react';
import GraphVisualization from './GraphVisualization';
import SummaryPanel from './SummaryPanel';
import NodeDetailsPanel from './NodeDetailsPanel';
import FraudRingTable from './FraudRingTable';
import type { DetectionResult } from '@/lib/types';
import { ArrowLeft, LogOut } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface DashboardProps {
  result: DetectionResult;
  onReset: () => void;
}

export default function Dashboard({ result, onReset }: DashboardProps) {
  const [selectedNodeId, setSelectedNodeId] = useState<string | null>(null);
  const { signOut } = useAuth();

  return (
    <div className="flex h-screen flex-col bg-background">
      {/* Top bar */}
      <header className="flex items-center justify-between border-b border-border bg-card px-4 py-2">
        <div className="flex items-center gap-4">
          <button onClick={onReset} className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
            <ArrowLeft className="h-4 w-4" />
            <span className="text-xs">New Analysis</span>
          </button>
          <div className="h-4 w-px bg-border" />
          <div>
            <h1 className="font-mono text-sm font-bold tracking-tight text-primary text-glow-primary">MONEY MULING DETECTION ENGINE</h1>
            <p className="text-[10px] text-muted-foreground">
              {result.summary.total_accounts_analyzed} accounts • {result.summary.fraud_rings_detected} rings • {result.summary.processing_time_seconds}s
            </p>
          </div>
        </div>
        <button onClick={signOut} className="flex items-center gap-1.5 text-muted-foreground transition-colors hover:text-foreground">
          <LogOut className="h-4 w-4" />
          <span className="text-xs">Sign Out</span>
        </button>
      </header>

      {/* Main content */}
      <div className="flex flex-1 overflow-hidden">
        {/* Left panel - Summary */}
        <aside className="w-72 flex-shrink-0 overflow-hidden border-r border-border bg-card lg:w-80">
          <SummaryPanel result={result} onAccountSelect={setSelectedNodeId} />
        </aside>

        {/* Center - Graph */}
        <main className="flex flex-1 flex-col overflow-hidden">
          <div className="flex-1 p-2">
            <GraphVisualization
              result={result}
              onNodeSelect={setSelectedNodeId}
              selectedNodeId={selectedNodeId}
            />
          </div>
          {/* Bottom - Fraud Ring Table */}
          <div className="max-h-80 overflow-y-auto border-t border-border p-3">
            <FraudRingTable result={result} />
          </div>
        </main>

        {/* Right panel - Node details */}
        {selectedNodeId && (
          <aside className="w-72 flex-shrink-0 border-l border-border bg-card lg:w-80">
            <NodeDetailsPanel result={result} nodeId={selectedNodeId} onClose={() => setSelectedNodeId(null)} />
          </aside>
        )}
      </div>
    </div>
  );
}
