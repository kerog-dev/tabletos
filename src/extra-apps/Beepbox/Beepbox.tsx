import { useEffect, useState } from "react";
import compressedUri from "./assets/beepbox_offline.html.gz?url";

export default function Beepbox() {
  const [outputUrl, setOutputUrl] = useState<string | null>(null);
  const [srcDoc, setSrcDoc] = useState("");

  useEffect(() =>
    void (async () => {
      const checkBlob = await (await fetch(compressedUri)).blob();
      const checkText = await checkBlob.text();
      if (checkText.startsWith("<!")) {
        setOutputUrl(compressedUri);
        return;
      }
      const stream = (await (await fetch(compressedUri)).blob()).stream().pipeThrough(new DecompressionStream("gzip"));
      const reader = stream.getReader();
      const chunks = [];

      while (true) {
        const { done, value } = await reader.read();
        if (done) break;
        chunks.push(value);
      }

      const outputBlob = new Blob(chunks);
      setSrcDoc(await outputBlob.text());
    })(), []);

  return (
    <iframe
      src={srcDoc ? undefined : outputUrl ?? "about:blank"}
      srcDoc={outputUrl ? undefined : srcDoc}
      title="Beepbox"
      style={{ width: "100%", height: "100%" }}
      sandbox="allow-scripts allow-same-origin allow-downloads"
    >
    </iframe>
  );
}
