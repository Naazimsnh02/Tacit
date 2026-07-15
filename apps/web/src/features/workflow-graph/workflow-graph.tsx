'use client';

import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useState } from 'react';
import type { WorkflowGraph, WorkflowGraphNode, WorkflowGraphNodeDetail } from '../../lib/workflow-graph/model';

const colours: Record<WorkflowGraphNode['type'], string> = { start: '#1d4ed8', action: '#2563eb', deterministic_rule: '#0f766e', ai_judgment: '#7c3aed', human_decision: '#b45309', approval: '#be123c', escalation: '#c2410c', end: '#475569' };
type GraphFlowData = WorkflowGraphNodeDetail & { readonly label: string; readonly nodeType: WorkflowGraphNode['type'] } & Record<string, unknown>;

function GraphNode({ data }: NodeProps<Node<GraphFlowData>>) {
  return <div style={{ border: `2px solid ${colours[data.nodeType]}`, borderRadius: 8, background: 'white', minWidth: 180, padding: 10 }}><Handle type="target" position={Position.Top} /><strong>{data.label}</strong><br /><small>{data.automationRecommendation.replaceAll('_', ' ')}</small><Handle type="source" position={Position.Bottom} /></div>;
}

const nodeTypes = { start: GraphNode, action: GraphNode, deterministic_rule: GraphNode, ai_judgment: GraphNode, human_decision: GraphNode, approval: GraphNode, escalation: GraphNode, end: GraphNode };

export function WorkflowGraphView({ graph }: { readonly graph: WorkflowGraph }) {
  const [selected, setSelected] = useState<WorkflowGraphNode | null>(null);
  const nodes = useMemo<Node[]>(() => graph.nodes.map((node) => ({ id: node.id, type: node.type, position: node.position, data: { ...node.detail, label: node.label, nodeType: node.type } })), [graph]);
  const edges = useMemo<Edge[]>(() => graph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label, animated: edge.type !== 'default', style: { stroke: edge.type === 'approval' ? '#be123c' : edge.type === 'escalation' ? '#c2410c' : '#64748b' } })), [graph]);
  const detail = selected?.detail;
  return <section aria-label="Workflow graph" style={{ display: 'grid', gridTemplateColumns: 'minmax(0, 1fr) 320px', gap: 24 }}><div style={{ height: 680, border: '1px solid #cbd5e1', borderRadius: 8 }}><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView onNodeClick={(_, node) => setSelected(graph.nodes.find((item) => item.id === node.id) ?? null)}><Background /><Controls /></ReactFlow></div><aside aria-live="polite"><h2>{selected?.label ?? 'Select a node'}</h2>{detail ? <NodeDetails detail={detail} /> : <p>Select a step or rule to inspect its evidence, risk, and automation boundary.</p>}</aside></section>;
}

function NodeDetails({ detail }: { readonly detail: WorkflowGraphNodeDetail }) {
  return <dl><dt>Description</dt><dd>{detail.description}</dd><dt>Inputs</dt><dd>{detail.inputs.join(', ') || 'None'}</dd><dt>Outputs</dt><dd>{detail.outputs.join(', ') || 'None'}</dd><dt>Rule</dt><dd>{detail.rule ?? 'Not applicable'}</dd><dt>Confidence</dt><dd>{detail.confidence === null ? 'Not applicable' : `${Math.round(detail.confidence * 100)}%`}</dd><dt>Evidence</dt><dd>{detail.evidenceIds.join(', ') || 'None'}</dd><dt>Automation recommendation</dt><dd>{detail.automationRecommendation.replaceAll('_', ' ')}</dd><dt>Risk level</dt><dd>{detail.riskLevel ?? 'Not applicable'}</dd><dt>Verification</dt><dd>{detail.verificationStatus ?? 'Not applicable'}</dd></dl>;
}
