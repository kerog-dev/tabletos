import { useEffect, useRef, useState } from "react";

function doDiscovery(
  me: Peer,
  ws: WebSocket,
  setPeers: (peers: (peers: Peer[] | null) => Peer[]) => void,
) {
  const discoveryId = crypto.randomUUID();
  const peersFound: Peer[] = [];
  const listener = (e: MessageEvent) => {
    const data = JSON.parse(e.data.toString());

    switch (data.type) {
      case "discovery-response":
        if (data.mid !== discoveryId) {
          console.log(`${me.id}: not for me, ignoring`);
          break;
        }
        console.log(`${me.id}: response from ${data.id}`);
        peersFound.push({
          id: data.id,
          name: data.name,
        });
        break;
    }
  };

  send(ws, {
    type: "hello",
    mid: discoveryId,
    id: me.id,
    name: me.name,
  });

  setTimeout(() => {
    setPeers(peers => [...(peers || []), ...peersFound]);
    ws.removeEventListener("message", listener);
  }, 5_000);

  ws.addEventListener("message", listener);
}

const send = (ws: WebSocket, o: Record<string, any> & { type: string }) => ws.send(JSON.stringify(o));

function DeviceDataEntry({ setMe }: { setMe: (me: Peer) => void }) {
  const inputRef = useRef<HTMLInputElement | null>(null);
  const randomId = useRef(crypto.randomUUID());

  return (
    <div>
      <input ref={inputRef} type="text" />
      <button onClick={() => setMe({ id: randomId.current, name: inputRef.current?.value ?? randomId.current })}>
        Set device name
      </button>
    </div>
  );
}

function SignallerSelect({ setSignaller, me }: { setSignaller: (signaller: string | null) => void; me: Peer }) {
  const inputRef = useRef<HTMLInputElement | null>(null);

  return (
    <div>
      You are {me.name} ({me.id})
      <input ref={inputRef} type="text" />
      <button onClick={() => setSignaller(inputRef.current?.value ?? null)}>Set signaller</button>
    </div>
  );
}

function PeerSelect(
  { peers, setPeers, setSelectedPeer, signaller, ws, me }: {
    peers: Peer[] | null;
    setPeers: (peers: Peer[] | ((peers: Peer[] | null) => Peer[])) => void;
    setSelectedPeer: (peer: Peer) => void;
    signaller: string;
    ws: WebSocket;
    me: Peer;
  },
) {
  useEffect(() => {
    const listener = (e: MessageEvent) => {
      const data = JSON.parse(e.data.toString());

      switch (data.type) {
        case "hello":
          console.log(`${me.id}: hello from ${data.id}`);
          console.log(peers);
          setPeers(peers => [...(peers ?? []), { id: data.id, name: data.name }]);
          console.log(data, peers);
          send(ws, {
            type: "discovery-response",
            mid: data.mid,
            id: me.id,
            name: me.name,
          });
          break;
      }
    };
    ws.addEventListener("message", listener);

    return () => ws.removeEventListener("message", listener);
  }, [ws]);

  if (ws.readyState === WebSocket.CLOSED) return <div>Failed to connect... Try closing and opening this app.</div>;

  return (
    <div>
      Connected to signaller: {signaller}
      {peers && (
        <ul>
          {peers.map(p => (
            <li key={p.id}>
              {p.name} ({p.id}){" "}
              <button
                onClick={() => setSelectedPeer(p)}
              >
                Pair
              </button>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}

interface Peer {
  id: string;
  name: string;
}

export default function PeerApp() {
  const [signaller, setSignaller] = useState<string | null>(null);
  const [peers, setPeers] = useState<Peer[] | null>(null);
  const [selectedPeer, setSelectedPeer] = useState<Peer | null>(null);
  const [me, setMe] = useState<Peer | null>(null);

  const ws = useRef<WebSocket | null>(null);

  useEffect(() => {
    if (signaller) {
      const websocket = new WebSocket("ws://" + signaller);
      ws.current = websocket;
      websocket.addEventListener("open", () => {
        if (!me) return;
        doDiscovery(me, websocket, setPeers);
      });
      return () => websocket.close();
    }
  }, [signaller]);

  if (me === null) return <DeviceDataEntry setMe={setMe} />;
  if (signaller === null) return <SignallerSelect setSignaller={setSignaller} me={me} />;
  if (ws.current === null || ws.current.readyState === WebSocket.CONNECTING) return <p>Connecting...</p>;
  if (peers === null || selectedPeer === null) {
    return (
      <PeerSelect
        peers={peers}
        setPeers={setPeers}
        setSelectedPeer={setSelectedPeer}
        signaller={signaller}
        ws={ws.current}
        me={me}
      />
    );
  }

  return (
    <p>
      End
      <br />
      signaller: {signaller}
      <br />
      peers: {JSON.stringify(peers)}
      <br />
      selected peer: {JSON.stringify(selectedPeer)}
      <br />
      me: {JSON.stringify(me)}
    </p>
  );
}
