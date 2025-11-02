"""
Internationalization API endpoints
Provides language selection and localization information
"""

from typing import Dict, List
from fastapi import APIRouter, Request
from pydantic import BaseModel
from fastapi_babel import _

from core.i18n import get_supported_languages, locale_selector, is_supported_language

router = APIRouter()


class SupportedLanguagesResponse(BaseModel):
    """Response model for supported languages"""
    languages: Dict[str, str]
    current_locale: str
    default_locale: str


class SetLocaleRequest(BaseModel):
    """Request model for setting locale"""
    locale: str


class LocaleResponse(BaseModel):
    """Response model for locale operations"""
    locale: str
    success: bool
    message: str


@router.get("/languages", response_model=SupportedLanguagesResponse, tags=["Internationalization"])
async def get_supported_languages_endpoint(request: Request):
    """
    Get list of supported languages
    Returns available languages with their display names
    """
    current_locale = locale_selector(request)
    
    return SupportedLanguagesResponse(
        languages=get_supported_languages(),
        current_locale=current_locale,
        default_locale="en"
    )


@router.get("/locale", tags=["Internationalization"])
async def get_current_locale(request: Request):
    """
    Get current locale information
    Returns the currently active locale for the request
    """
    current_locale = locale_selector(request)
    
    return {
        "locale": current_locale,
        "message": _("Current locale is set to") + f" {current_locale}",
        "supported_languages": get_supported_languages()
    }


@router.post("/locale/validate", response_model=LocaleResponse, tags=["Internationalization"])
async def validate_locale(request: SetLocaleRequest):
    """
    Validate if a locale is supported
    Checks if the provided locale code is available
    """
    locale = request.locale.lower()
    
    if is_supported_language(locale):
        return LocaleResponse(
            locale=locale,
            success=True,
            message=_("Locale is supported")
        )
    else:
        return LocaleResponse(
            locale=locale,
            success=False,
            message=_("Locale is not supported")
        )


@router.get("/health/localized", tags=["Health", "Internationalization"])
async def localized_health_check():
    """
    Health check endpoint with localized responses
    Demonstrates internationalization in action
    """
    return {
        "status": _("healthy"),
        "message": _("System is operating normally"),
        "service": _("Compliance Engine API"),
        "timestamp": "2024-11-01T20:00:00Z"
    }