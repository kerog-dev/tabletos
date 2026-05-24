import snapHtml from "../assets/snap.html?raw";

export default function Snap() {
  const blob = new Blob([snapHtml], { type: "text/html" });
  const url = URL.createObjectURL(blob);
  return (
    <iframe
      src={url}
      title="Snap!"
      width={window.innerWidth}
      height={window.innerHeight}
      sandbox="allow-scripts allow-same-origin allow-camera allow-microphone"
    ></iframe>
  );
}
