import { Suspense, useEffect, useRef, useState } from "react";
import closeIcon from "vfs:/vendor/icons/close.png?url";
import fullscreenIcon from "vfs:/vendor/icons/fullscreen.png?url";
import minimizeIcon from "vfs:/vendor/icons/minimize.png?url";
import { type App } from "../../loader/loader.ts";
import { ContextMenu } from "../ContextMenu.tsx";
import ErrorBoundary from "../ErrorBoundary.tsx";
import { dragger } from "./drag.ts";
import styles from "./Window.module.css";
import { WindowContext } from "./WindowContext.tsx";
import { bringToTop, killWindow, setWindowTitle, toggleMinimized, useWindowDesc } from "./windowsStore.ts";
import { useWindowTransparency } from "./wmdb.ts";

function WindowContent(
  { app, hidden = false, args }: {
    app: App;
    hidden?: boolean;
    args: any[];
  },
) {
  const [errKey, setErrKey] = useState(0);

  return (
    <div
      style={{
        display: hidden ? "none" : "unset",
        margin: 0,
        padding: 0,
        width: "100%",
        height: "100%",
        overflow: "scroll",
      }}
    >
      <Suspense fallback={<p>Loading app...</p>}>
        <ErrorBoundary
          key={errKey}
          renderer={e => (
            <p>
              Error occured in app {app.name}: {String(e)}.{" "}
              <button onClick={() => setErrKey(n => n + 1)}>
                Refresh?
              </button>
            </p>
          )}
        >
          <app.component args={args} />
        </ErrorBoundary>
      </Suspense>
    </div>
  );
}

