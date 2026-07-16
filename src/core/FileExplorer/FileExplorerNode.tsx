import { useRef, useState } from "react";
import { ContextMenu } from "../../components/ContextMenu.tsx";
import "./Node.css";
import fileIcon from "vfs:/vendor/icons/file.png?url";
import folderIcon from "vfs:/vendor/icons/folder.png?url";
import { sdk } from "../../getsdk.ts";
import type { FileDesc } from "./FileExplorer.tsx";
import { extractZipInto, joinFsPath, zipDir } from "./zipping.ts";

const { fs, toast, Urgency, spawnWindow, useDialog } = sdk();

export function FileExplorerNode({ c, setCwd }: { c: FileDesc; setCwd: (cwd: string) => void }) {
  const [ctxMenuOpen, setCtxMenuOpen] = useState(false);
  const ctxParentRef = useRef<HTMLElement | null>(null);
  const dialog = useDialog();

  async function unlinkNode() {
    if (await dialog?.confirm("Are you sure you want to delete " + c.path + "?")) {
      fs.unlink(c.path).then(() => toast({ title: "Deleted", desc: `Deleted ${c.path}` })).catch(() =>
        toast({ title: "Failed to delete", desc: `Failed to delete ${c.path}`, urgency: Urgency.Error })
      );
    }
  }

  async function deleteNode() {
    if (
      await dialog?.confirm("Are you sure you want to delete " + c.path + "?")
      && await dialog?.confirm("This will delete RECURSIVELY!!, deleting the folder and all its children.")
    ) {
      fs.unlink(c.path, { recursive: true }).then(() => toast({ title: "Deleted", desc: `Deleted ${c.path}` }))
        .catch(() => toast({ title: "Failed to delete", desc: `Failed to delete ${c.path}`, urgency: Urgency.Error }));
    }
  }

  async function moveNode() {
    const target = await dialog?.prompt("Enter new path", undefined, c.path);
    if (!target) return;
    fs.move(c.path, target);
  }

  async function renameNode() {
    const newName = await dialog?.prompt("Enter new name", undefined, c.name);
    if (!newName) return;
    const parent = fs.parent(c.path);
    fs.move(c.path, (parent === "/" ? "" : parent) + "/" + newName);
  }

  async function downloadNode() {
    let content = await fs.readFile(c.path);
    if (typeof content === "string") content = new Blob([content]);
    const url = URL.createObjectURL(content);
    const a = document.createElement("a");
    a.href = url;
    a.download = c.name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 5000);
  }

  function openNode() {
    spawnWindow({
      app: "FileViewer",
      args: [c.path],
    });
  }

  function onDoubleClick() {
    if (c.isDir) setCwd(c.path);
    else openNode();
  }

  async function unzipInto() {
    const defaultDir = fs.parent(c.path);
    const targetDir = await dialog?.prompt("Unzip into which directory?", undefined, defaultDir);
    if (!targetDir) return;
    try {
      if (!(await fs.isDir(targetDir))) throw `${targetDir} is not a directory.`;
      await extractZipInto(c.path, targetDir);
      toast({ title: "Unzipped", desc: `Extracted ${c.name} into ${targetDir}` });
    } catch (e) {
      toast({ title: "Failed to unzip", desc: String(e), urgency: Urgency.Error });
    }
  }

  async function unzipAs() {
    const defaultName = c.name.replace(/\.zip$/i, "");
    const parentDir = fs.parent(c.path);
    const suggestedPath = joinFsPath(parentDir, defaultName);
    const targetDir = await dialog?.prompt("Extract into new folder at path:", undefined, suggestedPath);
    if (!targetDir) return;
    try {
      if (await fs.pathExists(targetDir)) throw `${targetDir} already exists.`;
      await fs.mkdirp(targetDir);
      await extractZipInto(c.path, targetDir);
      toast({ title: "Unzipped", desc: `Extracted ${c.name} to ${targetDir}` });
    } catch (e) {
      toast({ title: "Failed to unzip", desc: String(e), urgency: Urgency.Error });
    }
  }

  async function zipNode() {
    const target = await dialog?.prompt("Enter target path", undefined, c.path + ".zip");
    if (!target) return;
    try {
      await zipDir(c.path, target);
      toast({ title: "Zipped" });
    } catch (e) {
      toast({ title: "Failed to zip", desc: String(e), urgency: Urgency.Error });
    }
  }

  return (
    <div
      className="listing-item"
      onContextMenu={(e) => {
        e.preventDefault();
        setCtxMenuOpen(true);
      }}
      onDoubleClick={onDoubleClick}
      title={c.path}
    >
      <img className="item-icon" src={c.isDir ? folderIcon : fileIcon} />
      <span className="item-caption" ref={ctxParentRef}>{c.name}</span>
      <ContextMenu parent={ctxParentRef} open={ctxMenuOpen}>
        <ul>
          <li>
            <button onClick={() => openNode()}>Open</button>
          </li>
          <li>
            <button onClick={() => unlinkNode()}>Unlink</button>
          </li>
          <li>
            <button onClick={() => deleteNode()}>Delete</button>
          </li>
          <li>
            <button onClick={() => moveNode()}>Move</button>
          </li>
          <li>
            <button onClick={() => renameNode()}>Rename</button>
          </li>
          <li>
            <button onClick={() => downloadNode()}>Download</button>
          </li>
          {!c.isDir && c.name.endsWith(".zip") && (
            <>
              <li>
                <button onClick={() => unzipInto()}>Unzip into...</button>
              </li>
              <li>
                <button onClick={() => unzipAs()}>Unzip as...</button>
              </li>
            </>
          )}
          {c.isDir && (
            <li>
              <button onClick={() => zipNode()}>Zip</button>
            </li>
          )}
        </ul>
        <button
          onClick={() => setCtxMenuOpen(false)}
          style={{ position: "absolute", top: "0", right: "0", aspectRatio: "1 / 1", color: "red" }}
        >
          X
        </button>
      </ContextMenu>
    </div>
  );
}
