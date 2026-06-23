import { useEffect, useRef, useState } from "react";
import { type App } from "../../apps.ts";
import { toast } from "../../toast.tsx";
import { sleep } from "../../utils.ts";
import AppWindow from "../AppWindow.tsx";
import { windowTransparency } from "./WindowManager.tsx";

export function Window(
  { app, initialPos, initialSize, minimized, toggleMinimized, z, kill, bringToTop, args }: {
    app: App;
    initialPos: [number, number];
    initialSize: [number, number];
    z: number;
    kill: () => void;
    bringToTop: () => void;
    minimized: boolean;
    toggleMinimized: () => void;
    args: any[];
  },
) {
  const windowEl = useRef<HTMLDivElement | null>(null);
  const windowBarEl = useRef<HTMLDivElement | null>(null);
  const lastHeightRef = useRef<number | null>(null);
  const draggedRef = useRef<boolean>(false);
  const [fullscreen, setFullscreen] = useState(false);
  const [floatRect, setFloatRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const isMountedRef = useRef<boolean>(false);

  useEffect(() => {
    if (!windowEl.current) return;
    if (fullscreen) {
      setFloatRect({
        width: windowEl.current.clientWidth,
        height: windowEl.current.clientHeight,
        x: windowEl.current.offsetLeft,
        y: windowEl.current.offsetTop,
      });
      windowEl.current.style.width = "unset";
      windowEl.current.style.height = "unset";
      windowEl.current.style.inset = "5px";
    } else {
      windowEl.current.style.inset = "unset";
      windowEl.current.style.width = floatRect.width + "px";
      windowEl.current.style.height = floatRect.height + "px";
      windowEl.current.style.left = floatRect.x + "px";
      windowEl.current.style.top = floatRect.y + "px";
      bringToTop();
    }
  }, [fullscreen]);

  useEffect(() => {
    if (!isMountedRef.current) {
      isMountedRef.current = true;
      return;
    }
    if (!windowEl.current) return;
    if (minimized) {
      lastHeightRef.current = windowEl.current.clientHeight;
      windowEl.current.style.height = "30px";
    } else if (lastHeightRef.current !== null) {
      windowEl.current.style.height = lastHeightRef.current + "px";
    }
  }, [minimized]);

  async function startResize() {
    toast({ title: "Resizing window! Press somewhere to expand the window to that point." });
    await sleep(100);
    window.addEventListener("mouseup", e => {
      if (!windowEl.current) return;
      e.preventDefault();
      const [x, y] = [e.clientX, e.clientY];
      const [wx, wy] = [windowEl.current.offsetLeft, windowEl.current.offsetTop];

      windowEl.current.style.width = `${x - wx}px`;
      windowEl.current.style.height = `${y - wy}px`;
    }, { once: true });
  }

  useEffect(() => {
    if (!windowEl.current || !windowBarEl.current) return;

    windowEl.current.style.width = initialSize[0] + "px";
    windowEl.current.style.height = initialSize[1] + "px";
    windowEl.current.style.left = initialPos[0] + "px";
    windowEl.current.style.top = initialPos[1] + "px";

    const clampPos = () => {
      if (!windowEl.current) return;
      if (windowEl.current.offsetTop + windowEl.current.clientHeight + 5 > window.innerHeight) {
        windowEl.current.style.top = (window.innerHeight - windowEl.current.clientHeight - 5) + "px";
      }
      if (windowEl.current.offsetLeft + windowEl.current.clientWidth + 5 > window.innerWidth) {
        windowEl.current.style.left = (window.innerWidth - windowEl.current.clientWidth - 5) + "px";
      }
      windowEl.current.style.top = Math.max(0, windowEl.current.offsetTop) + "px";
      windowEl.current.style.left = Math.max(0, windowEl.current.offsetLeft) + "px";
    };

    let lastTouch: Touch | null = null;

    const touchStartListener = () => {
      draggedRef.current = true;
      clampPos();
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

  const hexTransparency = (((100 - windowTransparency) / 100) * 255).toString(16).padStart(2, "0");

  return (
    <div
      className="window-container"
      style={{
        zIndex: fullscreen ? "10000" : z,
        backgroundColor: fullscreen ? "#ffffff" : `#ffffff${hexTransparency}`,
      }}
      ref={windowEl}
      onClick={() => bringToTop()}
    >
      <div
        ref={windowBarEl}
        style={{
          display: "flex",
          justifyContent: "space-between",
          alignItems: "center",
          height: "30px",
          borderBottom: "1px solid blue",
          padding: "5px",
        }}
      >
        {app.name}
        <div>
          <button onClick={() => setFullscreen(f => !f)}>F</button>
          {!fullscreen && (
            <>
              <button onClick={() => startResize()}>!</button>
              <button onClick={() => toggleMinimized()}>_</button>
            </>
          )}
          <button onClick={() => kill()}>X</button>
        </div>
      </div>
      <AppWindow app={app} hidden={minimized} args={args} />
    </div>
  );
}
