from pydantic import BaseModel, HttpUrl


class ShortenRequest(BaseModel):
    long_url: HttpUrl


class ShortenResponse(BaseModel):
    short_url: str
    short_code: str
    long_url: str


class ErrorResponse(BaseModel):
    detail: str
