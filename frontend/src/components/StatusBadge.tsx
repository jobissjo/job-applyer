const labels: Record<string, string> = { sent: 'Sent', ready: 'Ready to send', hr_contact_required: 'Contact needed', failed: 'Failed', draft: 'Draft', cancelled: 'Cancelled', error: 'Error', pending: 'Pending' };
export function StatusBadge({ status }: { status: string }) {
  return <span className={'badge badge-' + (Object.prototype.hasOwnProperty.call(labels, status) ? status : 'source')}>{labels[status] || status.replace(/_/g, ' ')}</span>;
}
