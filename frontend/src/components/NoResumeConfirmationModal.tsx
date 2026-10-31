import { useEffect, useId, useRef } from 'react';
import { AlertCircle } from 'lucide-react';

interface Props {
  action: 'send' | 'schedule';
  onCancel: () => void;
  onConfirm: () => void;
}

export function NoResumeConfirmationModal({ action, onCancel, onConfirm }: Props) {
  const dialog = useRef<HTMLDialogElement>(null);
  const titleId = useId();
  const descriptionId = useId();

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

  return <dialog ref={dialog} className="modal-content no-resume-confirmation" aria-labelledby={titleId} aria-describedby={descriptionId}
    onCancel={event => { event.preventDefault(); onCancel(); }}>
    <AlertCircle size={28} aria-hidden="true" />
    <h2 id={titleId}>No resume selected</h2>
    <p id={descriptionId}>Your application will be {action === 'schedule' ? 'scheduled' : 'sent'} without a resume attachment. Do you want to continue?</p>
    <div className="heading-actions">
      <button type="button" className="btn btn-secondary" autoFocus onClick={onCancel}>Go back</button>
      <button type="button" className="btn btn-primary" onClick={onConfirm}>{action === 'schedule' ? 'Schedule without resume' : 'Send without resume'}</button>
    </div>
  </dialog>;
}
