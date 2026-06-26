import { serializeRequest } from "../../shared/reqres.ts";
import { getServerAddr } from "./server.ts";
import storage from "./storage.ts";

function proxyRequired() {
  return storage.proxyRequired ?? false;
}

function shouldProxy(target: string) {
  if (target.includes("192.168.") || target.includes("localhost") || target.includes("127.0.0.")) return false;
  return true;
}

const serverUriRegex = /^http(s?):\/\/server\/(.*)$/g;

const afetch: typeof fetch = async function afetch(input: RequestInfo | URL, init?: RequestInit) {
  const server = await getServerAddr();
  const uri = String(input);
  const serverMatch = [...uri.matchAll(serverUriRegex)];
  if (server && serverMatch) {
    const target = serverMatch[0][2];
    return await fetch(server + "/" + target, init);
  }
  if (!shouldProxy(uri) || (!server && !proxyRequired())) {
    return await fetch(input, init);
  }
  if (!server) throw "Proxying is required, but no proxy was set.";
  return await fetch(server + "/proxy", {
    method: "POST",
    headers: { "Content-Type": "application/octet-stream" },
    body: await serializeRequest(new Request(input, init)),
  });
};

export { afetch as fetch };
