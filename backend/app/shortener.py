import os
import hashlib
from sqlalchemy.orm import Session
from app.models import UrlMapping, BucketCounter

NUM_BUCKETS = int(os.getenv("BUCKET_SIZE", "1000"))
SHORT_CODE_LENGTH = int(os.getenv("SHORT_CODE_LENGTH", "7"))
BASE_URL = os.getenv("BASE_URL", "http://localhost:8000")

ALPHABET = "0123456789abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ"
BASE = len(ALPHABET)


def base62_encode(num: int) -> str:
    if num == 0:
        return ALPHABET[0]
    encoded = []
    while num > 0:
        encoded.append(ALPHABET[num % BASE])
        num //= BASE
    return "".join(reversed(encoded))


def base62_decode(encoded: str) -> int:
    num = 0
    for char in encoded:
        num = num * BASE + ALPHABET.index(char)
    return num


def get_bucket(long_url: str) -> int:
    hash_hex = hashlib.md5(long_url.encode()).hexdigest()
    return int(hash_hex[:8], 16) % NUM_BUCKETS


def get_next_counter(db: Session, bucket_id: int) -> int:
    from sqlalchemy import text
    db.execute(
        text(
            "INSERT IGNORE INTO bucket_counters (bucket_id, next_counter) VALUES (:id, 1)"
        ),
        {"id": bucket_id},
    )
    result = db.execute(
        text(
            "UPDATE bucket_counters SET next_counter = LAST_INSERT_ID(next_counter + 1) "
            "WHERE bucket_id = :id"
        ),
        {"id": bucket_id},
    )
    result = db.execute(text("SELECT LAST_INSERT_ID()"))
    return result.scalar()


def generate_short_code(db: Session, long_url: str) -> str:
    bucket_id = get_bucket(long_url)
    counter = get_next_counter(db, bucket_id)
    bucket_part = base62_encode(bucket_id).rjust(2, '0')
    counter_part = base62_encode(counter).rjust(SHORT_CODE_LENGTH - 2, '0')
    short_code = bucket_part + counter_part
    return short_code


def create_short_url(db: Session, long_url: str) -> dict:
    existing = db.query(UrlMapping).filter_by(long_url=long_url).first()
    if existing:
        return {
            "short_url": f"{BASE_URL}/{existing.short_code}",
            "short_code": existing.short_code,
            "long_url": existing.long_url,
        }

    short_code = generate_short_code(db, long_url)
    bucket_id = get_bucket(long_url)
    counter = base62_decode(short_code[2:])

    mapping = UrlMapping(
        short_code=short_code,
        long_url=long_url,
        bucket_id=bucket_id,
        counter=counter,
    )
    db.add(mapping)
    db.commit()
    db.refresh(mapping)

    return {
        "short_url": f"{BASE_URL}/{short_code}",
        "short_code": short_code,
        "long_url": long_url,
    }


def resolve_short_code(db: Session, short_code: str) -> str | None:
    mapping = db.query(UrlMapping).filter_by(short_code=short_code).first()
    return mapping.long_url if mapping else None
