from functools import lru_cache

import redis
from rq import Queue

from app.config import get_settings


@lru_cache
def redis_connection() -> redis.Redis:
    s = get_settings()
    return redis.from_url(s.redis_url, socket_timeout=s.redis_socket_timeout_seconds)


def task_queue() -> Queue:
    return Queue("sarthi", connection=redis_connection())
