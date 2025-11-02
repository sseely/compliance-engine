"""
Fleet Tracking API
Placeholder for fleet compliance tracking using stored procedures
"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class FleetResponse(BaseModel):
    message: str = "Fleet API coming soon"


@router.get("/", response_model=FleetResponse)
async def get_fleet():
    """Placeholder for fleet tracking"""
    return FleetResponse()