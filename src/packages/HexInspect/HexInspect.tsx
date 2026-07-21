import { useMemo, useState } from "react";
import "./HexInspect.css";
import { FilePicker } from "../../components/FilePicker";
import { sdk } from "../../getsdk";

const { fs } = sdk();

export default function HexInspect() {
  const [content, setContent] = useState<number[] | null>(null);
  const decoded = useMemo(() =>
    content?.map((byte) => {
      return [byte.toString(16).padStart(2, "0"), String.fromCharCode(byte)];
    }), [content]);

  if (!decoded) {
    return <FilePicker setPath={async path => setContent([...await (await fs.readBlobFile(path)).bytes()])} />;
  }

  return (
    <div className="app">
      <div style={{ whiteSpace: "pre-wrap" }}>
        {decoded.map(v => {
          return <span>{v[0]}{" "}</span>;
        })}
      </div>
      <div style={{ whiteSpace: "pre-wrap" }}>
        {decoded.map(v => {
          return <span>{v[1]}{"  "}</span>;
        })}
      </div>
    </div>
  );
}
