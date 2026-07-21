import { useEffect, useState } from "react";

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
  video: "video",

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
    style: {
      width: "100%",
      height: "100%",
      objectFit: "contain" as any,
    },
  };
  switch (type) {
    case "image":
      return <img style={{ ...style.style, backgroundColor: "white" }} src={blobUrl} alt="" />;

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

export function FileEmbed({ path, content }: { path: string; content: Blob | string | null }) {
  const [blobUrl, setBlobUrl] = useState<string | null>(null);

  useEffect(() => {
    if (content === null || typeof content !== "object") {
      setBlobUrl(null);
      return;
    }
    const url = URL.createObjectURL(content);
    setBlobUrl(url);
    return () => URL.revokeObjectURL(url);
  }, [content]);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      {blobUrl
        ? renderFile(getFileType(path), blobUrl, path)
        : typeof content === "string"
        ? <pre style={{ width: "100%", height: "100%" }} children={content} />
        : <p>Loading file embed...</p>}
    </div>
  );
}
