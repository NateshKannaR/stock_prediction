import datetime as dt
import hashlib
import random


def seeded_random(*parts):
    seed_source = "|".join([str(part) for part in parts if part is not None])
    seed = int(hashlib.sha256(seed_source.encode("utf-8")).hexdigest()[:8], 16)
    return random.Random(seed)


def iso_now():
    return dt.datetime.utcnow().isoformat()
