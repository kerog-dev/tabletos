import { create } from "zustand";
import type { App } from "../../loader/loader.ts";

export interface WindowDesc {
  id: number;
  app: App;
  initialPos: [number, number];
  initialSize: [number, number];
  z: number;
  minimized: boolean;
  args: any[];
  title?: string;
}

const useWindowsStore = create<{ windows: WindowDesc[] }>(() => ({ windows: [] }));

let curZ = 0;
let curId = 0;

export const useWindows = () => useWindowsStore(s => s.windows);
export const useWindowDesc = (id: number) => useWindowsStore(s => s.windows.find(w => w.id === id));

export function spawnWindow(
  app: App,
  minimized = false,
  initialPos: [number, number] | null = null,
  initialSize: [number, number] | null = null,
  args: any[] = [],
) {
  const posPcnt = Math.max(0, Math.min(0.95, curId / 15)) + 0.025;
  const newWindow: WindowDesc = {
    id: ++curId,
    app,
    initialPos: initialPos ?? [posPcnt * window.innerWidth, posPcnt * window.innerHeight],
    initialSize: initialSize ?? [window.innerWidth / 3, window.innerHeight / 3],
    z: ++curZ,
    minimized,
    args,
  };
  useWindowsStore.setState(s => ({ windows: [...s.windows, newWindow] }));
}

export function killWindow(id: number) {
  useWindowsStore.setState(s => ({ windows: s.windows.filter(w => w.id !== id) }));
}

export function killAllWindows() {
  useWindowsStore.setState({ windows: [] });
}

function modifyWindow(id: number, updater: (w: WindowDesc) => WindowDesc) {
  useWindowsStore.setState(s => ({ windows: s.windows.map(w => w.id === id ? updater(w) : w) }));
}

export function bringToTop(id: number) {
  modifyWindow(id, w => ({ ...w, z: ++curZ }));
}

export function toggleMinimized(id: number) {
  modifyWindow(id, w => ({ ...w, minimized: !w.minimized }));
}

export function setWindowTitle(id: number, title: string | null) {
  modifyWindow(id, w => ({ ...w, title: title ?? undefined }));
}
