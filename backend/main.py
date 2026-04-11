from __future__ import annotations

import os as _os

from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from routers.evaluate import router as evaluate_router
from routers.coach import router as coach_router
from routers.ws_evaluate import router as ws_router
from routers.ws_scale import router as ws_scale_router
from routers.onboarding import router as onboarding_router

app = FastAPI(title="VocalMind AI Backend", version="0.1.0")

_allowed_origins = [
    "http://localhost:3000",
    *([_os.environ["FRONTEND_URL"]] if _os.environ.get("FRONTEND_URL") else []),
]

app.add_middleware(
    CORSMiddleware,
    allow_origins=_allowed_origins,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(evaluate_router)
app.include_router(coach_router)
app.include_router(ws_router)
app.include_router(ws_scale_router)
app.include_router(onboarding_router)


@app.get("/health")
def health() -> dict[str, str]:
    return {"status": "ok"}
