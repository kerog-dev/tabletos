import { useRef } from "react";
import "./System.css";
import { useRouter } from "../../components/Router.tsx";
import { setWindowTransparency } from "../../components/wm/wmdb.ts";
import { sdk } from "../../getsdk.ts";

const { fs } = sdk();

export function AppearanceSettingsPage() {
  const router = useRouter();
  const wallpaperInputRef = useRef<HTMLInputElement | null>(null);
  const wallpaperUrlInputRef = useRef<HTMLInputElement | null>(null);
  const windowTransparencyInputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div>
      <h1>Appearance settings</h1>
      <button onClick={() => router.navigate("Home")}>Back</button>
      <div>
        <section>
          <h2>Set wallpaper</h2>
          <input type="file" accept="image/*" ref={wallpaperInputRef} />
          <button
            onClick={() => {
              if (!wallpaperInputRef.current || wallpaperInputRef.current.files?.length !== 1) return;
              fs.writeFile("/wallpaper.img", wallpaperInputRef.current.files[0]);
            }}
          >
            Set wallpaper
          </button>
          <br />
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
          <br />
          You need to refresh to apply wallpaper change.
        </section>
        <section>
          <h2>Set window transparency</h2>
          <input type="number" ref={windowTransparencyInputRef} />%
          <button
            onClick={() => {
              if (!windowTransparencyInputRef.current) return;
              const value = Math.max(
                0,
                Math.min(100, Math.round(windowTransparencyInputRef.current.value as unknown as number)),
              );
              setWindowTransparency(value);
            }}
          >
            Set
          </button>
        </section>
      </div>
    </div>
  );
}
