import insane from "insane";
import * as marked from "marked";
import { useRef, useState } from "react";
import { sdk } from "../../getsdk.ts";
import type { ChatInterface } from "../AIService/ai.ts";
import type { AISdk } from "../AIService/service.ts";

const { sv } = sdk();

const ai = sv.get<AISdk>("AI SDK Service");

function ChatSelector({ setId }: { setId: (id: string) => void }) {
  const apiKeyInputRef = useRef<HTMLInputElement | null>(null);
  const chats = ai ? ai.useChats() : null;

  function setApiKey() {
    if (!apiKeyInputRef.current || !ai) return;
    ai.setGeminiApiKey(apiKeyInputRef.current.value);
  }

  if (!ai || !chats) return <div>AI Sdk Service not installed.</div>;

  return (
    <div>
      <input type="text" ref={apiKeyInputRef} />
      <button onClick={() => setApiKey()}>Set API Key</button>
      <button onClick={() => setId(ai.startChat("gemini-2.5-flash").id)}>Create new chat</button>
      <div>
        {chats.map(c => (
          <div key={c}>
            <button onClick={() => setId(c)}>{c}</button>
          </div>
        ))}
      </div>
    </div>
  );
}

function Chat({ i }: { i: ChatInterface }) {
  const messageInputRef = useRef<HTMLInputElement | null>(null);
  const sendingRef = useRef(false);
  const history = i.useHistory();

  async function send() {
    if (sendingRef.current || !messageInputRef.current) return;
    sendingRef.current = true;
    await i.send({ type: "text", content: messageInputRef.current.value });
    sendingRef.current = false;
  }

  return (
    <div>
      {history.map((c, j) =>
        c.parts.map((p, i) => (
          <div key={`${j}-${i}`}>
            {c.role}: {"text" in p
              ? <span dangerouslySetInnerHTML={{ __html: insane(marked.parse(p.text) as string) }} />
              : "fileData" in p
              ? p.fileData.mimeType.startsWith("image/") ? <img src={p.fileData.fileUri} /> : "Not an image"
              : "Inline Data"}
          </div>
        ))
      )}
      <input type="text" ref={messageInputRef} />
      <button onClick={() => send()}>Send</button>
    </div>
  );
}

export default function AI() {
  const [id, setId] = useState<string | null>(null);
  const resumed = id && ai ? ai.resumeChat(id) : null;

  if (!ai) return <div>AI Sdk Service not installed</div>;
  if (!id) return <ChatSelector setId={setId} />;
  if (!resumed) return <div>Loading...</div>;
  return <Chat i={resumed} />;
}
