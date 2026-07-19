import { useState } from "react";
import { FileEmbed } from "../../components/FileEmbed.tsx";
import { FilePicker } from "../../components/FilePicker.tsx";
import { sdk } from "../../getsdk.ts";

const { fs } = sdk();

export default function FileViewer({ args }: { args: [string | undefined] }) {
  const [path, setPath] = useState<string | null>(args[0] ?? null);
  const file = fs.useFile(path);

  if (path === null) return <FilePicker setPath={setPath} />;

  return <FileEmbed path={path} content={file} />;
}
