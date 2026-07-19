import { useEffect, useRef, useState } from "react";
import { FilePicker } from "../../components/FilePicker.tsx";
import { sdk } from "../../getsdk.ts";

const { fs, getAppDir } = sdk();
const appDir = await getAppDir("VideoPlayer");
const watchTimePath = `${appDir}/watchtimes.json`;
if (!(await fs.pathExists(watchTimePath))) await fs.writeFile(watchTimePath, "{}");

async function getWatchTimes(): Promise<Record<string, number>> {
  try {
    return JSON.parse(await fs.readTextFile(watchTimePath));
  } catch {
    return {};
  }
}

async function saveWatchTime(key: string, time: number) {
  const times = await getWatchTimes();
  times[key] = time;
  await fs.writeFile(watchTimePath, JSON.stringify(times));
}

const recentPath = `${appDir}/recent.json`;
if (!(await fs.pathExists(recentPath))) await fs.writeFile(recentPath, "[]");

async function getRecent(): Promise<string[]> {
  try {
    return JSON.parse(await fs.readTextFile(recentPath));
  } catch {
    return [];
  }
}

async function addRecent(entry: string) {
  const recent = await getRecent();
  const updated = [entry, ...recent.filter(r => r !== entry)].slice(0, 8);
  await fs.writeFile(recentPath, JSON.stringify(updated));
}

async function getValidRecent(): Promise<string[]> {
  const recent = await getRecent();
  const results = await Promise.all(recent.map(async entry => {
    const isRemote = entry.startsWith("http://") || entry.startsWith("https://");
    if (isRemote) return entry;
    const exists = await fs.pathExists(entry);
    return exists ? entry : null;
  }));
  const valid = results.filter((e): e is string => e !== null);
  if (valid.length !== recent.length) await fs.writeFile(recentPath, JSON.stringify(valid));
  return valid;
}

export default function VideoPlayer() {
  const [filePath, setFilePath] = useState<string | null>(null);
  const [videoUrl, setVideoUrl] = useState<string | null>(null);
  const [savedTime, setSavedTime] = useState(0);
  const [urlInput, setUrlInput] = useState("");
  const [recent, setRecent] = useState<string[]>([]);
  const videoRef = useRef<HTMLVideoElement>(null);
  const abortRef = useRef<AbortController | null>(null);

  useEffect(() => {
    getValidRecent().then(setRecent);
  }, []);

  useEffect(() => {
    if (!filePath) return;
    abortRef.current?.abort();
    const ac = new AbortController();
    abortRef.current = ac;
    const isRemote = filePath.startsWith("http://") || filePath.startsWith("https://");

    (async () => {
      try {
        let url: string;
        if (isRemote) {
          const { getServerAddr } = await import("../../lib/server.ts");
          const serverAddr = await getServerAddr();
          if (!serverAddr) throw new Error("No server available for remote video proxy");
          url = `${serverAddr}/proxy-get?url=${encodeURIComponent(filePath)}`;
        } else {
          const data = await fs.readFile(filePath);
          const blob = data instanceof Blob ? data : new Blob([data]);
          url = URL.createObjectURL(blob);
          ac.signal.addEventListener("abort", () => URL.revokeObjectURL(url));
        }
        if (!ac.signal.aborted) setVideoUrl(url);
        await addRecent(filePath);
        const times = await getWatchTimes();
        setSavedTime(times[filePath] ?? 0);
      } catch (e) {
        console.error("VideoPlayer error:", e);
      }
    })();

    const interval = setInterval(() => {
      const v = videoRef.current;
      if (v && !v.paused) saveWatchTime(filePath, v.currentTime);
    }, 5000);

    return () => {
      clearInterval(interval);
      ac.abort();
      const v = videoRef.current;
      if (v && filePath) saveWatchTime(filePath, v.currentTime);
    };
  }, [filePath]);

  if (!filePath) {
    return (
      <div>
        <div style={{ padding: 8, display: "flex", gap: 8 }}>
          <input
            style={{ flex: 1 }}
            placeholder="Paste a video URL..."
            value={urlInput}
            onChange={e => setUrlInput(e.target.value)}
          />
          <button
            disabled={!urlInput.startsWith("http")}
            onClick={() => {
              setFilePath(urlInput);
              setUrlInput("");
            }}
          >
            Open
          </button>
        </div>
        {recent.length > 0 && (
          <div style={{ padding: "0 8px 8px" }}>
            <div style={{ fontSize: 12, opacity: 0.5, marginBottom: 4 }}>Recent</div>
            <ul style={{ margin: 0, padding: 0, listStyle: "none" }}>
              {recent.map(entry => (
                <li key={entry}>
                  <button
                    style={{ width: "100%", textAlign: "left", padding: "2px 0" }}
                    onClick={() => setFilePath(entry)}
                    title={entry}
                  >
                    {entry.startsWith("http") ? "🌐 " : "📄 "}
                    {entry.length > 60 ? "..." + entry.slice(-57) : entry}
                  </button>
                </li>
              ))}
            </ul>
          </div>
        )}
        <FilePicker setPath={setFilePath} />
      </div>
    );
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", height: "100%" }}>
      <div style={{ padding: "4px 8px" }}>
        <button
          onClick={() => {
            abortRef.current?.abort();
            setFilePath(null);
            setVideoUrl(null);
          }}
        >
          ←
        </button>
        <span style={{ marginLeft: 8, fontSize: 12, opacity: 0.6 }}>{filePath}</span>
      </div>
      <video
        ref={videoRef}
        src={videoUrl ?? undefined}
        controls
        autoPlay
        style={{ flex: 1, width: "100%", background: "#000", minHeight: 0, display: videoUrl ? "block" : "none" }}
        onLoadedMetadata={() => {
          if (savedTime > 0 && videoRef.current) {
            videoRef.current.currentTime = savedTime;
          }
        }}
        onPause={() => {
          const v = videoRef.current;
          if (v && filePath) saveWatchTime(filePath, v.currentTime);
        }}
      />
    </div>
  );
}
