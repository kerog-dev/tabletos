import os
import socket
from pathlib import Path
from starlette.applications import Starlette
from starlette.requests import Request
from starlette.responses import JSONResponse, PlainTextResponse
from starlette.routing import Mount, Route
from starlette.staticfiles import StaticFiles
from starlette.middleware import Middleware
from starlette.middleware.cors import CORSMiddleware
import uvicorn

PACKAGES_DIR = Path(__file__).resolve().parents[1] / "dist" / "packages"
PORT = 8086


def get_local_ip() -> str:
    with socket.socket(socket.AF_INET, socket.SOCK_DGRAM) as s:
        s.connect(("8.8.8.8", 80))  # doesn't actually send anything
        return s.getsockname()[0]


async def health(request: Request):
    return PlainTextResponse("hello! tabletos server")


async def available_packages(request: Request):
    apps = [f.replace(".zip", "") for f in os.listdir(PACKAGES_DIR)]
    return JSONResponse(apps)


app = Starlette(
    routes=[
        Route("/health", health),
        Route("/available-packages", available_packages),
        Mount("/packages", StaticFiles(directory=PACKAGES_DIR)),
    ],
    middleware=[
        Middleware(CORSMiddleware, allow_origins=["*"]),
    ],
)

if __name__ == "__main__":
    print(f"Listening on http://{get_local_ip()}:{PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
