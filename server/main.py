from starlette.websockets import WebSocket
from urllib.parse import urljoin
import os
import socket
import hashlib
import json
from contextlib import asynccontextmanager
from pathlib import Path
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse, StreamingResponse
from starlette.routing import Mount, Route, WebSocketRoute
from starlette.staticfiles import StaticFiles
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
import uvicorn
import httpx

HOP_BY_HOP_HEADERS = {
    "connection",
    "keep-alive",
    "proxy-authenticate",
    "proxy-authorization",
    "te",
    "trailer",
    "transfer-encoding",
    "upgrade",
    "access-control-allow-origin",
}

PACKAGES_DIR = Path(__file__).resolve().parents[1] / "dist" / "packages"
PORT = 8086


def compute_hash(package: str) -> str:
    sha256 = hashlib.sha256()
    with open(PACKAGES_DIR / package, "rb") as f:
        while chunk := f.read(65536):
            sha256.update(chunk)
    return sha256.hexdigest()


def get_local_ip() -> str:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect(("8.8.8.8", 80))  # doesn't actually send anything
        return s.getsockname()[0]


client: httpx.AsyncClient


@asynccontextmanager
async def lifespan(app: Starlette):
    global client
    client = httpx.AsyncClient(
        timeout=httpx.Timeout(connect=10.0, read=60.0, write=30.0, pool=10.0),
        limits=httpx.Limits(
            max_connections=200,
            max_keepalive_connections=50,
            keepalive_expiry=30.0,
        ),
        follow_redirects=True,
    )
    try:
        yield
    finally:
        await client.aclose()


async def health(request: Request):
    return PlainTextResponse("hello! tabletos server")


async def available_packages(request: Request):
    apps = [f.replace(".zip", "") for f in os.listdir(PACKAGES_DIR)]
    return JSONResponse(apps)


async def package_hash(request: Request):
    name = request.path_params["name"]
    h = compute_hash(name)
    return PlainTextResponse(h)


async def proxy(request: Request):
    target_url = request.headers.get("X-Proxy-Url")
    if not target_url:
        return PlainTextResponse("Missing X-Proxy-Url header", status_code=400)

    method = request.headers.get("X-Proxy-Method", "GET").upper()

    headers = {}
    if raw := request.headers.get("X-Proxy-Headers"):
        try:
            headers = json.loads(raw)
        except json.JSONDecodeError:
            return PlainTextResponse("Invalid X-Proxy-Headers JSON", status_code=400)

    body = await request.body()

    try:
        upstream = await client.send(
            client.build_request(method, target_url, headers=headers, content=body),
            stream=True,
        )
    except httpx.HTTPError as exc:
        return PlainTextResponse(f"Upstream request failed: {exc}", status_code=502)

    response_headers = []
    for k, v in upstream.headers.raw:
        key = k.decode("latin-1")
        if key.lower() in HOP_BY_HOP_HEADERS:
            continue
        if key.lower() == "location":
            v = urljoin(target_url, v.decode("latin-1")).encode("latin-1")
        response_headers.append((k, v))

    async def body_iter():
        try:
            async for chunk in upstream.aiter_raw():
                yield chunk
        finally:
            await upstream.aclose()

    response = StreamingResponse(body_iter(), status_code=upstream.status_code)
    response.raw_headers = response_headers
    return response


ws_clients: dict[str, WebSocket] = {}


async def websocket_handler(ws: WebSocket):
    name: str | None = None
    await ws.accept()
    try:
        async for message in ws.iter_json():
            if not name:
                if message["type"] == "set_name":
                    if message["name"] == "*all*":
                        continue
                    name = message["name"]
                    ws_clients[name] = ws
                continue
            if message["type"] != "message":
                continue
            if isinstance(message["to"], list):
                targets = message["to"]
            elif message["to"] == "*all*":
                targets = list(ws_clients.keys())
            else:
                targets = [message["to"]]

            for target_name in targets:
                target = ws_clients.get(target_name)
                if target is not None:
                    await target.send_json(
                        {
                            "type": "message",
                            "from": name,
                            "subtype": message["subtype"],
                            "data": message["data"],
                        }
                    )
    finally:
        if name is not None and ws_clients.get(name) is ws:
            del ws_clients[name]


app = Starlette(
    routes=[
        Route("/health", health),
        Route("/available-packages", available_packages),
        Mount("/packages", StaticFiles(directory=PACKAGES_DIR)),
        Route("/package-hashes/{name}", package_hash),
        Route("/proxy", proxy, methods=["POST"]),
        WebSocketRoute("/ws", websocket_handler),
    ],
    middleware=[
        Middleware(
            CORSMiddleware,
            allow_origins=["*"],
            allow_methods=["*"],
            allow_headers=["*"],
        ),
    ],
    lifespan=lifespan,
)

if __name__ == "__main__":
    print(f"Listening on http://{get_local_ip()}:{PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
