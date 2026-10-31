"""The FHE inference server: the untrusted side. It runs the compiled models on ciphertexts it cannot read.

It never holds a private key, so it never sees a bill amount, a score or a forecast. Clients register their
public evaluation keys once, then send encrypted inputs and get encrypted outputs back.

    POST /keys/{model}               body: serialized evaluation keys   -> {"keyId": "..."}
    POST /run/{model}?key_id=...     body: one encrypted input          -> encrypted output (bytes)
"""

from __future__ import annotations

import uuid

from concrete.ml.deployment import FHEModelServer
from fastapi import FastAPI, HTTPException, Request, Response

from common import ANOMALY_DIR, FORECAST_DIR

app = FastAPI(title="Opaquely FHE inference server")

SERVERS = {"anomaly": FHEModelServer(str(ANOMALY_DIR)), "forecast": FHEModelServer(str(FORECAST_DIR))}
for server in SERVERS.values():
    server.load()

KEYS: dict[str, bytes] = {}


def model_server(model: str) -> FHEModelServer:
    if model not in SERVERS:
        raise HTTPException(404, f"unknown model {model}")
    return SERVERS[model]


@app.get("/health")
def health() -> dict:
    return {"ok": True, "models": sorted(SERVERS)}


@app.post("/keys/{model}")
async def register_keys(model: str, request: Request) -> dict:
    model_server(model)
    key_id = f"{model}-{uuid.uuid4().hex}"
    KEYS[key_id] = await request.body()
    return {"keyId": key_id}


@app.post("/run/{model}")
async def run(model: str, key_id: str, request: Request) -> Response:
    server = model_server(model)
    keys = KEYS.get(key_id)
    if keys is None or not key_id.startswith(f"{model}-"):
        raise HTTPException(404, "unknown key id; register evaluation keys first")
    encrypted = await request.body()
    result = server.run(encrypted, keys)
    return Response(content=result, media_type="application/octet-stream")
