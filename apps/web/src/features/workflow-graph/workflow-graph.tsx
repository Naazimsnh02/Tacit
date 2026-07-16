'use client';

import { Background, Controls, Handle, Position, ReactFlow, type Edge, type Node, type NodeProps } from '@xyflow/react';
import '@xyflow/react/dist/style.css';
import { useMemo, useState } from 'react';
import type { WorkflowGraph, WorkflowGraphNode, WorkflowGraphNodeDetail } from '../../lib/workflow-graph/model';

const colours: Record<WorkflowGraphNode['type'], string> = { start: '#3157d5', action: '#3157d5', deterministic_rule: '#15803d', ai_judgment: '#2563eb', human_decision: '#b7791f', approval: '#c2413b', escalation: '#b7791f', end: '#5f6b7a' };
type GraphFlowData = WorkflowGraphNodeDetail & { readonly label: string; readonly nodeType: WorkflowGraphNode['type'] } & Record<string, unknown>;

function GraphNode({ data }: NodeProps<Node<GraphFlowData>>) {
  return <div style={{ border: `1px solid ${colours[data.nodeType]}`, borderLeft: `4px solid ${colours[data.nodeType]}`, borderRadius: 10, background: 'white', minWidth: 190, padding: 12, boxShadow: '0 4px 12px rgba(17,24,39,.07)' }}><Handle type="target" position={Position.Top} /><strong>{data.label}</strong><br /><small style={{ color: '#5f6b7a' }}>{data.automationRecommendation.replaceAll('_', ' ')}</small><Handle type="source" position={Position.Bottom} /></div>;
}

const nodeTypes = { start: GraphNode, action: GraphNode, deterministic_rule: GraphNode, ai_judgment: GraphNode, human_decision: GraphNode, approval: GraphNode, escalation: GraphNode, end: GraphNode };

export function WorkflowGraphView({ graph }: { readonly graph: WorkflowGraph }) {
  const [selected, setSelected] = useState<WorkflowGraphNode | null>(null);
  const nodes = useMemo<Node[]>(() => graph.nodes.map((node) => ({ id: node.id, type: node.type, position: node.position, data: { ...node.detail, label: node.label, nodeType: node.type } })), [graph]);
  const edges = useMemo<Edge[]>(() => graph.edges.map((edge) => ({ id: edge.id, source: edge.source, target: edge.target, label: edge.label, animated: edge.type !== 'default', style: { stroke: edge.type === 'approval' ? '#c2413b' : edge.type === 'escalation' ? '#b7791f' : '#8a94a3' } })), [graph]);
  const detail = selected?.detail;
  return <section aria-label="Workflow graph" className="split" style={{ gridTemplateColumns: 'minmax(0, 1fr) minmax(290px, .38fr)' }}><div className="card" style={{ height: 680, padding: 0, overflow: 'hidden' }}><ReactFlow nodes={nodes} edges={edges} nodeTypes={nodeTypes} fitView onNodeClick={(_, node) => setSelected(graph.nodes.find((item) => item.id === node.id) ?? null)}><Background color="#e1e7ef" gap={18} /><Controls /></ReactFlow></div><aside className="card" aria-live="polite"><span className="metric-label">Node inspection</span><h2>{selected?.label ?? 'Select a node'}</h2>{detail ? <NodeDetails detail={detail} /> : <p className="muted">Select a step or rule to inspect its evidence, risk, and automation boundary.</p>}</aside></section>;
}

function NodeDetails({ detail }: { readonly detail: WorkflowGraphNodeDetail }) {
  return <dl className="data-list"><div><dt>Description</dt><dd>{detail.description}</dd></div><div><dt>Inputs</dt><dd>{detail.inputs.join(', ') || 'None'}</dd></div><div><dt>Outputs</dt><dd>{detail.outputs.join(', ') || 'None'}</dd></div><div><dt>Rule</dt><dd>{detail.rule ?? 'Not applicable'}</dd></div><div><dt>Confidence</dt><dd>{detail.confidence === null ? 'Not applicable' : `${Math.round(detail.confidence * 100)}%`}</dd></div><div><dt>Evidence</dt><dd>{detail.evidenceIds.join(', ') || 'None'}</dd></div><div><dt>Automation recommendation</dt><dd>{detail.automationRecommendation.replaceAll('_', ' ')}</dd></div><div><dt>Risk level</dt><dd>{detail.riskLevel ?? 'Not applicable'}</dd></div><div><dt>Verification</dt><dd>{detail.verificationStatus ?? 'Not applicable'}</dd></div></dl>;
}
