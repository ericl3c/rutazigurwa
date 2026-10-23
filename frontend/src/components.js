import React, { useEffect } from 'react';
import { X } from 'lucide-react';

export function Modal({ title, children, onClose, actions }) {
  useEffect(() => { const h = (e) => e.key === 'Escape' && onClose(); window.addEventListener('keydown', h); return () => window.removeEventListener('keydown', h); }, [onClose]);
  return (
    <div className="overlay" onClick={onClose}>
      <div className="modal" role="dialog" aria-modal="true" aria-label={title} onClick={(e) => e.stopPropagation()}>
        <button className="icon-btn close" onClick={onClose} aria-label="Close"><X size={18} /></button>
        <h2>{title}</h2>
        <div>{children}</div>
        {actions && <div className="modal-actions">{actions}</div>}
      </div>
    </div>
  );
}
export const Alert = ({ kind = 'error', children }) => children ? <div className={`alert ${kind}`} role="alert">{children}</div> : null;
export const Spinner = ({ label = 'Loading...' }) => <div className="spinner-wrap"><div className="spinner" /><span>{label}</span></div>;
