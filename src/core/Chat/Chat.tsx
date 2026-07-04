import { useRef, useState } from "react";
import type { Sdk } from "../../sdk.ts";
import type { Controller, DBMessage, MessagePart } from "./service.ts";
import "./Chat.css";

const { sv }: Sdk = (window as any).$;

const serviceName = "Chat Service";

function MessagePart({ p }: { p: MessagePart }) {
  switch (p.type) {
    case "text":
      return <p className="message-part">{p.content}</p>;

    case "code":
      return <code className="message-part">{p.content}</code>;

    case "runnable":
      return <p className="message-part">Runnable. (not executable right now for security)</p>;

    case "link":
      return <a href={p.url} className="message-part">{p.name}</a>;

    case "inline-text":
      return <span className="message-part">{p.content}</span>;
  }
}

function Message({ m }: { m: DBMessage }) {
  return (
    <div className={"message " + (m.me ? "from-me" : "from-other")}>
      <div className="message-ts">{(new Date(m.ts)).toLocaleDateString()} {(new Date(m.ts)).toLocaleTimeString()}</div>
      <div className="message-content">
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

  function startChat() {
    const id = prompt("Target user device id");
    if (!id) return;
    exposed.startChat(id);
  }

  function sendMessage() {
    if (!composeInputRef.current || !chat) return;
    exposed.sendMessage(chat.id, [{ type: "text", content: composeInputRef.current.value }]);
    composeInputRef.current.value = "";
  }

  return (
    <div className="app">
      <div className="navbar">
        <button onClick={() => startChat()}>Start new chat</button>
        <ul className="chat-list">
          {chats.map(c => (
            <li key={c.id}>
              <button onClick={() => setSelected(c.id)}>{c.id}</button>
            </li>
          ))}
        </ul>
      </div>
      <div className="chat-area">
        {chat
          && (
            <>
              <div className="chat-topbar">
                started at {(new Date(chat.startedAt)).toLocaleDateString()}{" "}
                {(new Date(chat.startedAt)).toLocaleTimeString()}
              </div>
              <div className="chat-messages">{chat.messages.map(m => <Message key={m.ts} m={m} />)}</div>
              <div className="chat-send">
                <input type="text" ref={composeInputRef} className="chat-compose" />
                <button onClick={() => sendMessage()} className="chat-send-btn">Send</button>
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
