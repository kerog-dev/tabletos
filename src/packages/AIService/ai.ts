import { useEffect, useState } from "react";
import { sdk } from "../../getsdk.ts";

interface DB {
  apiKey: string | null;
  chats: Record<string, PersistedChat>;
}

const { jsonDB, afetch: fetch } = sdk();

const db = await jsonDB<DB>("/ai.json");

db.object.apiKey ??= null;
db.object.chats ??= {};

export function setGeminiApiKey(key: string | null) {
  db.object.apiKey = key;
}

const BASE_URL = "https://generativelanguage.googleapis.com/v1beta";
const UPLOAD_BASE_URL = "https://generativelanguage.googleapis.com/upload/v1beta";

export type Role = "user" | "model";

export interface TextPart {
  text: string;
}

export interface InlineDataPart {
  inlineData: { mimeType: string; data: string }; // data = raw base64, no "data:" prefix
}

export interface FileDataPart {
  fileData: { mimeType: string; fileUri: string };
}

export type Part = TextPart | InlineDataPart | FileDataPart;

export interface Content {
  role: Role;
  parts: Part[];
}

export interface GenerateOptions {
  model: string;
  systemInstruction?: string;
  temperature?: number;
  maxOutputTokens?: number;
  /**
   * Name of a cache created via createCachedContent (e.g. "cachedContents/abc123").
   * When set, `contents` should be just the new turn(s) — the cached prefix is
   * applied server-side and must not be duplicated in `contents`.
   */
  cachedContent?: string;
}

export interface GenerateResult {
  text: string;
  parts: Part[];
  finishReason?: string;
  raw: unknown;
}

export interface StreamChunk {
  text: string; // incremental text for this chunk
  raw: unknown;
}

function requireApiKey(): string {
  if (!db.object.apiKey) throw new Error("No API key set for Gemini API.");
  return db.object.apiKey;
}

function buildRequest(contents: Content[], opts: GenerateOptions): RequestInit {
  return {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": requireApiKey(),
    },
    body: JSON.stringify({
      contents,
      ...(opts.cachedContent ? { cachedContent: opts.cachedContent } : {}),
      ...(opts.systemInstruction
        ? { systemInstruction: { parts: [{ text: opts.systemInstruction }] } }
        : {}),
      generationConfig: {
        ...(opts.temperature !== undefined ? { temperature: opts.temperature } : {}),
        ...(opts.maxOutputTokens !== undefined ? { maxOutputTokens: opts.maxOutputTokens } : {}),
      },
    }),
  };
}

// Single place that turns a raw API response into the shapes callers want.
// Both generateContent and startChat's send() go through this now — neither
// re-derives parts/text from raw JSON independently.
function parseResponse(json: any): { text: string; parts: Part[]; finishReason?: string } {
  const parts: Part[] = json?.candidates?.[0]?.content?.parts ?? [];
  const text = parts.map((p: any) => p.text ?? "").join("");
  return { text, parts, finishReason: json?.candidates?.[0]?.finishReason };
}

