import { useEffect, useState } from "react";
import startIcon from "vfs:/vendor/icons/start.png?url";
import { useBlobFileUrl } from "../../lib/fs.ts";
import { Toasts } from "../../toast.tsx";
import { Launcher } from "./Launcher.tsx";
import styles from "./Taskbar.module.css";
import { setTrayOpen, useTrayDescs } from "./tray.ts";
import { bringToTop, killWindow, useWindows, type WindowDesc } from "./windowsStore.ts";

function TaskbarWindowCtx({ w, close, closeWindow }: { w: WindowDesc; close: () => void; closeWindow: () => void }) {
  return (
    <div className={styles["taskbar-window-ctx"]} onClick={close}>
      {w.app.name}
      <br />
      <button onClick={closeWindow}>Close</button>
      <br />
    </div>
  );
}

export function Taskbar() {
  const windows = useWindows();
  const [launcherOpen, setLauncherOpen] = useState(false);
  const [contextMenuOpens, setContextMenuOpens] = useState(() => Object.fromEntries(windows.map(w => [w.id, false])));
  const trayDescs = useTrayDescs();
  const noIconUrl = useBlobFileUrl("/vendor/icons/noicon.png");

  useEffect(() => {
    const old = contextMenuOpens;
    for (const w of windows) if (!(w.id.toString() in old)) setContextMenuOpens(old => ({ [w.id]: false, ...old }));
  }, [windows]);

  return (
    <>
      <div className={styles.taskbar}>
        <button
          className={styles["start-button"]}
          onClick={() => setLauncherOpen(open => !open)}
        >
          <img style={{ width: "100%", height: "100%", imageRendering: "pixelated" }} src={startIcon} />
        </button>
        <div className={styles["window-list"]}>
          {windows.map(w => (
            <div
              key={w.id}
              className={styles["taskbar-window"]}
              onContextMenu={e => {
                e.preventDefault();
                setContextMenuOpens(contextMenuOpens => ({ ...contextMenuOpens, [w.id]: true }));
              }}
            >
              <button className={styles["taskbar-window-btn"]} onClick={() => bringToTop(w.id)}>{w.app.name}</button>
              {contextMenuOpens[w.id] && (
                <TaskbarWindowCtx
                  w={w}
                  close={() => setContextMenuOpens(c => ({ ...c, [w.id]: false }))}
                  closeWindow={() => killWindow(w.id)}
                />
              )}
            </div>
          ))}
        </div>
        <div className={styles.tray}>
          {Object.values(trayDescs).map(t => (
            <div key={t.id} className={styles["tray-entry"]}>
              <img
                className={styles["tray-entry-image"]}
                width={30}
                height={30}
                src={t.iconUrl ?? noIconUrl ?? ""}
                title={t.name}
                onClick={() => setTrayOpen(t.id, true)}
                style={{ anchorName: `--tray-anchor-${t.id}` }}
              />
              <div
                className={styles["tray-entry-popup"]}
                style={{ display: t.open ? "unset" : "none", positionAnchor: `--tray-anchor-${t.id}` }}
                onClick={() => setTrayOpen(t.id, false)}
              >
                {t.open && <t.ui />}
              </div>
            </div>
          ))}
        </div>
      </div>
      <Toasts />
      <Launcher open={launcherOpen} setOpen={setLauncherOpen} />
    </>
  );
}
