from __future__ import annotations

import json
import logging

from redis import Redis

from app.core.config import get_settings

logger = logging.getLogger(__name__)


class AlertService:
    def __init__(self) -> None:
        settings = get_settings()
        self.redis = Redis.from_url(settings.redis_url) if settings.redis_url else None
        self.channel = settings.socket_io_redis_channel

    def publish(self, event: str, payload: dict) -> None:
        if self.redis is None:
            return
        try:
            self.redis.publish(self.channel, json.dumps({"event": event, "payload": payload}))
        except Exception:
            logger.warning("Redis publish failed for event %s", event)
