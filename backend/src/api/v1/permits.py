"""
Permit Management API
Placeholder for permit workflow management using stored procedures
"""

from fastapi import APIRouter
from pydantic import BaseModel

router = APIRouter()


class PermitResponse(BaseModel):
    message: str = "Permit API coming soon"


@router.get("/", response_model=PermitResponse)
async def get_permits():
    """Placeholder for permit management"""
    return PermitResponse()