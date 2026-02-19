import { useEffect, useRef, useState } from 'react';
import cytoscape from 'cytoscape';
import type { DetectionResult } from '@/lib/types';

interface GraphVisualizationProps {
  result: DetectionResult;
  onNodeSelect: (nodeId: string | null) => void;
  selectedNodeId: string | null;
}

// Generate distinct ring colors
const RING_COLORS = [
  '#ef4444', '#f97316', '#eab308', '#22c55e', '#06b6d4',
  '#8b5cf6', '#ec4899', '#f43f5e', '#14b8a6', '#a855f7',
];

export default function GraphVisualization({ result, onNodeSelect, selectedNodeId }: GraphVisualizationProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const cyRef = useRef<cytoscape.Core | null>(null);
  const [initialized, setInitialized] = useState(false);

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

    // Limit nodes for visualization performance
    const MAX_NODES = 500;
    const nodeIds = new Set<string>();
    // Prioritize suspicious nodes
    for (const acc of result.suspicious_accounts) {
      nodeIds.add(acc.account_id);
    }
    for (const node of result.graph.nodes) {
      if (nodeIds.size >= MAX_NODES) break;
      nodeIds.add(node.id);
    }

    const elements: cytoscape.ElementDefinition[] = [];
    
    for (const node of result.graph.nodes) {
      if (!nodeIds.has(node.id)) continue;
      const isSusp = suspiciousSet.has(node.id);
      const ringId = nodeRingMap.get(node.id);
      const color = ringId ? ringColorMap.get(ringId) : (isSusp ? '#ef4444' : '#64748b');
      
      elements.push({
        data: {
          id: node.id,
          label: node.id.length > 12 ? node.id.slice(0, 12) + '…' : node.id,
          suspicious: isSusp,
          score: node.suspicionScore,
          color,
          size: isSusp ? 30 + Math.min(node.suspicionScore / 3, 20) : 18,
          ringId: ringId || '',
        },
      });
    }

    // Max edges for performance
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
          style: {
            'border-width': 3,
          },
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

    cy.on('tap', 'node', (evt) => {
      onNodeSelect(evt.target.id());
    });
    cy.on('tap', (evt) => {
      if (evt.target === cy) onNodeSelect(null);
    });

    cyRef.current = cy;
    setInitialized(true);

    return () => {
      cy.destroy();
    };
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [result]);

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
      <div className="absolute left-3 top-3 z-10 rounded-sm border border-border bg-background/80 px-3 py-1.5 backdrop-blur">
        <span className="font-mono text-[10px] uppercase tracking-wider text-muted-foreground">
          Network Graph • {result.graph.nodes.length} nodes • {result.graph.edges.length} edges
        </span>
      </div>
      <div ref={containerRef} className="h-full w-full" />
    </div>
  );
}
