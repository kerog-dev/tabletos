import { useState } from "react";
import { sdk } from "../../getsdk.ts";
import appIconUrl from "./icon.png?url";
import { type Control } from "./service.ts";

const { sv, conn: { name: connName }, fs, tray } = sdk();

const serviceName = "File Sharing Service";

tray.set({
  id: "fileshare",
  name: "File Share",
  iconUrl: appIconUrl,
  ui() {
    function Ready({ service }: { service: Control }) {
      const progresses = service.useTransferProgresses();

      return (
        <ul>
          {progresses.map(p => (
            <li key={`${p.name}---${p.progress}---${p.isSender}`}>
              {p.name} {p.isSender ? "to" : "from"} {p.otherClient}
              <progress max="1" value={p.progress}></progress>
            </li>
          ))}
        </ul>
      );
    }

    const service = sv.use<Control>(serviceName);
    if (service) return <Ready service={service} />;
    else return <p>Service is not started?</p>;
  },
});

export default function FileShare() {
  const [sourceMode, setSourceMode] = useState<"local" | "virtual">("local");
  const [localFile, setLocalFile] = useState<File | null>(null);
  const [virtualPath, setVirtualPath] = useState("");
  const [targetClient, setTargetClient] = useState("");
  const [filename, setFilename] = useState("");
  const [progress, setProgress] = useState(0);
  const [sending, setSending] = useState(false);
  const [error, setError] = useState<string | null>(null);

  async function handleSend() {
    setError(null);
    const control = sv.get<Control>(serviceName);
    if (!control) {
      setError("File sharing service not running.");
      return;
    }

    if (!targetClient || !filename) {
      setError("Target client and filename are required");
      return;
    }

    let blob: Blob;
    try {
      if (sourceMode === "virtual") {
        if (!virtualPath) {
          setError("Enter a virtual file path");
          return;
        }
        blob = await fs.readBlobFile(virtualPath);
      } else {
        if (!localFile) {
          setError("Choose a file");
          return;
        }
        blob = localFile;
      }
    } catch (err) {
      setError(`Couldn't read file: ${err}`);
      return;
    }

    setSending(true);
    setProgress(0);
    await control.sendFile({
      blob,
      targetClient,
      filename,
      onError: e => setError(e),
      onProgress: p => setProgress(p),
      onFinished: () => setSending(false),
    });
  }

  return (
    <div style={{ display: "flex", flexDirection: "column", gap: 8, maxWidth: 360 }}>
      You are: {connName}

      <div>
        <label>
          <input
            type="radio"
            checked={sourceMode === "local"}
            onChange={() => setSourceMode("local")}
          />{" "}
          Local file
        </label>
        <label style={{ marginLeft: 12 }}>
          <input
            type="radio"
            checked={sourceMode === "virtual"}
            onChange={() => setSourceMode("virtual")}
          />{" "}
          Virtual file
        </label>
      </div>

      {sourceMode === "local"
        ? (
          <input
            key={"local-file-select"}
            type="file"
            onChange={(e) => {
              const f = e.target.files?.[0] ?? null;
              setLocalFile(f);
              if (f && !filename) setFilename(f.name);
            }}
          />
        )
        : (
          <input
            key={"virtual-file-select"}
            type="text"
            placeholder="/path/in/virtual/fs"
            value={virtualPath}
            onChange={(e) => setVirtualPath(e.target.value)}
          />
        )}

      <input
        type="text"
        placeholder="Target client (e.g. tabletos-1a2b3c)"
        value={targetClient}
        onChange={(e) => setTargetClient(e.target.value)}
      />

      <input
        type="text"
        placeholder="Filename"
        value={filename}
        onChange={(e) => setFilename(e.target.value)}
      />

      <button onClick={handleSend} disabled={sending}>
        {sending ? "Sending…" : "Send"}
      </button>

      {error && <div style={{ color: "red" }}>{error}</div>}

      <progress value={progress} max={100} style={{ width: "100%" }} />
    </div>
  );
}
