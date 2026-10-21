import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { ToastContext } from './toast-context';

const TOAST_DURATION = 5000;

/**
 * Shows the confirmation messages of the successful actions.
 *
 * The provider wraps the whole application, so every page can confirm what it
 * just did without passing callbacks around.
 */
export function ToastProvider({ children }) {
  const [toasts, setToasts] = useState([]);
  const timers = useRef(new Map());

  const dismiss = useCallback((id) => {
    const timer = timers.current.get(id);
    if (timer) {
      clearTimeout(timer);
      timers.current.delete(id);
    }

    setToasts((current) => current.filter((toast) => toast.id !== id));
  }, []);

  const show = useCallback(
    (message) => {
      const id = `${Date.now()}-${Math.random().toString(36).slice(2, 8)}`;

      setToasts((current) => [...current, { id, message }]);
      timers.current.set(
        id,
        setTimeout(() => dismiss(id), TOAST_DURATION)
      );

      return id;
    },
    [dismiss]
  );

  useEffect(() => {
    const pending = timers.current;

    return () => {
      for (const timer of pending.values()) clearTimeout(timer);
      pending.clear();
    };
  }, []);

  const value = useMemo(() => ({ show, dismiss }), [show, dismiss]);

  return (
    <ToastContext.Provider value={value}>
      {children}

      <div
        aria-live="polite"
        className="pointer-events-none fixed inset-x-0 bottom-4 z-50 flex flex-col items-center gap-2 px-4 sm:items-end sm:px-6"
      >
        {toasts.map((toast) => (
          <div
            key={toast.id}
            role="status"
            className="pointer-events-auto flex w-full max-w-sm items-start gap-3 rounded-lg border border-plum/20 bg-surface px-4 py-3 text-sm text-ink shadow-lg"
          >
            <span className="min-w-0 flex-1">{toast.message}</span>
            <button
              type="button"
              onClick={() => dismiss(toast.id)}
              aria-label="Dismiss the message"
              className="text-xs font-semibold uppercase tracking-wide text-plum-soft underline underline-offset-4 hover:text-coral"
            >
              Close
            </button>
          </div>
        ))}
      </div>
    </ToastContext.Provider>
  );
}
