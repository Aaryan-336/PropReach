"""
PropReach — WhatsApp Broadcast & CRM API
Main FastAPI application entry point.
"""

from __future__ import annotations

import logging
import os
from contextlib import asynccontextmanager

from dotenv import load_dotenv
from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware

# Load .env for local development
load_dotenv()

from routes import campaigns, contacts, messages, settings, webhook
from services.scheduler import start_scheduler, shutdown_scheduler

# Configure logging
logging.basicConfig(
    level=logging.INFO,
    format="%(asctime)s [%(levelname)s] %(name)s: %(message)s",
)
logger = logging.getLogger(__name__)


@asynccontextmanager
async def lifespan(app: FastAPI):
    """Manage startup/shutdown: start APScheduler, then clean up."""
    logger.info("Starting PropReach API server...")
    start_scheduler()
    yield
    logger.info("Shutting down PropReach API server...")
    shutdown_scheduler()


app = FastAPI(
    title="PropReach API",
    description="WhatsApp Broadcast & CRM for Real Estate",
    version="1.0.0",
    lifespan=lifespan,
)

# CORS — allow the frontend (Vercel) and local dev
frontend_url = os.getenv("FRONTEND_URL", "*")
app.add_middleware(
    CORSMiddleware,
    allow_origins=[frontend_url] if frontend_url != "*" else ["*"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

# Register route modules
app.include_router(webhook.router)
app.include_router(campaigns.router)
app.include_router(contacts.router)
app.include_router(messages.router)
app.include_router(settings.router)


@app.get("/", tags=["Health"])
async def health_check():
    """Health check endpoint for Railway."""
    return {
        "status": "healthy",
        "service": "PropReach API",
        "version": "1.0.0",
    }
