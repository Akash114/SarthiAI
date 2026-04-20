import bcrypt


def hash_password(raw: str) -> str:
    digest = raw.encode("utf-8")[:72]
    return bcrypt.hashpw(digest, bcrypt.gensalt()).decode("ascii")


def verify_password(raw: str, hashed: str) -> bool:
    digest = raw.encode("utf-8")[:72]
    try:
        return bcrypt.checkpw(digest, hashed.encode("ascii"))
    except ValueError:
        return False
