from functools import lru_cache

import redis
from rq import Queue

from app.config import get_settings


@lru_cache
def redis_connection() -> redis.Redis:
    return redis.from_url(get_settings().redis_url)


def task_queue() -> Queue:
    return Queue("sarthi", connection=redis_connection())
