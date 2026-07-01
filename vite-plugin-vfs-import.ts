const readScript = (path: string) =>
  `await (async () => {
  try {
    await window.$ready;
    return await window.$.fs.readBlobFile('${path}');
  } catch (e) {
    console.error('VFS import error for ${path} ==> ' + e);
    return undefined;
  }
})()`;

export default function vfsImport() {
  return {
    name: "vfs-import",
    resolveId(id: string) {
      if (id.startsWith("vfs:")) return "\0" + id;
    },
    load(id: string) {
      if (!id.startsWith("\0vfs:")) return;
      const [path, query] = id.slice(5).split("?");
      const fsPath = path.startsWith("/") ? path : "/" + path;

      if (query === "url") {
        return `const blob = ${
          readScript(fsPath)
        }; export default blob === undefined ? undefined : URL.createObjectURL(blob);`;
      }

      return `export default ${readScript(fsPath)};`;
    },
  };
}
