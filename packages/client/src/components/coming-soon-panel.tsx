import { useEffect, useRef } from 'react';
import { useFocusTrap } from '../lib/use-focus-trap';

interface ComingSoonPanelProps {
  title: string;
  description: string;
  onClose: () => void;
}

export default function ComingSoonPanel({ title, description, onClose }: ComingSoonPanelProps) {
  const panelRef = useFocusTrap(onClose);
  const btnRef = useRef<HTMLButtonElement>(null);

  useEffect(() => {
    btnRef.current?.focus();
  }, []);

  return (
    <div
      className="modal-backdrop"
      role="dialog"
      aria-modal="true"
      aria-labelledby="coming-soon-title"
    >
      <div ref={panelRef} className="modal-panel coming-soon-panel">
        <h2 id="coming-soon-title" className="modal-title">
          {title}
        </h2>
        <p className="modal-body coming-soon-description">{description}</p>
        <p className="coming-soon-note">
          This building will be fully operational when its phase ships.
        </p>
        <div className="form-actions">
          <button ref={btnRef} className="btn-secondary" onClick={onClose}>
            Return to Town Square
          </button>
        </div>
      </div>
    </div>
  );
}
