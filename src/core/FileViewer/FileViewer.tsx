import { useState } from "react";
import { FilePicker } from "../../components/FilePicker.tsx";
import type { Sdk } from "../../sdk.ts";

const { fs }: Sdk = (window as any).$;

type SupportedType = "image" | "video" | "audio" | "document" | "script" | "unknown";

const EXTENSION_MAP: Record<string, SupportedType> = {
  jpg: "image",
  jpeg: "image",
  png: "image",
  gif: "image",
  bmp: "image",
  webp: "image",
  svg: "image",
  ico: "image",
  tiff: "image",
  tif: "image",
  avif: "image",
  heic: "image",
  heif: "image",
  img: "image",

  mp4: "video",
  mov: "video",
  avi: "video",
  mkv: "video",
  webm: "video",
  flv: "video",
  wmv: "video",
  m4v: "video",
  mpeg: "video",
  mpg: "video",
  "3gp": "video",
  vid: "video",

  mp3: "audio",
  wav: "audio",
  ogg: "audio",
  flac: "audio",
  aac: "audio",
  m4a: "audio",
  wma: "audio",
  opus: "audio",
  aiff: "audio",
  aud: "audio",
  audio: "audio",

  pdf: "document",
};

function getFileType(path: string): SupportedType {
  const match = path.match(/\.([a-z0-9]+)$/i);
  if (!match) return "unknown";
  const ext = match[1].toLowerCase();
  return EXTENSION_MAP[ext] || "unknown";
}

function renderFile(type: SupportedType, blobUrl: string, path: string) {
  const style = {
    width: "100%",
    height: "100%",
    objectFit: "contain",
  };
  switch (type) {
    case "image":
      return <img {...style} src={blobUrl} alt="" />;

    case "video":
      return <video {...style} src={blobUrl} controls />;

    case "audio":
      return <audio {...style} src={blobUrl} controls />;

    case "document":
      return <iframe {...style} src={blobUrl} />;

    case "unknown":
      return <a href={blobUrl} download>{path.split("/").at(-1)}</a>;
  }
}

export default function FileViewer({ args }: { args: [string | undefined] }) {
  const [path, setPath] = useState<string | null>(args[0] ?? null);
  const blobUrl = fs.useBlobFileUrl(path);

  if (path === null) return <FilePicker setPath={setPath} />;

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {blobUrl ? renderFile(getFileType(path), blobUrl, path) : <p>Loading...</p>}
    </div>
  );
}
