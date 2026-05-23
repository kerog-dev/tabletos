import snapUrl from "../assets/snap.html?url";

export default function Snap() {
  return (
    <iframe
      src={snapUrl}
      title="Snap!"
      width={window.innerWidth}
      height={window.innerHeight}
    ></iframe>
  );
}
