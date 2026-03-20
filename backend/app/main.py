from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

from app.api.routes import router
from app.core.config import get_settings
from app.services.auto_trader import start_auto_trader
from app.websocket.socket_server import create_redis_listener_task, socket_app

settings = get_settings()
app = FastAPI(title=settings.app_name)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.cors_origins,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(router)
app.mount("/socket.io", socket_app)


@app.get("/health")
def health() -> dict:
    return {"status": "ok", "service": settings.app_name}


@app.on_event("startup")
async def startup_event() -> None:
    create_redis_listener_task()
    start_auto_trader(interval_seconds=60)
