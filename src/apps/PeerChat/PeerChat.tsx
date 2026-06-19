import { useEffect, useRef, useState } from "react";
import { RpcConnection } from "../../applib/rpc.ts";
import { getServerAddr } from "../../server.ts";

const uid = Math.floor(Math.random() * 0xf0000000).toString(16);
const connection = new RpcConnection((await getServerAddr())?.replace("8086", "8085")!, "peerchat-" + uid);

export default function PeerChat() {
  const [inbox, setInbox] = useState<[string, string, string][]>([]);
  const senderNameInputRef = useRef<HTMLInputElement | null>(null);
  const userIdInputRef = useRef<HTMLInputElement | null>(null);
  const messageInputRef = useRef<HTMLInputElement | null>(null);

  useEffect(() => {
    const object = {
      send(user: string, id: string, message: string) {
        setInbox(inbox => [...inbox, [user, id, message]]);
      },
    };
    connection.exposeObject(object, "chat");
    return () => connection.unexposeObject("chat");
  }, []);

  async function send() {
    if (!senderNameInputRef.current || !userIdInputRef.current || !messageInputRef.current) return;
    const senderName = senderNameInputRef.current.value;
    const userId = userIdInputRef.current.value;
    const message = messageInputRef.current.value;
    const proxy = await connection.proxyObject<{ send(user: string, id: string, message: string): void }>(
      userId,
      "chat",
    );
    await proxy.send(senderName, uid, message);
  }

  return (
    <div>
      <p>your id: {uid}</p>
      <div>
        {inbox.map(([user, id, message]) => (
          <>
            <span>{user} (id {id}): {message}</span>
            <br />
          </>
        ))}
      </div>
      <input type="text" ref={senderNameInputRef} placeholder="your name" />
      <input type="text" ref={userIdInputRef} placeholder="user id" />
      <input type="text" ref={messageInputRef} placeholder="message" />
      <button onClick={() => send()}>Send</button>
    </div>
  );
}
