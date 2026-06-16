import { useEffect, useRef, useState } from "react";
import { type App, apps } from "../apps.ts";
import AppWindow from "../components/AppWindow.tsx";

function Window(
  { app, initialPos, initialSize, z, kill, bringToTop }: {
    app: App;
    initialPos: [number, number];
    initialSize: [number, number];
    z: number;
    kill: () => void;
    bringToTop: () => void;
  },
) {
  const windowEl = useRef<HTMLDivElement | null>(null);
  const windowBarEl = useRef<HTMLDivElement | null>(null);
  const lastHeightRef = useRef<number>(0);
  const draggedRef = useRef<boolean>(false);
  const [minimized, setMinimized] = useState(false);

  function toggleMinimize() {
    if (!windowEl.current) return;
    if (!minimized) {
      lastHeightRef.current = windowEl.current.clientHeight;
      windowEl.current.style.height = "30px";
    } else {
      windowEl.current.style.height = lastHeightRef.current + "px";
      lastHeightRef.current = 0;
    }
    setMinimized(m => !m);
  }

  useEffect(() => {
    if (!windowEl.current || !windowBarEl.current) return;

    windowEl.current.style.width = initialSize[0] + "px";
    windowEl.current.style.height = initialSize[1] + "px";
    windowEl.current.style.top = initialPos[1] + "px";
    windowEl.current.style.left = initialPos[0] + "px";

    const clampPos = () => {
      if (!windowEl.current) return;
      if (windowEl.current.offsetTop + windowEl.current.clientHeight > window.innerHeight) {
        windowEl.current.style.top = (window.innerHeight - windowEl.current.clientHeight - 20) + "px";
      }
      if (windowEl.current.offsetLeft + windowEl.current.clientWidth > window.innerWidth) {
        windowEl.current.style.left = (window.innerWidth - windowEl.current.clientWidth - 20) + "px";
      }
    };

    let lastTouch: Touch | null = null;

    const touchStartListener = () => {
      draggedRef.current = true;
      clampPos();
      bringToTop();
    };
    const touchEndListener = () => {
      lastTouch = null;
      draggedRef.current = false;
      clampPos();
    };
    const touchMoveListener = (e: TouchEvent) => {
      if (!windowEl.current || !draggedRef.current) return;
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
      if (draggedRef.current) return;
      e.preventDefault();
      draggedRef.current = true;
      bringToTop();
    };
    const upListener = () => {
      draggedRef.current = false;
      clampPos();
    };
    const moveListener = (e: MouseEvent) => {
      if (!windowEl.current || !draggedRef.current) return;
      windowEl.current.style.left = (windowEl.current.offsetLeft + e.movementX) + "px";
      windowEl.current.style.top = (windowEl.current.offsetTop + e.movementY) + "px";
      clampPos();
    };

    const pairs = [
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
    ] as const;
    pairs.forEach(([target, evName, listener]) => {
      target.addEventListener(evName, listener as EventListener);
    });
    return () =>
      pairs.forEach(([target, evName, listener]) => {
        target.removeEventListener(evName, listener as EventListener);
      });
  }, []);

  return (
    <div
      style={{
        backgroundColor: "white",
        border: "5px solid black",
        position: "absolute",
        zIndex: z,
        display: "flex",
        flexDirection: "column",
        overflow: "scroll",
        resize: "both",
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
          <button onClick={() => toggleMinimize()}>_</button>
        </div>
      </div>
      <AppWindow app={app} hidden={minimized} />
    </div>
  );
}

function Launchpad({ spawnWindow }: { spawnWindow: (app: App) => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "fixed", bottom: "0", left: "0", margin: "10px" }}>
      <button onClick={() => setOpen(open => !open)}>{"<!>"}</button>
      <div
        style={{
          display: open ? "unset" : "none",
          position: "fixed",
          bottom: "50px",
          left: "10px",
          backgroundColor: "#aeaeae",
          padding: "10px",
          borderRadius: "8px",
          width: "10%",
        }}
      >
        <div>
          Apps:
          <ul style={{ margin: 0 }}>
            {apps.map(app => (
              <li key={app.name}>
                <button onClick={() => spawnWindow(app)}>{app.name}</button>
              </li>
            ))}
          </ul>
        </div>
      </div>
    </div>
  );
}

interface WindowDesc {
  id: number;
  app: App;
  initialPos: [number, number];
  initialSize: [number, number];
  z: number;
}

export default function WM() {
  const [windows, setWindows] = useState<WindowDesc[]>([]);
  const curZ = useRef(0);
  const curId = useRef(0);

  function spawnWindow(app: App) {
    const newWindow: WindowDesc = {
      id: ++curId.current,
      app,
      initialPos: [Math.random() * window.innerWidth, Math.random() * window.innerHeight],
      initialSize: [window.innerWidth / 3, window.innerHeight / 3],
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
      <Launchpad spawnWindow={spawnWindow} />
      {windows.map((w) => (
        <Window
          key={w.id}
          app={w.app}
          initialPos={w.initialPos}
          initialSize={w.initialSize}
          z={w.z}
          kill={() => killWindow(w.id)}
          bringToTop={() => modifyWindow(w => ({ ...w, z: ++curZ.current }), w.id)}
        />
      ))}
    </div>
  );
}