/** One-shot, non-streaming generation. */
export async function generateContent(
  contents: Content[],
  opts: GenerateOptions,
): Promise<GenerateResult> {
  const res = await fetch(
    `${BASE_URL}/models/${opts.model}:generateContent`,
    buildRequest(contents, opts),
  );
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini API error (${res.status}): ${JSON.stringify(json)}`);

  const { text, parts, finishReason } = parseResponse(json);
  return { text, parts, finishReason, raw: json };
}

/** Streaming generation. Yields incremental text chunks as they arrive. */
export async function* streamGenerateContent(
  contents: Content[],
  opts: GenerateOptions,
): AsyncGenerator<StreamChunk> {
  const res = await fetch(
    `${BASE_URL}/models/${opts.model}:streamGenerateContent?alt=sse`,
    buildRequest(contents, opts),
  );
  if (!res.ok || !res.body) {
    const errJson = await res.json().catch(() => null);
    throw new Error(`Gemini API error (${res.status}): ${JSON.stringify(errJson)}`);
  }

  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buffer = "";

  while (true) {
    const { done, value } = await reader.read();
    if (done) break;
    buffer += decoder.decode(value, { stream: true });

    // SSE frames are separated by blank lines; each frame has "data: {...}" lines.
    const frames = buffer.split("\n\n");
    buffer = frames.pop() ?? ""; // last piece may be incomplete, keep for next read

    for (const frame of frames) {
      const line = frame.split("\n").find((l) => l.startsWith("data:"));
      if (!line) continue;
      const jsonStr = line.slice(5).trim();
      if (!jsonStr || jsonStr === "[DONE]") continue;

      const json = JSON.parse(jsonStr);
      yield { text: parseResponse(json).text, raw: json };
    }
  }
}

// ---- Helpers for building Content from common input shapes ----

export function textPart(text: string): TextPart {
  return { text };
}

export async function blobPart(blob: Blob): Promise<InlineDataPart> {
  const buf = new Uint8Array(await blob.arrayBuffer());
  let binary = "";
  const BATCH = 0x8000;
  for (let i = 0; i < buf.length; i += BATCH) {
    binary += String.fromCharCode(...buf.subarray(i, i + BATCH));
  }
  return { inlineData: { mimeType: blob.type, data: btoa(binary) } };
}

export interface UploadedFile {
  name: string; // resource name, e.g. "files/abc123"
  uri: string; // pass this to fileDataPart()
  mimeType: string;
}

/**
 * Uploads a blob once via the Files API and returns a URI you can reference
 * from any number of future turns/requests via fileDataPart(), instead of
 * re-inlining the same base64 bytes every time. Uses the resumable upload
 * protocol: one request to start the upload and get an upload URL, then one
 * request to send the bytes and finalize.
 *
 * Uploaded files live server-side for a limited time (currently 48h per
 * Google's docs) and are billed as storage, not per-request — worth it once
 * a file is reused across turns, not for a single one-off request.
 */
export async function uploadFile(blob: Blob, displayName?: string): Promise<UploadedFile> {
  const numBytes = blob.size;
  const mimeType = blob.type || "application/octet-stream";

  const startRes = await fetch(`${UPLOAD_BASE_URL}/files`, {
    method: "POST",
    headers: {
      "x-goog-api-key": requireApiKey(),
      "X-Goog-Upload-Protocol": "resumable",
      "X-Goog-Upload-Command": "start",
      "X-Goog-Upload-Header-Content-Length": String(numBytes),
      "X-Goog-Upload-Header-Content-Type": mimeType,
      "Content-Type": "application/json",
    },
    body: JSON.stringify({ file: { display_name: displayName ?? "upload" } }),
  });
  if (!startRes.ok) {
    throw new Error(`Gemini file upload (start) failed (${startRes.status}): ${await startRes.text()}`);
  }
  const uploadUrl = startRes.headers.get("x-goog-upload-url");
  if (!uploadUrl) throw new Error("Gemini file upload did not return an upload URL");

  const uploadRes = await fetch(uploadUrl, {
    method: "POST",
    headers: {
      "Content-Length": String(numBytes),
      "X-Goog-Upload-Offset": "0",
      "X-Goog-Upload-Command": "upload, finalize",
    },
    body: blob,
  });
  const json = await uploadRes.json();
  if (!uploadRes.ok) {
    throw new Error(`Gemini file upload (finalize) failed (${uploadRes.status}): ${JSON.stringify(json)}`);
  }
  return { name: json.file.name, uri: json.file.uri, mimeType: json.file.mimeType ?? mimeType };
}

export function fileDataPart(file: UploadedFile): FileDataPart {
  return { fileData: { mimeType: file.mimeType, fileUri: file.uri } };
}

/**
 * Creates an explicit context cache: content the model will treat as a
 * prefix to every request that references this cache's name, without you
 * re-sending it. Only works above a per-model minimum token count (roughly
 * 2k–4k tokens) — small system instructions or a couple of chat turns won't
 * qualify and the API will reject the request. Meant for large, stable,
 * repeatedly-referenced content: a long document, a big knowledge base, a
 * substantial system prompt — not for pinning ordinary chat history.
 */
export async function createCachedContent(
  model: string,
  contents: Content[],
  opts: { systemInstruction?: string; ttlSeconds?: number } = {},
): Promise<string> {
  const res = await fetch(`${BASE_URL}/cachedContents`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": requireApiKey(),
    },
    body: JSON.stringify({
      model: `models/${model}`,
      contents,
      ...(opts.systemInstruction
        ? { systemInstruction: { parts: [{ text: opts.systemInstruction }] } }
        : {}),
      ...(opts.ttlSeconds !== undefined ? { ttl: `${opts.ttlSeconds}s` } : {}),
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini cache create failed (${res.status}): ${JSON.stringify(json)}`);
  return json.name;
}

