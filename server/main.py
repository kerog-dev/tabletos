import os
import socket
import hashlib
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


async def health(request: Request):
    return PlainTextResponse("hello! tabletos server")


async def available_packages(request: Request):
    apps = [f.replace(".zip", "") for f in os.listdir(PACKAGES_DIR)]
    return JSONResponse(apps)


async def package_hash(request: Request):
    name = request.path_params["name"]
    h = compute_hash(name)
    return PlainTextResponse(h)


app = Starlette(
    routes=[
        Route("/health", health),
        Route("/available-packages", available_packages),
        Mount("/packages", StaticFiles(directory=PACKAGES_DIR)),
        Route("/package-hashes/{name}", package_hash),
    ],
    middleware=[
        Middleware(CORSMiddleware, allow_origins=["*"]),
    ],
)

if __name__ == "__main__":
    print(f"Listening on http://{get_local_ip()}:{PORT}")
    uvicorn.run(app, host="0.0.0.0", port=PORT)
