import { useEffect, useRef, useState } from "react";
import type { Sdk } from "../../sdk";

const { conn }: Sdk = (window as any).$;

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
    conn.exposeObject(object, "chat");
    return () => conn.unexposeObject("chat");
  }, []);

  async function send() {
    if (!senderNameInputRef.current || !userIdInputRef.current || !messageInputRef.current) return;
    const senderName = senderNameInputRef.current.value;
    const userId = userIdInputRef.current.value;
    const message = messageInputRef.current.value;
    const proxy = await conn.proxyObject<{ send(user: string, id: string, message: string): void }>(
      userId,
      "chat",
    );
    await proxy.send(senderName, conn.name, message);
  }

  return (
    <div>
      <p>your id: {conn.name}</p>
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
