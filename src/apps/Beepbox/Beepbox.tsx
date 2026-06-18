import { useMemo } from "react";
import editorSrc from "./assets/beepbox_editor.js?url";

export default function Beepbox() {
  const uri = useMemo(() => {
    const doc = `<!doctype html>
<html>
<head>
<title>Beepbox</title>
</head>
<body>
<div id="container"></div>
<script>
const script = document.createElement("script");
let editor;
script.addEventListener("load", () => {
	editor = new beepbox.SongEditor(document.getElementById("container"));
});
script.setAttribute("src", "${editorSrc}");
document.head.appendChild(script);
</script>
</body>
</html>`;
    const blob = new Blob([doc], { type: "text/html" });
    return (URL.createObjectURL(blob));
  }, []);

  return (
    <div style={{ width: "100%", height: "100%" }}>
      <iframe style={{ width: "100%", height: "100%" }} src={uri} />
    </div>
  );
}
