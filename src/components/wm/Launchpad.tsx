import { useState } from "react";
import { type App, apps } from "../../apps.ts";

export function Launchpad({ spawnWindow, killAll }: { spawnWindow: (app: App) => void; killAll: () => void }) {
  const [open, setOpen] = useState(false);

  return (
    <div style={{ position: "fixed", bottom: "0", left: "0", margin: "10px", zIndex: "9999" }}>
      <button style={{ width: "60px", height: "60px", fontSize: "200%" }} onClick={() => setOpen(open => !open)}>
        {"<!>"}
      </button>
      <div
        style={{
          display: open ? "unset" : "none",
          position: "fixed",
          bottom: "80px",
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
                <button
                  onClick={() => {
                    spawnWindow(app);
                    setOpen(false);
                  }}
                >
                  {app.name}
                </button>
              </li>
            ))}
          </ul>
        </div>
        <div>
          <button onClick={() => document.body.requestFullscreen()}>Fullscreen</button>
          <br />
          <button onClick={() => killAll()}>Close all</button>
          <br />
        </div>
      </div>
    </div>
  );
}
