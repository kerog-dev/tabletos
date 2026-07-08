import deviceName from "../../lib/devicename.ts";
import type { Service } from "../../loader/loader.ts";

interface MessagePartText {
  type: "text";
  content: string;
}

interface MessagePartCode {
  type: "code";
  content: string;
}

interface MessagePartRunnable {
  type: "runnable";
  content: string;
}

interface MessagePartLink {
  type: "link";
  name: string;
  url: string;
}

interface MessagePartInlineText {
  type: "inline-text";
  content: string;
}

export type MessagePart =
  | MessagePartText
  | MessagePartCode
  | MessagePartRunnable
  | MessagePartLink
  | MessagePartInlineText;

interface SendMessageObject {
  fromId: string;
  fromName: string;
  parts: MessagePart[];
}

interface ChatServiceObject {
  sendMessage(message: SendMessageObject): void;
}

export interface DBMessage {
  ts: number;
  parts: MessagePart[];
  me: boolean;
}

interface DBChat {
  startedAt: number;
  messages: DBMessage[];
}

interface DB {
  contacts: Record<string, string>;
  chats: Record<string, DBChat>;
  name: string;
}

interface ChatInfo {
  id: string;
  name: string;
  startedAt: number;
  messages: number;
}

export interface Controller {
  setName(name: string): void;
  sendMessage(targetId: string, parts: MessagePart[]): Promise<void>;
  useChats(): ChatInfo[];
  useChat(chat: string | null): (DBChat & { id: string }) | null;
  startChat(userId: string): void;
}

const service: Service = {
  info: {
    name: "Chat Service",
    autostart: true,
  },
  async start(sdk) {
    const db = await sdk.jsonDB<DB>("/chat.json");

    db.object.name ??= deviceName;
    db.object.chats ??= {};
    db.object.contacts ??= {};

    const object: ChatServiceObject = {
      sendMessage(message) {
        if (message.fromId.includes(".")) return;
        db.object.contacts[message.fromId] = message.fromName;
        db.object.chats[message.fromId] ??= { startedAt: Date.now(), messages: [] };
        db.object.chats[message.fromId]?.messages.push({
          ts: Date.now(),
          parts: message.parts,
          me: false,
        });
      },
    };

    const controller: Controller = {
      setName(name) {
        db.object.name = name;
      },
      async sendMessage(targetId, parts) {
        const m: SendMessageObject = {
          fromId: sdk.conn.name,
          fromName: db.object.name,
          parts,
        };
        db.object.chats[targetId]?.messages.push({ me: true, parts, ts: Date.now() });
        await sdk.conn.call<void>(`${targetId}::chat::sendMessage`, [m], true);
      },
      useChats() {
        return Object.entries(db.use("chats") as DB["chats"]).map(([id, c]: [string, DBChat]) => ({
          startedAt: c.startedAt,
          messages: c.messages.length,
          id,
          name: db.object.contacts[id] ?? id,
        }));
      },
      useChat(userId) {
        const value = db.use(`chats.${userId}`) as DBChat;
        return !userId || !value ? null : { ...value, id: userId };
      },
      startChat(userId) {
        db.object.chats[userId] ??= { startedAt: Date.now(), messages: [] };
      },
    };

    sdk.conn.exposeObject(object, "chat", true, (path, args: SendMessageObject[], from) => {
      if (path.path !== "sendMessage" || args.length !== 1 || args[0].fromId !== from) return false;
      return true;
    });

    return {
      exposed: controller,
      stop() {
        sdk.conn.unexposeObject("chat");
      },
    };
  },
};

export default service;
