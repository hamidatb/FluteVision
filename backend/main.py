from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from contextlib import asynccontextmanager

from core.config import settings
from api import router
from services import vision_service
import uvicorn


@asynccontextmanager
async def lifespan(app: FastAPI):
    """
    Application lifespan manager.
    Handles startup and shutdown events.
    """
    print("\n" + "="*60)
    print(f"Starting {settings.API_TITLE}")
    print("="*60)
    
    if not vision_service.initialize():
        print("Vision service failed to initialize")
    
    yield
    
    print("\n" + "="*60)
    print("Shutting down...")
    print("="*60)
    vision_service.cleanup()


app = FastAPI(
    title=settings.API_TITLE,
    version=settings.API_VERSION,
    lifespan=lifespan
)

app.add_middleware(
    CORSMiddleware,
    allow_origins=settings.ALLOWED_ORIGINS,
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Include API routes
app.include_router(router, prefix="/api/v1")

@app.get("/")
def root():
    return {
        "message": f"Welcome to {settings.API_TITLE}",
        "docs": "/docs",
        "health": "/api/v1/health"
    }

if __name__ == "__main__":
    uvicorn.run(
        "main:app",
        host=settings.API_HOST,
        port=settings.API_PORT,
        reload=True,  # hot-reload
        log_level="info"
    )