export async function deleteCachedContent(name: string): Promise<void> {
  const res = await fetch(`${BASE_URL}/${name}`, {
    method: "DELETE",
    headers: { "x-goog-api-key": requireApiKey() },
  });
  if (!res.ok) {
    const json = await res.json().catch(() => null);
    throw new Error(`Gemini cache delete failed (${res.status}): ${JSON.stringify(json)}`);
  }
}

/** Counts tokens for a set of contents. Free — no charge for this call. */
export async function countTokens(
  model: string,
  contents: Content[],
  systemInstruction?: string,
): Promise<number> {
  const res = await fetch(`${BASE_URL}/models/${model}:countTokens`, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "x-goog-api-key": requireApiKey(),
    },
    body: JSON.stringify({
      contents,
      ...(systemInstruction ? { systemInstruction: { parts: [{ text: systemInstruction }] } } : {}),
    }),
  });
  const json = await res.json();
  if (!res.ok) throw new Error(`Gemini countTokens failed (${res.status}): ${JSON.stringify(json)}`);
  return json.totalTokens;
}

// ---- Chat interface ----
// Gemini's API is stateless per-call — a "chat" is just us keeping a growing
// `Content[]` history and re-sending it each turn. That's why `startChat` is
// synchronous: no network call happens until you actually `send()` something.

export type ChatMessageInput =
  | { type: "text"; content: string }
  | { type: "image"; blob: Blob }
  | { type: "document"; blob: Blob }
  | { type: "file"; file: UploadedFile }; // from uploadFile() — reused across turns without re-sending bytes

export interface ChatResponse {
  text: string;
  parts: Part[];
  finishReason?: string;
  raw: unknown;
}

export interface PersistedChat {
  id: string;
  model: string;
  systemInstruction?: string;
  history: Content[];
  cacheName: string | null;
  cachedPrefixLength: number;
  createdAt: number;
  updatedAt: number;
}

// Same-process pub-sub so useChats/useChat re-render on change without
// polling. If this module ever moves to a separate process from its
// consumers, this whole section is what needs replacing with an RPC-based
// subscription instead.
const chatsListListeners = new Set<() => void>();
const chatListeners = new Map<string, Set<() => void>>();

function notifyChatsListChanged() {
  for (const cb of chatsListListeners) cb();
}

function notifyChatChanged(id: string) {
  chatListeners.get(id)?.forEach((cb) => cb());
}

function subscribeChatsList(cb: () => void): () => void {
  chatsListListeners.add(cb);
  return () => chatsListListeners.delete(cb);
}

function subscribeChat(id: string, cb: () => void): () => void {
  let set = chatListeners.get(id);
  if (!set) {
    set = new Set();
    chatListeners.set(id, set);
  }
  set.add(cb);
  return () => set!.delete(cb);
}

