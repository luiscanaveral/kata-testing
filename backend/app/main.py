import os
from fastapi import FastAPI, Depends, HTTPException
from fastapi.middleware.cors import CORSMiddleware
from sqlalchemy.orm import Session
from dotenv import load_dotenv

from app.database import get_db
from app.models import init_db
from app.schemas import ShortenRequest, ShortenResponse
from app.shortener import create_short_url, resolve_short_code

load_dotenv(os.path.join(os.path.dirname(os.path.dirname(os.path.dirname(__file__))), '.env'))

app = FastAPI(title="URL Shortener", version="1.0.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)


@app.on_event("startup")
def on_startup():
    init_db()


@app.get("/health")
def health():
    return {"status": "ok"}


@app.post("/shorten", response_model=ShortenResponse)
def shorten(request: ShortenRequest, db: Session = Depends(get_db)):
    return create_short_url(db, str(request.long_url))


@app.get("/{short_code}")
def redirect(short_code: str, db: Session = Depends(get_db)):
    long_url = resolve_short_code(db, short_code)
    if long_url is None:
        raise HTTPException(status_code=404, detail="Short URL not found")
    return {"long_url": long_url}
