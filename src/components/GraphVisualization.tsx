import { useEffect, useRef, useState, useCallback } from 'react';
import cytoscape from 'cytoscape';
import type { DetectionResult } from '@/lib/types';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from '@/components/ui/tooltip';

interface GraphVisualizationProps {
  result: DetectionResult;
  onNodeSelect: (nodeId: string | null) => void;
  selectedNodeId: string | null;
}

const RING_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#a855f7',
];

function scoreColor(score: number): string {
  if (score >= 71) return '#ef4444'; // red
  if (score >= 41) return '#eab308'; // yellow
  return '#3b82f6'; // blue
}

export default function GraphVisualization({ result, onNodeSelect, selectedNodeId }: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [initialized, setInitialized] = useState(false);
  const [showOnlyRings, setShowOnlyRings] = useState(false);
  const [highlightHighRisk, setHighlightHighRisk] = useState(false);
  const [hoveredNode, setHoveredNode] = useState<{ id: string; patterns: string[]; score: number; x: number; y: number } | null>(null);

  const ringMemberSet = new Set<string>();
  for (const ring of result.fraud_rings) {
    for (const m of ring.member_accounts) ringMemberSet.add(m);
  }

  const suspiciousMap = new Map<string, { patterns: string[]; score: number }>();
  for (const acc of result.suspicious_accounts) {
    suspiciousMap.set(acc.account_id, { patterns: acc.detected_patterns, score: acc.suspicion_score });
  }

  useEffect(() => {
    if (!containerRef.current || initialized) return;

    const ringColorMap = new Map<string, string>();
    result.fraud_rings.forEach((ring, i) => {
      ringColorMap.set(ring.ring_id, RING_COLORS[i % RING_COLORS.length]);
    });

    const suspiciousSet = new Set(result.suspicious_accounts.map(a => a.account_id));
    const nodeRingMap = new Map<string, string>();
    for (const ring of result.fraud_rings) {
      for (const member of ring.member_accounts) {
        if (!nodeRingMap.has(member)) nodeRingMap.set(member, ring.ring_id);
      }
    }

    const MAX_NODES = 500;
    const nodeIds = new Set<string>();
    for (const acc of result.suspicious_accounts) nodeIds.add(acc.account_id);
    for (const node of result.graph.nodes) {
      if (nodeIds.size >= MAX_NODES) break;
      nodeIds.add(node.id);
    }

    const elements: cytoscape.ElementDefinition[] = [];
    
    for (const node of result.graph.nodes) {
      if (!nodeIds.has(node.id)) continue;
      const isSusp = suspiciousSet.has(node.id);
      const ringId = nodeRingMap.get(node.id);
      const color = isSusp ? scoreColor(node.suspicionScore) : '#64748b';
      const inRing = ringMemberSet.has(node.id);
      
      elements.push({
        data: {
          id: node.id,
          label: node.id.length > 12 ? node.id.slice(0, 12) + '…' : node.id,
          suspicious: isSusp,
          score: node.suspicionScore,
          color,
          size: isSusp ? 30 + Math.min(node.suspicionScore / 3, 20) : 18,
          ringId: ringId || '',
          inRing,
        },
      });
    }

    const maxAmountForEdges = Math.max(1, ...result.graph.edges.map(e => e.totalAmount));
    let edgeCount = 0;
    for (const edge of result.graph.edges) {
      if (edgeCount > 2000) break;
      if (!nodeIds.has(edge.source) || !nodeIds.has(edge.target)) continue;
      elements.push({
        data: {
          id: `${edge.source}->${edge.target}`,
          source: edge.source,
          target: edge.target,
          weight: 1 + (edge.totalAmount / maxAmountForEdges) * 4,
          count: edge.count,
          amount: edge.totalAmount,
        },
      });
      edgeCount++;
    }

    const cy = cytoscape({
      container: containerRef.current,
      elements,
      style: [
        {
          selector: 'node',
          style: {
            'background-color': 'data(color)',
            'label': 'data(label)',
            'color': '#cbd5e1',
            'font-size': '8px',
            'font-family': 'JetBrains Mono, monospace',
            'text-valign': 'bottom',
            'text-margin-y': 6,
            'width': 'data(size)',
            'height': 'data(size)',
            'border-width': 2,
            'border-color': 'data(color)',
            'border-opacity': 0.6,
            'text-outline-width': 2,
            'text-outline-color': '#0a0f1a',
          } as any,
        },
        {
          selector: 'node[suspicious]',
          style: { 'border-width': 3 },
        },
        {
          selector: 'node:selected',
          style: {
            'border-width': 4,
            'border-color': '#22d3ee',
            'overlay-opacity': 0.1,
            'overlay-color': '#22d3ee',
          },
        },
        {
          selector: 'edge',
          style: {
            'width': 'data(weight)',
            'line-color': '#334155',
            'target-arrow-color': '#475569',
            'target-arrow-shape': 'triangle',
            'curve-style': 'bezier',
            'opacity': 0.6,
            'arrow-scale': 0.8,
          },
        },
        {
          selector: 'edge:selected',
          style: {
            'line-color': '#22d3ee',
            'target-arrow-color': '#22d3ee',
            'opacity': 1,
          },
        },
      ],
      layout: {
        name: 'cose',
        animate: false,
        nodeRepulsion: () => 8000,
        idealEdgeLength: () => 100,
        gravity: 0.3,
        numIter: 300,
      } as any,
      minZoom: 0.1,
      maxZoom: 5,
      wheelSensitivity: 0.3,
    });

    cy.on('tap', 'node', (evt) => onNodeSelect(evt.target.id()));
    cy.on('tap', (evt) => { if (evt.target === cy) onNodeSelect(null); });

    // Tooltip on hover
    cy.on('mouseover', 'node', (evt) => {
      const nodeData = evt.target.data();
      const info = suspiciousMap.get(nodeData.id);
      if (info) {
        const pos = evt.target.renderedPosition();
        setHoveredNode({ id: nodeData.id, patterns: info.patterns, score: info.score, x: pos.x, y: pos.y });
      }
    });
    cy.on('mouseout', 'node', () => setHoveredNode(null));

    cyRef.current = cy;
    setInitialized(true);

    return () => { cy.destroy(); };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

  // Toggle: show only fraud ring members
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (showOnlyRings) {
      cy.nodes().forEach(n => {
        n.style('display', n.data('inRing') ? 'element' : 'none');
      });
      cy.edges().forEach(e => {
        const srcVisible = e.source().data('inRing');
        const tgtVisible = e.target().data('inRing');
        e.style('display', srcVisible && tgtVisible ? 'element' : 'none');
      });
    } else {
      cy.elements().style('display', 'element');
    }
  }, [showOnlyRings]);

  // Toggle: highlight high risk (>75)
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    if (highlightHighRisk) {
      cy.nodes().forEach(n => {
        const score = n.data('score') || 0;
        if (score > 75) {
          n.style('border-width', 5);
          n.style('border-color', '#ef4444');
          n.style('border-opacity', 1);
        } else {
          n.style('opacity', 0.3);
        }
      });
      cy.edges().style('opacity', 0.15);
    } else {
      cy.nodes().style('border-width', '').style('border-color', '').style('border-opacity', '').style('opacity', 1);
      cy.edges().style('opacity', 0.6);
    }
  }, [highlightHighRisk]);

  // Handle external selection
  useEffect(() => {
    const cy = cyRef.current;
    if (!cy) return;
    cy.$('node').unselect();
    if (selectedNodeId) {
      const node = cy.$id(selectedNodeId);
      if (node.length) {
        node.select();
        cy.animate({ center: { eles: node }, zoom: 2, duration: 400 } as any);
      }
    }
  }, [selectedNodeId]);

  return (
    <div className="relative h-full w-full overflow-hidden rounded-lg border border-border bg-card">
      {/* Header bar */}
      <div className="absolute left-3 top-3 z-10 rounded-sm border border-border bg-background/80 px-3 py-1.5 backdrop-blur">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Network Graph • {result.graph.nodes.length} nodes • {result.graph.edges.length} edges
        </span>
      </div>

      {/* Controls */}
      <div className="absolute right-3 top-3 z-10 flex flex-col gap-1.5">
        <button
          onClick={() => setShowOnlyRings(!showOnlyRings)}
          className={`rounded-sm border px-2.5 py-1 font-mono text-[10px] transition-colors ${
            showOnlyRings 
              ? 'border-primary bg-primary/20 text-primary' 
              : 'border-border bg-background/80 text-muted-foreground hover:text-foreground'
          } backdrop-blur`}
        >
          {showOnlyRings ? '✓ ' : ''}Show Only Fraud Rings
        </button>
        <button
          onClick={() => setHighlightHighRisk(!highlightHighRisk)}
          className={`rounded-sm border px-2.5 py-1 font-mono text-[10px] transition-colors ${
            highlightHighRisk 
              ? 'border-danger bg-danger/20 text-danger' 
              : 'border-border bg-background/80 text-muted-foreground hover:text-foreground'
          } backdrop-blur`}
        >
          {highlightHighRisk ? '✓ ' : ''}Highlight High Risk (&gt;75)
        </button>
      </div>

      {/* Color legend */}
      <div className="absolute bottom-3 left-3 z-10 flex items-center gap-3 rounded-sm border border-border bg-background/80 px-3 py-1.5 backdrop-blur">
        <span className="font-mono text-[9px] text-muted-foreground">Risk:</span>
        <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-[#3b82f6]" /><span className="font-mono text-[9px] text-muted-foreground">0-40</span></div>
        <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-[#eab308]" /><span className="font-mono text-[9px] text-muted-foreground">41-70</span></div>
        <div className="flex items-center gap-1"><div className="h-2.5 w-2.5 rounded-full bg-[#ef4444]" /><span className="font-mono text-[9px] text-muted-foreground">71-100</span></div>
      </div>

      {/* Tooltip */}
      {hoveredNode && (
        <div
          className="pointer-events-none absolute z-20 rounded-md border border-border bg-background/95 px-3 py-2 shadow-lg backdrop-blur"
          style={{ left: hoveredNode.x + 15, top: hoveredNode.y - 10 }}
        >
          <p className="font-mono text-xs font-bold text-foreground">{hoveredNode.id}</p>
          <p className="font-mono text-[10px] text-muted-foreground">Score: {hoveredNode.score}</p>
          <div className="mt-1 flex flex-wrap gap-1">
            {hoveredNode.patterns.map(p => (
              <span key={p} className="rounded-sm bg-secondary px-1.5 py-0.5 font-mono text-[9px] text-muted-foreground">{p}</span>
            ))}
          </div>
        </div>
      )}

      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