function persistChat(id: string, patch: Partial<PersistedChat>) {
  db.object.chats[id] = { ...db.object.chats[id], ...patch, updatedAt: Date.now() } as PersistedChat;
  notifyChatChanged(id);
}

/** All chat ids this SDK currently knows about (persisted across restarts). */
export function listChats(): string[] {
  return Object.keys(db.object.chats);
}

/** Full persisted state for one chat, including complete part-level history. */
export function getChat(id: string): PersistedChat | undefined {
  return db.object.chats[id];
}

export interface ChatInterface {
  readonly id: string;
  /** Send one or more content items as the next user turn. Resolves with just that turn's response. */
  send(content: ChatMessageInput | ChatMessageInput[]): Promise<ChatResponse>;
  /** Full turn history so far, including the seeded `initial` content. Snapshot, not live. */
  getHistory(): Content[];
  /** React hook: live-updating history for this chat. Must be called unconditionally, same as any hook. */
  useHistory(): Content[];
}

async function toParts(input: ChatMessageInput[]): Promise<Part[]> {
  return Promise.all(input.map((item) => {
    switch (item.type) {
      case "text":
        return textPart(item.content);
      case "image":
      case "document":
        return blobPart(item.blob);
      case "file":
        return fileDataPart(item.file);
      default:
        item satisfies never;
        throw new Error(`Unhandled chat input type: ${(item as { type: string }).type}`);
    }
  }));
}

export interface ChatOptions {
  /**
   * Max number of (user, model) turn-pairs to keep. Only applies before
   * automatic caching kicks in for this chat — once caching is active,
   * trimming is skipped (caching is now handling cost/growth, and trimming
   * would invalidate the cached-prefix bookkeeping). Leave unset for no limit.
   */
  maxTurns?: number;
}

// Threshold is a guess, not a guarantee: Google doesn't publish a
// per-model minimum via API, and it varies by model (roughly 2k-4k tokens
// as of writing). This sits above the minimum for current common models,
// but if you're on a model with a higher minimum, cache creation will
// fail — that failure is caught and swallowed below, so the chat just
// keeps working uncached rather than throwing.
const CACHE_THRESHOLD_TOKENS = 4096;

/**
 * Builds a live ChatInterface from a persisted-shape record. Used by both
 * startChat (fresh record) and resumeChat (record loaded from db). Every
 * mutation (new turns, cache creation/refresh, trimming) is written through
 * to db.object.chats[id] before send() resolves, so getChat()/useChat() are
 * never behind what a caller of send() already sees.
 */
function buildChatInterface(record: PersistedChat, { maxTurns }: ChatOptions): ChatInterface {
  const { id, model, systemInstruction } = record;
  let history: Content[] = [...record.history];
  let cacheName: string | null = record.cacheName;
  let cachedPrefixLength = record.cachedPrefixLength;

  function trimHistory() {
    if (maxTurns === undefined || cacheName !== null) return;
    const maxEntries = maxTurns * 2; // each turn-pair = 1 user Content + 1 model Content
    if (history.length > maxEntries) {
      history = history.slice(history.length - maxEntries);
    }
  }

  async function maybeUpdateCache() {
    try {
      if (cacheName === null) {
        const total = await countTokens(model, history, systemInstruction);
        if (total < CACHE_THRESHOLD_TOKENS) return;
        cacheName = await createCachedContent(model, history, { systemInstruction });
        cachedPrefixLength = history.length;
      } else {
        const uncached = history.slice(cachedPrefixLength);
        if (uncached.length === 0) return;
        const uncachedTokens = await countTokens(model, uncached);
        if (uncachedTokens < CACHE_THRESHOLD_TOKENS) return;

        const oldCache = cacheName;
        const newCache = await createCachedContent(model, history, { systemInstruction });
        cacheName = newCache;
        cachedPrefixLength = history.length;
        deleteCachedContent(oldCache).catch(() => {}); // best-effort; may already have expired
      }
    } catch {
      // Caching failed (e.g. threshold guess was wrong for this model) —
      // fall through and keep sending full history uncached.
    }
  }

  return {
    id,
    async send(content) {
      const items = Array.isArray(content) ? content : [content];
      const parts = await toParts(items);
      history.push({ role: "user", parts });

      const contentsToSend = cacheName ? history.slice(cachedPrefixLength) : history;
      const res = await generateContent(contentsToSend, {
        model,
        systemInstruction: cacheName ? undefined : systemInstruction,
        cachedContent: cacheName ?? undefined,
      });

      history.push({ role: "model", parts: res.parts });
      trimHistory();
      await maybeUpdateCache();
      persistChat(id, { history, cacheName, cachedPrefixLength });

      return {
        text: res.text,
        parts: res.parts,
        finishReason: res.finishReason,
        raw: res.raw,
      };
    },
    getHistory() {
      return [...history];
    },
    useHistory() {
      const [h, setH] = useState<Content[]>(() => getChat(id)?.history ?? []);
      useEffect(() => {
        setH(getChat(id)?.history ?? []);
        return subscribeChat(id, () => setH(getChat(id)?.history ?? []));
      }, []);
      return h;
    },
  };
}

