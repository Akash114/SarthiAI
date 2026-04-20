"""RQ worker entrypoint: `python -m app.worker` from backend directory."""

from rq import Worker

from app.queue import redis_connection, task_queue


def main() -> None:
    w = Worker([task_queue()], connection=redis_connection())
    w.work()


if __name__ == "__main__":
    main()
