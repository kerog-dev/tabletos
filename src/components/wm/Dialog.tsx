import { createContext, ReactNode, useContext, useEffect, useRef } from "react";
import { create } from "zustand";

type DialogEntry =
  | { type: "alert"; content: string; title?: string; resolve: () => void }
  | { type: "prompt"; content: string; title?: string; resolve: (v: string | null) => void }
  | { type: "confirm"; content: string; title?: string; resolve: (v: boolean) => void };

const dialogStore = create<{ entries: DialogEntry[] }>(() => ({
  entries: [],
}));

const DialogContext = createContext<
  {
    alert(content: string, title?: string): Promise<void>;
    prompt(content: string, title?: string): Promise<string | null>;
    confirm(content: string, title?: string): Promise<boolean>;
  } | null
>(null);

export const useDialog = () => useContext(DialogContext);

function DialogContent({ entry }: { entry: DialogEntry }) {
  const inputRef = useRef<HTMLInputElement>(null);

  function dismiss(v?: any) {
    (entry.resolve as any)(v);
    dialogStore.setState(old => ({ entries: old.entries.filter(e => e !== entry) }));
  }

  const defaultDismissValue = entry.type === "confirm"
    ? false
    : entry.type === "prompt"
    ? null
    : undefined;

  return (
    <div>
      <button onClick={() => dismiss(defaultDismissValue)}>X</button>
      {entry.title && <span>{entry.title}</span>}
      <p>{entry.content}</p>
      {entry.type === "alert" && <button onClick={() => dismiss()}>OK</button>}
      {entry.type === "prompt" && (
        <>
          <input ref={inputRef} />
          <button onClick={() => dismiss(null)}>Cancel</button>
          <button onClick={() => dismiss(inputRef.current?.value ?? null)}>OK</button>
        </>
      )}
      {entry.type === "confirm" && (
        <>
          <button onClick={() => dismiss(false)}>Cancel</button>
          <button onClick={() => dismiss(true)}>OK</button>
        </>
      )}
    </div>
  );
}

export function Dialog() {
  const dialogRef = useRef<HTMLDialogElement | null>(null);
  const entries = dialogStore(s => s.entries);
  const current = entries[0] ?? null;

  useEffect(() => {
    if (current === null) {
      dialogRef.current?.close();
    } else if (current !== null) {
      dialogRef.current?.showModal();
    }
  }, [current === null]);

  return (
    <dialog ref={dialogRef}>
      {current && <DialogContent entry={current} />}
    </dialog>
  );
}

export function DialogProvider({ children }: { children: ReactNode }) {
  return (
    <DialogContext.Provider
      value={{
        alert(content, title) {
          let resolve: any;
          const promise = new Promise<any>(res => resolve = res);
          dialogStore.setState(old => ({
            ...old,
            entries: [...old.entries, { type: "alert", content, title, resolve }],
          }));
          return promise;
        },
        prompt(content, title) {
          let resolve: any;
          const promise = new Promise<any>(res => resolve = res);
          dialogStore.setState(old => ({
            ...old,
            entries: [...old.entries, { type: "prompt", content, title, resolve }],
          }));
          return promise;
        },
        confirm(content, title) {
          let resolve: any;
          const promise = new Promise<any>(res => resolve = res);
          dialogStore.setState(old => ({
            ...old,
            entries: [...old.entries, { type: "confirm", content, title, resolve }],
          }));
          return promise;
        },
      }}
    >
      {children}
    </DialogContext.Provider>
  );
}
