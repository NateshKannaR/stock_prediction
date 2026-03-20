from __future__ import annotations

import asyncio
import json
import logging

import socketio
from redis.asyncio import Redis

from app.core.config import get_settings

settings = get_settings()
sio = socketio.AsyncServer(async_mode="asgi", cors_allowed_origins=settings.cors_origins)
socket_app = socketio.ASGIApp(sio)
logger = logging.getLogger(__name__)


@sio.event
async def connect(sid, environ, auth):  # type: ignore[no-untyped-def]
    await sio.emit("system.status", {"connected": True}, to=sid)


async def redis_fanout() -> None:
    if not settings.redis_url:
        return
    redis = Redis.from_url(settings.redis_url)
    try:
        pubsub = redis.pubsub()
        await pubsub.subscribe(settings.socket_io_redis_channel)
        async for message in pubsub.listen():
            if message["type"] != "message":
                continue
            data = json.loads(message["data"])
            await sio.emit(data["event"], data["payload"])
    except Exception:
        logger.warning("Redis fanout listener unavailable; websocket relay disabled")


def create_redis_listener_task() -> asyncio.Task:
    loop = asyncio.get_event_loop()
    return loop.create_task(redis_fanout())
