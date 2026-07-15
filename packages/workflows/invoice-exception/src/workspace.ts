import type { WorkspacePanelData } from '@tacit/workflow-sdk';
import { invoiceExceptionSeedData } from './seed';

function record(type: string, id: string) {
  const found = invoiceExceptionSeedData.domainRecords.find((item) => item.type === type && item.id === id);
  if (!found) throw new Error(`Missing invoice workspace record: ${type}/${id}`);
  return found.payload as Record<string, string | number | boolean | null>;
}

/** Invoice-specific fixture mapping for the generic observation workspace. */
export function loadInvoiceObservationWorkspace(): readonly WorkspacePanelData[] {
  const invoice = record('invoice_record', 'invoice-002');
  const purchaseOrder = record('purchase_order_record', 'po-002');
  const delivery = record('delivery_record', 'delivery-002');
  const email = record('vendor_email', 'email-001');
  const approvalMatrix = record('approval_matrix', 'approval-matrix');

  return [
    { panelId: 'invoice', values: { ...invoice, invoiceDate: '15 Jul 2026', tax: '₹0', lineItems: 'Standard supply line × 98' } },
    { panelId: 'purchase-order', values: purchaseOrder },
    { panelId: 'delivery-record', values: delivery },
    { panelId: 'vendor-email', values: email },
    { panelId: 'approval-matrix', values: approvalMatrix },
    { panelId: 'sop', values: { summary: 'Escalate invoices above ₹300,000 for manager approval.' } },
  ];
}
