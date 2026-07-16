export const productStatuses = ['draft', 'observing', 'needs_clarification', 'ready_to_build', 'building', 'tests_failed', 'verified', 'approval_required'] as const;
export type ProductStatus = (typeof productStatuses)[number];

const labels: Readonly<Record<ProductStatus, string>> = {
  draft: 'Draft', observing: 'Observing', needs_clarification: 'Needs clarification', ready_to_build: 'Ready to build',
  building: 'Building', tests_failed: 'Tests failed', verified: 'Verified', approval_required: 'Approval required',
};

export function StatusBadge({ status }: { readonly status: ProductStatus }) {
  const tone = status === 'verified' ? 'success' : status === 'tests_failed' ? 'danger' : status === 'approval_required' || status === 'needs_clarification' ? 'warning' : 'info';
  return <span aria-label={`Status: ${labels[status]}`} className={`status status-${tone}`}>{labels[status]}</span>;
}
