import type { ReactNode } from 'react';
import { cn } from '../../lib/utils';

interface ModalProps {
  open: boolean;
  onClose: () => void;
  title: string;
  children: ReactNode;
}

export function Modal({ open, onClose, title, children }: ModalProps) {
  if (!open) return null;

  return (
    <div className="fixed inset-0 z-50 flex items-end sm:items-center justify-center p-0 sm:p-4">
      <button
        type="button"
        className="absolute inset-0 bg-black/40 backdrop-blur-[2px]"
        onClick={onClose}
        aria-label="Cerrar"
      />
      <div
        className={cn(
          'relative w-full max-w-lg max-h-[90dvh] overflow-y-auto',
          'rounded-t-lg sm:rounded-lg border border-border bg-background shadow-lg',
          'animate-slide-up',
        )}
      >
        <div className="sticky top-0 flex items-center justify-between border-b border-border bg-background px-6 py-4">
          <h2 className="text-lg font-semibold leading-none tracking-tight">{title}</h2>
          <button
            type="button"
            onClick={onClose}
            className="rounded-sm p-1.5 text-muted-foreground hover:bg-accent hover:text-accent-foreground transition-colors"
            aria-label="Cerrar"
          >
            <span className="sr-only">Cerrar</span>
            ✕
          </button>
        </div>
        <div className="p-6">{children}</div>
      </div>
    </div>
  );
}
