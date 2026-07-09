import { useEffect } from "react";
import { create } from "zustand";
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

let nextId = 0;

const useToastStore = create<{ toasts: ToastInternal[] }>(() => ({ toasts: [] }));

function dismiss(id: number) {
  useToastStore.setState(s => ({ toasts: s.toasts.filter(t => t.id !== id) }));
}

function ToastComponent({ t }: { t: ToastInternal }) {
  const backgroundColor =
    ({ [Urgency.Info]: "blue", [Urgency.Warning]: "orange", [Urgency.Error]: "red", [Urgency.Critical]: "black" })[
      t.urgency
    ];
  return (
    <div className="toast" style={{ backgroundColor }} onClick={() => dismiss(t.id)}>
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
  const toasts = useToastStore(s => s.toasts);

  useEffect(() => {
    const id = setInterval(() => {
      useToastStore.setState(s => ({ toasts: s.toasts.filter(t => Date.now() - t.at < t.duration * 1000) }));
    }, 1_000);
    return () => clearInterval(id);
  }, []);

  return (
    <div className="toasts">
      {toasts.map(t => <ToastComponent key={t.id} t={t} />)}
    </div>
  );
}

export function toast({ title, desc, urgency = Urgency.Info, duration = 5 }: Toast) {
  useToastStore.setState(s => ({
    toasts: [...s.toasts, { title, desc, duration, at: Date.now(), id: ++nextId, urgency }],
  }));
}
