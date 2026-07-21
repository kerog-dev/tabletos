import { useRef, useState } from "react";
import { sdk } from "../../getsdk.ts";
import { formatTime } from "../../utils.ts";
import styles from "./Chat.module.css";
import type { Controller, DBMessage, MessagePart } from "./service.ts";

const { sv, useDialog } = sdk();

const serviceName = "Chat Service";

function MessagePart({ p }: { p: MessagePart }) {
  switch (p.type) {
    case "text":
      return <p className={styles["message-part"]}>{p.content}</p>;

    case "code":
      return <code className={styles["message-part"]}>{p.content}</code>;

    case "runnable":
      return <p className={styles["message-part"]}>Runnable. (not executable right now for security)</p>;

    case "link":
      return <a href={p.url} className={styles["message-part"]}>{p.name}</a>;

    case "inline-text":
      return <span className={styles["message-part"]}>{p.content}</span>;
  }
}

function Message({ m }: { m: DBMessage }) {
  return (
    <div className={`${styles["message"]} ` + (m.me ? styles["from-me"] : styles["from-other"])}>
      <div className={styles["message-ts"]}>{formatTime(m.ts)}</div>
      <div className={styles["message-content"]}>
        {m.parts.map(p => <MessagePart p={p} />)}
      </div>
    </div>
  );
}

function ChatAppReady({ exposed }: { exposed: Controller }) {
  const chats = exposed.useChats();
  const [selected, setSelected] = useState<string | null>(null);
  const chat = exposed.useChat(selected);
  const composeInputRef = useRef<HTMLInputElement | null>(null);
  const dialog = useDialog();

  async function startChat() {
    const id = await dialog?.prompt("Target user device id");
    if (!id) return;
    exposed.startChat(id);
  }

  function sendMessage() {
    if (!composeInputRef.current || !chat) return;
    exposed.sendMessage(chat.id, [{ type: "text", content: composeInputRef.current.value }]);
    composeInputRef.current.value = "";
  }

  return (
    <div className={styles["app"]}>
      <div className={styles["navbar"]}>
        <button onClick={() => startChat()}>Start new chat</button>
        <ul className={styles["chat-list"]}>
          {chats.map(c => (
            <li key={c.id}>
              <button onClick={() => setSelected(c.id)}>{c.id}</button>
            </li>
          ))}
        </ul>
      </div>
      <div className={styles["chat-area"]}>
        {chat
          && (
            <>
              <div className={styles["chat-topbar"]}>
                started at {formatTime(chat.startedAt)}
              </div>
              <div className={styles["chat-messages"]}>{chat.messages.map(m => <Message key={m.ts} m={m} />)}</div>
              <div className={styles["chat-send"]}>
                <input type="text" ref={composeInputRef} className={styles["chat-compose"]} />
                <button onClick={() => sendMessage()} className={styles["chat-send-btn"]}>Send</button>
              </div>
            </>
          )}
      </div>
    </div>
  );
}

export default function ChatApp() {
  const exposed = sv.use<Controller>(serviceName);

  if (!exposed) {
    return (
      <div>
        Chat service is not running. <button onClick={() => sv.start(serviceName)}>Start</button>
      </div>
    );
  }

  return <ChatAppReady exposed={exposed} />;
}
