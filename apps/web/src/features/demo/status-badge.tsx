export const productStatuses = ['draft', 'observing', 'needs_clarification', 'ready_to_build', 'building', 'tests_failed', 'verified', 'approval_required'] as const;
export type ProductStatus = (typeof productStatuses)[number];

const labels: Readonly<Record<ProductStatus, string>> = {
  draft: 'Draft', observing: 'Observing', needs_clarification: 'Needs clarification', ready_to_build: 'Ready to build',
  building: 'Building', tests_failed: 'Tests failed', verified: 'Verified', approval_required: 'Approval required',
};

export function StatusBadge({ status }: { readonly status: ProductStatus }) {
  return <span aria-label={`Status: ${labels[status]}`} style={{ display: 'inline-block', borderRadius: 999, padding: '4px 9px', background: '#e8eefc', color: '#1d3f91', fontSize: 13, fontWeight: 700 }}>{labels[status]}</span>;
}
