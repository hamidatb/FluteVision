from slowapi import Limiter
from slowapi.util import get_remote_address
from slowapi.errors import RateLimitExceeded
from fastapi.responses import JSONResponse
import time

def custom_rate_limit_exceeded_handler(request, exc: RateLimitExceeded):
    return JSONResponse(
        status_code=429,
        content={
            "error": "Too many requests",
            "message": "Slow down! Sending requests too fast to the prediction model endpoint",
        },
    )

limiter = Limiter(
    key_func=get_remote_address,
    default_limits=["60/minute"],
    headers_enabled=True,
)

limiter._rate_limit_exceeded_handler = custom_rate_limit_exceeded_handler