/**
 * Starts a new chat session and persists it under a fresh id. `initial`
 * seeds prior turns without triggering a request — nothing is sent until
 * the first `send()` call.
 */
export function startChat(
  model: string,
  initial: Content[] = [],
  systemInstruction?: string,
  options: ChatOptions = {},
): ChatInterface {
  const id = crypto.randomUUID();
  const now = Date.now();
  const record: PersistedChat = {
    id,
    model,
    systemInstruction,
    history: [...initial],
    cacheName: null,
    cachedPrefixLength: 0,
    createdAt: now,
    updatedAt: now,
  };
  db.object.chats[id] = record;
  notifyChatsListChanged();
  return buildChatInterface(record, options);
}

/** Reconstructs a live ChatInterface for a previously-persisted chat id. */
export function resumeChat(id: string, options: ChatOptions = {}): ChatInterface {
  const record = db.object.chats[id];
  if (!record) throw new Error(`No chat found with id "${id}"`);
  return buildChatInterface(record, options);
}

/**
 * Sends a turn to an existing chat by id without holding a ChatInterface
 * across calls — e.g. for a request handler where each call is a fresh
 * context. Equivalent to resumeChat(id).send(content); does not reuse any
 * in-memory state between calls, but that's fine since all mutation is
 * persisted through to db.object.chats before send() resolves anyway.
 */
export async function send(
  id: string,
  content: ChatMessageInput | ChatMessageInput[],
  options: ChatOptions = {},
): Promise<ChatResponse> {
  return resumeChat(id, options).send(content);
}

// ---- React hooks ----
// Same-process only (per your setup) — reads db.object.chats directly and
// re-renders via the pub-sub above. Move to RPC-based subscriptions if this
// module and its consumers ever end up in separate processes.

/** List of all persisted chat ids, live-updating as chats are created. */
export function useChats(): string[] {
  const [ids, setIds] = useState<string[]>(() => listChats());
  useEffect(() => {
    setIds(listChats()); // id may have changed between render and effect
    return subscribeChatsList(() => setIds(listChats()));
  }, []);
  return ids;
}

/** Full persisted state (including part-level history) for one chat, live-updating as it's sent to. */
export function useChat(id: string | null): PersistedChat | undefined {
  const [chat, setChat] = useState<PersistedChat | undefined>(() => id ? getChat(id) : undefined);
  useEffect(() => {
    if (!id) {
      setChat(undefined);
      return;
    }
    setChat(getChat(id));
    return subscribeChat(id, () => setChat(getChat(id)));
  }, [id]);
  return chat;
}
