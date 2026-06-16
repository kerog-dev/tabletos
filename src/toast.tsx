import { useEffect, useRef, useState } from "react";
import "./toast.css";

export enum Urgency {
  Info,
  Warning,
  Error,
  Critical,
}

interface Toast {
  title: string;
  desc?: string;
  duration?: number;
  urgency?: Urgency;
}

interface ToastInternal extends Toast {
  id: number;
  at: number;
  duration: number;
  urgency: Urgency;
}

let addToastG: ((toast: Toast) => void) | null = null;

function ToastComponent({ t, dismiss }: { t: ToastInternal; dismiss: () => void }) {
  const backgroundColor =
    ({ [Urgency.Info]: "blue", [Urgency.Warning]: "orange", [Urgency.Error]: "red", [Urgency.Critical]: "black" })[
      t.urgency
    ];
  return (
    <div className="toast" style={{ backgroundColor }} onClick={dismiss}>
      <span className="toast-title">
        {t.title}
      </span>
      {t.desc && (
        <div className="toast-desc">
          {t.desc}
        </div>
      )}
    </div>
  );
}

export function Toasts() {
  const [toasts, setToasts] = useState<ToastInternal[]>([]);
  const nextId = useRef(0);

  function addToast({ title, desc, urgency = Urgency.Info, duration = 5 }: Toast) {
    setToasts(toasts => [...toasts, { title, desc, duration, at: Date.now(), id: ++nextId.current, urgency }]);
  }

  useEffect(() => {
    addToastG = addToast;
  }, []);

  useEffect(() => {
    const id = setInterval(() => {
      setToasts(toasts => toasts.filter(t => Date.now() - t.at < t.duration * 1000));
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="toasts">
      {toasts.map(t => (
        <ToastComponent
          key={t.id}
          t={t}
          dismiss={() => setToasts(toasts => toasts.filter(t2 => t2.id !== t.id))}
        />
      ))}
    </div>
  );
}

export function toast(toast: Toast) {
  addToastG?.(toast);
}
