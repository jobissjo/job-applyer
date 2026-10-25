import { useEffect, useId, useRef, useState } from 'react';
import { Trash2 } from 'lucide-react';
import { formatApiError } from '../services/api';

interface Props {
  title: string;
  itemName: string;
  onCancel: () => void;
  onConfirm: () => Promise<void>;
}

export function DeleteConfirmationModal({ title, itemName, onCancel, onConfirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  useEffect(() => {
    const element = dialog.current!;
    element.showModal();
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = 'hidden';
    return () => {
      element.close();
      document.body.style.overflow = previousOverflow;
    };
  }, []);

  const confirm = async () => {
    if (busy) return;
    setBusy(true);
    setError('');
    try { await onConfirm(); }
    catch (err) { setError(formatApiError(err, 'Could not delete this item. Please try again.')); }
    finally { setBusy(false); }
  };

  return <dialog ref={dialog} className="modal-content delete-confirmation" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); if (!busy) onCancel(); }}
    onClick={event => { if (event.target === event.currentTarget && !busy) {
      const bounds = event.currentTarget.getBoundingClientRect();
      if (event.clientX < bounds.left || event.clientX > bounds.right || event.clientY < bounds.top || event.clientY > bounds.bottom) onCancel();
    } }}>
    <div className="delete-confirmation-icon"><Trash2 size={24} /></div>
    <h2 id={titleId}>{title}</h2>
    <p id={descriptionId}>Delete <strong>{itemName}</strong>? This action cannot be undone.</p>
    {error && <div className="alert alert-danger" role="alert">{error}</div>}
    <div className="heading-actions delete-confirmation-actions">
      <button type="button" className="btn btn-secondary" autoFocus disabled={busy} onClick={onCancel}>Cancel</button>
      <button type="button" className="btn btn-danger" disabled={busy} onClick={() => void confirm()}><Trash2 size={16} />{busy ? 'Deleting…' : 'Delete'}</button>
    </div>
  </dialog>;
}
