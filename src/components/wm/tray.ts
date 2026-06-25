import { create } from "zustand";

export interface TrayDesc {
  id: string;
  name: string;
  iconUrl: string;
  show(): React.ReactNode;
  open: boolean;
}

const useTrayStore = create<{ descs: Record<string, TrayDesc> }>(() => ({ descs: {} }));

export const setTray = (t: Omit<TrayDesc, "open">) =>
  useTrayStore.setState(s => ({ ...s, descs: { ...s.descs, [t.id]: { ...t, open: false } } }));

export const toggleTrayOpen = (id: string) =>
  useTrayStore.setState(s => ({
    ...s,
    descs: Object.fromEntries(Object.values(s.descs).map(d => [d.id, d.id === id ? { ...d, open: !d.open } : d])),
  }));

export const useTrayDescs = () => useTrayStore(s => s.descs);
