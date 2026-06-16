const id = (Math.floor(Math.random() * 0xfffff)).toString(16);

const ws = new WebSocket("ws://192.168.1.31:8085/");
ws.addEventListener("open", () => {
  ws.send(JSON.stringify({
    type: "js-server-announce",
    id,
  }));
});

ws.addEventListener("message", e => {
  const msg = JSON.parse(e.data.toString());
  if (msg.type === "js-server-run" && msg.targetId === id) {
    let result;
    try {
      result = String(window.eval(msg.code));
    } catch (e) {
      result = "Error: " + String(e);
    }
    ws.send(JSON.stringify({
      type: "js-server-result",
      id,
      result,
    }));
  }
});

// TODO: only allow execution while visible
export default function JSServer() {
  return (
    <div>
      <span>{ws.readyState === ws.CLOSED ? "closed" : ws.readyState === ws.OPEN ? "open" : "idk"}</span>
      <br />
      <span>{id}</span>
    </div>
  );
}
