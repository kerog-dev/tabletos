import { useRef } from "react";
import { setTray } from "../components/wm/tray.ts";
import * as fs from "../fs.ts";
import { exportJSON, importJSON } from "../storage.ts";
import storage from "../storage.ts";

setInterval(() => {
  setTray({
    id: "system",
    name: "System",
    iconUrl: "",
    show() {
      return <p>hi</p>;
    },
  });
}, 500);

export default function System() {
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const wallpaperUrlInputRef = useRef<HTMLInputElement | null>(null);
  const windowTransparencyInputRef = useRef<HTMLInputElement | null>(null);

  function clearStorage() {
    localStorage.setItem("tabletos", "{}");
  }

  function doExport() {
    const data = exportJSON();
    const blob = new Blob([data], { type: "application/json" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = "tabletos_data.json";
    a.click();
  }

  function doImport() {
    const input = document.createElement("input");
    input.type = "file";
    input.accept = ".json";
    input.onchange = (e) => {
      const file = (e.target as HTMLInputElement).files?.[0];
      if (file) {
        const reader = new FileReader();
        reader.onload = (e) => {
          const data = e.target?.result as string;
          if (
            confirm(
              "Are you sure you want to import this file? This will overwrite your current data.",
            )
          ) {
            importJSON(data);
          }
        };
        reader.readAsText(file);
      }
    };
    input.click();
  }

  return (
    <div>
      system operations:<br />
      <button onClick={() => clearStorage()}>Clear storage</button>
      <div className="file-backup">
        File backup export/import
        <button
          onClick={doExport}
        >
          Export JSON
        </button>
        <button
          onClick={doImport}
        >
          Import JSON
        </button>
      </div>
      <div>
        Set wallpaper <input type="file" accept="image/*" ref={wallpaperInputRef} />
        <button
          onClick={() => {
            if (!wallpaperInputRef.current || wallpaperInputRef.current.files?.length !== 1) return;
            fs.writeFile("/wallpaper.img", wallpaperInputRef.current.files[0]);
          }}
        >
          Set wallpaper
        </button>
        Or set from URL:
        <input type="text" ref={wallpaperUrlInputRef} />
        <button
          onClick={async () => {
            const url = wallpaperUrlInputRef.current?.value ?? "";
            const res = await fetch(url);
            const blob = await res.blob();
            fs.writeFile("/wallpaper.img", blob);
          }}
        >
          Set wallpaper
        </button>
        You might need to refresh to apply wallpaper change.
        <br />
        Set window transparency (%):
        <input type="number" ref={windowTransparencyInputRef} />
        <button
          onClick={() => {
            if (!windowTransparencyInputRef.current) return;
            const value = Math.max(
              0,
              Math.min(100, Math.round(windowTransparencyInputRef.current.value as unknown as number)),
            );
            storage.windowTransparency = value;
          }}
        >
          Set
        </button>
      </div>
    </div>
  );
}
