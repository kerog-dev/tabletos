import { useEffect, useRef, useState } from "react";
import { type App, apps } from "../apps.ts";
import AppWindow from "../components/AppWindow.tsx";
import { toast } from "../toast.tsx";

function Window(
  { app, pos, size, z, onClick = () => {}, move, resize, kill }: {
    app: App;
    pos: [number, number];
    size: [number, number];
    z: number;
    onClick?: () => any;
    move: (newPos: [number, number]) => void;
    resize: (newSize: [number, number]) => void;
    kill: () => void;
  },
) {
  const dragged = useRef(false);
  const windowEl = useRef<HTMLDivElement | null>(null);
  const windowBarEl = useRef<HTMLDivElement | null>(null);
  const [minimized, setMinimized] = useState(false);

  useEffect(() => {
    if (!windowEl.current || !windowBarEl.current) return;

    let lastTouch: Touch | null = null;

    const touchStartListener = () => {
      dragged.current = true;
    };
    const touchEndListener = () => {
      if (!dragged.current || !windowEl.current) return;
      dragged.current = false;
      lastTouch = null;
      move([windowEl.current.offsetTop, windowEl.current.offsetLeft]);
    };
    const touchMoveListener = (e: TouchEvent) => {
      if (!windowEl.current || !dragged.current) return;
      e.preventDefault();
      const touch = e.touches[0];
      if (lastTouch) {
        const movementX = touch.clientX - lastTouch.clientX;
        const movementY = touch.clientY - lastTouch.clientY;
        windowEl.current.style.left = (windowEl.current.offsetLeft + movementX) + "px";
        windowEl.current.style.top = (windowEl.current.offsetTop + movementY) + "px";
      }
      lastTouch = touch;
    };

    const downListener = (e: MouseEvent) => {
      e.preventDefault();
      dragged.current = true;
    };
    const upListener = () => {
      if (!dragged.current || !windowEl.current) return;
      dragged.current = false;
      move([windowEl.current.offsetTop, windowEl.current.offsetLeft]);
    };
    const moveListener = (e: MouseEvent) => {
      if (!windowEl.current || !dragged.current) return;
      windowEl.current.style.left = (windowEl.current.offsetLeft + e.movementX) + "px";
      windowEl.current.style.top = (windowEl.current.offsetTop + e.movementY) + "px";
    };

    const pairs: [HTMLElement, string, (e: any) => any][] = [
      [
        windowBarEl.current,
        "mousedown",
        downListener,
      ],
      [
        document.body,
        "mouseup",
        upListener,
      ],
      [
        document.body,
        "mousemove",
        moveListener,
      ],
      [windowBarEl.current, "touchstart", touchStartListener],
      [document.body, "touchend", touchEndListener],
      [document.body, "touchmove", touchMoveListener],
    ];
    pairs.forEach(([target, evName, listener]) => {
      target.addEventListener(evName, listener);
    });
    return () =>
      pairs.forEach(([target, evName, listener]) => {
        target.removeEventListener(evName, listener);
      });
  }, []);

  function startResize() {
    window.addEventListener("mouseup", (e) => {
      e.preventDefault();
      resize([e.clientX - pos[1], e.clientY - pos[0]]);
    }, { once: true });
    toast({
      title: "Entered resizing mode! Press where you want the bottom-right corner to be.",
    });
  }

  return (
    <div
      onClick={onClick}
      style={{
        backgroundColor: "white",
        border: "5px solid black",
        position: "absolute",
        top: dragged.current ? undefined : Math.min(window.innerHeight - size[1], pos[0]) + "px",
        left: dragged.current ? undefined : Math.min(window.innerWidth - size[0], pos[1]) + "px",
        width: size[0] + "px",
        height: minimized ? "30px" : size[1] + "px",
        zIndex: z,
        display: "flex",
        flexDirection: "column",
        overflow: "scroll",
      }}
      ref={windowEl}
    >
      <div
        ref={windowBarEl}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: "30px",
          borderBottom: "3px solid grey",
        }}
      >
        {app.name}
        <div>
          <button onClick={() => kill()}>X</button>
          <button onClick={() => setMinimized(minimized => !minimized)}>_</button>
          <button onClick={() => startResize()}>!</button>
        </div>
      </div>
      <AppWindow app={app} hidden={minimized} />
    </div>
  );
}

function Taskbar(
  { windows, spawnWindow, killWindow }: {
    windows: WindowDesc[];
    spawnWindow: (app: App) => any;
    killWindow: (id: number) => void;
  },
) {
  return (
    <div>
      {apps.map(app => <button key={app.name} onClick={() => spawnWindow(app)}>{app.name}</button>)}
      <br />
      {windows.map(w => <button key={w.id} onClick={() => killWindow(w.id)}>{w.id}: {w.app.name}</button>)}
    </div>
  );
}

interface WindowDesc {
  id: number;
  app: App;
  pos: [number, number];
  size: [number, number];
  z: number;
}

export default function WM() {
  const [windows, setWindows] = useState<WindowDesc[]>([]);
  let curZ = useRef(0);
  let curId = useRef(0);

  function spawnWindow(app: App) {
    const newWindow: WindowDesc = {
      id: ++curId.current,
      app,
      pos: [Math.random() * window.innerWidth, Math.random() * window.innerHeight],
      size: [800, 600],
      z: ++curZ.current,
    };
    setWindows(windows => [...windows, newWindow]);
  }

  function killWindow(id: number) {
    setWindows(windows => windows.filter(w => w.id !== id));
  }

  function modifyWindow(updater: (w: WindowDesc) => WindowDesc, id: number) {
    setWindows(windows => windows.map(w => w.id === id ? updater(w) : w));
  }

  return (
    <div>
      <Taskbar windows={windows} spawnWindow={spawnWindow} killWindow={killWindow} />
      {windows.map((w) => (
        <Window
          key={w.id}
          app={w.app}
          pos={w.pos}
          size={w.size}
          z={w.z}
          onClick={() => {
            setWindows(windows => windows.map(w2 => w.id === w2.id ? { ...w2, z: ++curZ.current } : w2));
          }}
          move={([x, y]) => modifyWindow(w => ({ ...w, pos: [x, y] }), w.id)}
          resize={([x, y]) => modifyWindow(w => ({ ...w, size: [x, y] }), w.id)}
          kill={() => killWindow(w.id)}
        />
      ))}
    </div>
  );
}