export function Window(
  { id, focusedWorkspace, getWindowAreaSize }: {
    id: number;
    focusedWorkspace: string;
    getWindowAreaSize: () => [number, number];
  },
) {
  const desc = useWindowDesc(id)!;
  const minimized = desc.minimized;
  const windowEl = useRef<HTMLDivElement | null>(null);
  const windowBarEl = useRef<HTMLDivElement | null>(null);
  const lastHeightRef = useRef<number | null>(null);
  const [fullscreen, setFullscreen] = useState(false);
  const [floatRect, setFloatRect] = useState({ x: 0, y: 0, width: 0, height: 0 });
  const isMountedRef = useRef<boolean>(false);
  const [ctxPos, setCtxPos] = useState<[number, number] | null>(null);
  const windowTransparency = useWindowTransparency();
  const [confirmer, setConfirmer] = useState<() => Promise<boolean> | boolean>(() => () => true);
  const kill = async () => {
    if (await confirmer()) killWindow(id);
  };

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
      windowEl.current.style.height = "98vh";
      windowEl.current.style.inset = "5px";
    } else {
      windowEl.current.style.inset = "unset";
      updateSize(() => [floatRect.width, floatRect.height]);
      updatePos(() => [floatRect.x, floatRect.y]);
      bringToTop(id);
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

  function getPos(): [number, number] {
    return [windowEl.current?.offsetLeft ?? 0, windowEl.current?.offsetTop ?? 0];
  }

  function getSize(): [number, number] {
    return [windowEl.current?.clientWidth ?? 0, windowEl.current?.clientHeight ?? 0];
  }

  function updatePos(updater: (old: [number, number]) => [number, number]) {
    if (!windowEl.current) return;
    const [x, y] = updater(getPos());
    const clamp = (pos: number, max: number, winsize: number) => Math.min(max - winsize, Math.max(pos, 0));
    const areaSize = getWindowAreaSize();
    windowEl.current.style.left = clamp(x, areaSize[0], windowEl.current.clientWidth) + "px";
    windowEl.current.style.top = clamp(y, areaSize[1], windowEl.current.clientHeight) + "px";
  }

  function updateSize(updater: (old: [number, number]) => [number, number]) {
    if (!windowEl.current) return;
    const [w, h] = updater(getSize());
    const clamp = (dim: number, containerVal: number) => Math.max(Math.min(dim, containerVal), 50);
    const containerSize = getWindowAreaSize();
    windowEl.current.style.width = clamp(w, containerSize[0]) + "px";
    windowEl.current.style.height = clamp(h, containerSize[1]) + "px";
  }

  useEffect(() => {
    updatePos(() => desc.initialPos);
    updateSize(() => desc.initialSize);
  }, []);

  useEffect(() => {
    if (!windowEl.current || !windowBarEl.current) return;
    const d = dragger(windowBarEl.current, () => !fullscreen);
    d.onStart(() => bringToTop(id));
    d.onMove(([cx, cy]) => updatePos(([ox, oy]) => [ox + cx, oy + cy]));

    const r = dragger(windowEl.current, () => !fullscreen);
    r.onStart(() => bringToTop(id));
    r.onMove(([cx, cy]) => updateSize(([ow, oh]) => [ow + cx, oh + cy]));

    return () => {
      d.destroy();
      r.destroy();
    };
  }, [fullscreen]);

  const hexOpacity = (((100 - windowTransparency) / 100) * 255).toString(16).padStart(2, "0");

  const windowCtx = {
    move({ x, y, absolute = true }: { x: number; y: number; absolute?: boolean }) {
      updatePos(([ox, oy]) => [absolute ? x : ox + x, absolute ? y : oy + y]);
    },
    resize({ w, h, absolute = true }: { w: number; h: number; absolute?: boolean }) {
      updateSize(([ow, oh]) => [absolute ? w : ow + w, absolute ? h : oh + h]);
    },
    pos: getPos,
    size: getSize,
    kill,
    setConfirmationRequired: (required?: () => Promise<boolean> | boolean) => {
      if (required) setConfirmer(() => required);
    },
    setTitle: (title: string | null) => {
      setWindowTitle(id, title);
    },
  };

  return (
    <div
      className={styles["window-container"]}
      style={{
        zIndex: fullscreen ? "10000" : desc.z,
        backgroundColor: `#ffffff${!fullscreen ? hexOpacity : ""}`,
        backdropFilter: !fullscreen ? "blur(4px)" : undefined,
        borderWidth: fullscreen ? "2px" : "8px",
        display: focusedWorkspace === desc.workspace ? undefined : "none",
      }}
      ref={windowEl}
      onClick={() => bringToTop(id)}
    >
      <ContextMenu
        open={ctxPos !== null}
        position={ctxPos ?? undefined}
        setOpen={(open) => {
          if (!open) setCtxPos(null);
        }}
      >
        <button style={{ position: "absolute", top: 0, right: 0 }} onClick={() => setCtxPos(null)}>X</button>
        <button onClick={() => setFullscreen(f => !f)}>Fullscreen</button>
        <br />
        <button onClick={() => toggleMinimized(id)}>Minimize</button>
        <br />
        <button onClick={() => kill()}>Close</button>
        <br />
      </ContextMenu>
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
        onContextMenu={e => {
          setCtxPos([e.clientX, e.clientY]);
          e.preventDefault();
        }}
        onClick={() => setCtxPos(null)}
      >
        <div>
          {desc.app.iconUrl && <img src={desc.app.iconUrl} />}
          <span>{desc.title ? `${desc.title} - ${desc.app.name}` : desc.app.name}</span>
        </div>
        <div>
          {([
            [fullscreenIcon, () => setFullscreen(f => !f)],
            ...(fullscreen
              ? []
              : [[minimizeIcon, () => toggleMinimized(id)]]),
            [closeIcon, kill],
          ] as ([string, () => void][]))
            .map(([icon, cb], i) => (
              <button key={i} onClick={() => (cb as () => void)()}>
                <img style={{ width: "100%", height: "100%", imageRendering: "pixelated" }} src={icon as string} />
              </button>
            ))}
        </div>
      </div>
      <WindowContext.Provider value={windowCtx}>
        <WindowContent app={desc.app} hidden={minimized} args={desc.args} />
      </WindowContext.Provider>
    </div>
  );
}
