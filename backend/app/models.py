import os
from sqlalchemy import Column, Integer, String, BigInteger, Sequence
from app.database import Base, engine

BUCKET_SIZE = int(os.getenv("BUCKET_SIZE", "1000"))


class UrlMapping(Base):
    __tablename__ = "url_mappings"

    id = Column(BigInteger, primary_key=True, autoincrement=True)
    short_code = Column(String(20), unique=True, index=True, nullable=False)
    long_url = Column(String(2048), nullable=False)
    bucket_id = Column(Integer, nullable=False, index=True)
    counter = Column(BigInteger, nullable=False)


class BucketCounter(Base):
    __tablename__ = "bucket_counters"

    bucket_id = Column(Integer, primary_key=True)
    next_counter = Column(BigInteger, nullable=False, default=1)


def init_db():
    Base.metadata.create_all(bind=engine)
