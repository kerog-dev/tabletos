import { create } from "zustand";

export interface TrayDesc {
  id: string;
  name: string;
  iconUrl?: string;
  show(): React.ReactNode;
  open: boolean;
}

const useTrayStore = create<{ descs: Record<string, TrayDesc> }>(() => ({ descs: {} }));

export const setTray = (t: Omit<TrayDesc, "open">) =>
  useTrayStore.setState(s => ({ ...s, descs: { ...s.descs, [t.id]: { ...t, open: s.descs[t.id]?.open ?? false } } }));

export const deleteTray = (id: string) =>
  useTrayStore.setState(s => ({
    ...s,
    descs: Object.fromEntries(Object.entries(s.descs).filter(e => e[0] !== id.toString())),
  }));

export const setTrayOpen = (id: string, open: boolean) =>
  useTrayStore.setState(s => ({
    ...s,
    descs: Object.fromEntries(Object.values(s.descs).map(d => [d.id, d.id === id ? { ...d, open } : d])),
  }));

export const useTrayDescs = () => useTrayStore(s => s.descs);
