import { getServerAddr, proxyRequired } from "./server.ts";

function shouldProxy(target: string) {
  if (target.includes("192.168.") || target.includes("localhost") || target.includes("127.0.0.")) return false;
  return true;
}

const serverUriRegex = /^http(s?):\/\/server\/(.*)$/g;

async function proxyFetch(input: string, init: RequestInit = {}): Promise<Response> {
  console.log(`Proxying ${input}`);
  const serverAddr = await getServerAddr();
  if (!serverAddr) throw "Failed to fetch via proxy: couldn't reach server";
  const targetUrl = input.toString();
  const method = (init.method ?? "GET").toUpperCase();

  const upstreamHeaders: Record<string, string> = {};
  new Headers(init.headers).forEach((value, key) => {
    upstreamHeaders[key] = value;
  });

  const hopHeaders: Record<string, string> = {
    "X-Proxy-Url": targetUrl,
    "X-Proxy-Method": method,
  };
  if (Object.keys(upstreamHeaders).length > 0) {
    hopHeaders["X-Proxy-Headers"] = JSON.stringify(upstreamHeaders);
  }

  return fetch(serverAddr + "/proxy", {
    method: "POST",
    headers: hopHeaders,
    body: init.body as BodyInit | undefined,
  });
}

const afetch: typeof fetch = async function afetch(input: RequestInfo | URL, init?: RequestInit) {
  const server = await getServerAddr();
  const uri = String(input);
  const serverMatch = [...uri.matchAll(serverUriRegex)];
  if (server && serverMatch[0]) {
    const target = serverMatch[0][2];
    return await fetch(server + "/" + target, init);
  }
  if (!shouldProxy(uri) || (!server && !proxyRequired())) {
    return await fetch(input, init);
  }
  if (!server) throw "Proxying is required, but no proxy was set.";
  return await proxyFetch(input.toString(), init);
};

export { afetch as fetch };
