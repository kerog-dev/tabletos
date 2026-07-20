import { type ReactNode, useEffect, useState } from "react";
import { FileEmbed } from "../../components/FileEmbed.tsx";
import { MarkdownComponent } from "../../components/MarkdownComponent.tsx";
import { isDir, isText, list, parent, readBlob, readText } from "./pagesfs.ts";

const resolve = (base: string, href: string) => {
  const parts = base.split("/").filter(Boolean);
  for (const segment of href.split("/")) {
    if (segment === "..") parts.pop();
    else if (segment !== ".") parts.push(segment);
  }
  return "/" + parts.join("/");
};

function DirComponent(
  { path, listing, setPath }: { path: string; listing: string[]; setPath: (path: string) => void },
) {
  return (
    <>
      Listing of {path}:<br />
      {listing.map(e => <button onClick={() => setPath(path + (path === "/" ? "" : "/") + e)}>{e}</button>)}
    </>
  );
}

function TextComponent({ path, text, setPath }: { path: string; text: string; setPath: (path: string) => void }) {
  if (!path.endsWith(".md")) {
    return (
      <>
        Raw text of {path}:<br />
        <pre>{text}</pre>
      </>
    );
  }

  return (
    <>
      <div
        onClick={e => {
          e.preventDefault();
          const link = (e.target as HTMLElement).closest("a");
          if (!link) return;
          const href = decodeURIComponent(link.getAttribute("href") ?? "");
          if (href) setPath(resolve(parent(path), href));
        }}
      >
        <MarkdownComponent src={text} />
      </div>
    </>
  );
}

export default function Manual() {
  const [path, setPath] = useState("/");
  const [content, setContent] = useState<ReactNode>(() => <p>Loading...</p>);

  const up = () => setPath(parent(path));

  useEffect(() => {
    (async () => {
      const dir = await isDir(path);
      if (dir) {
        const listing = await list(path);
        const indexPath = path + (path.endsWith("/") ? "" : "/") + "index.md";
        const hasIndex = await isText(indexPath);
        const indexText = hasIndex ? await readText(indexPath) : "";
        if (hasIndex) setContent(() => <TextComponent path={indexPath} text={indexText} setPath={setPath} />);
        else setContent(() => <DirComponent path={path} listing={listing} setPath={setPath} />);
      } else {
        const istext = await isText(path);
        if (istext) {
          const text = await readText(path);
          setContent(() => <TextComponent path={path} text={text} setPath={setPath} />);
        } else {
          const blob = await readBlob(path);
          setContent(() => <FileEmbed path={path} content={blob} />);
        }
      }
    })();
  }, [path]);

  return (
    <div>
      Welcome to the manual app!
      <br />
      {path} <button onClick={up}>Up</button>
      <br />
      {content}
    </div>
  );
}
