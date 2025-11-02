"""
Internationalization (i18n) core module for Compliance Engine
Provides translation services and locale management
"""

from typing import Optional
import structlog
from fastapi import Request
from fastapi_babel import Babel, BabelConfigs, BabelMiddleware
from pathlib import Path

from core.config import settings

logger = structlog.get_logger(__name__)

# Supported languages
SUPPORTED_LANGUAGES = {
    "en": "English",
    "es": "Español"
}

DEFAULT_LANGUAGE = "en"

# Babel configuration
babel_configs = BabelConfigs(
    ROOT_DIR=str(Path(__file__).parent.parent.parent),  # Points to backend/
    BABEL_DEFAULT_LOCALE=DEFAULT_LANGUAGE,
    BABEL_TRANSLATION_DIRECTORY="locales",
    BABEL_CONFIG_FILE="babel.cfg",
)

# Global babel instance
babel = Babel(configs=babel_configs)


def locale_selector(request: Request) -> str:
    """
    Determine the locale from request context
    Priority: URL parameter > Accept-Language header > default
    """
    # Check for explicit locale parameter
    locale = request.query_params.get("locale")
    if locale and locale in SUPPORTED_LANGUAGES:
        logger.debug("locale_from_parameter", locale=locale)
        return locale
    
    # Check Accept-Language header
    accept_language = request.headers.get("accept-language", "")
    if accept_language:
        # Parse Accept-Language header (simplified)
        for lang in accept_language.split(","):
            lang_code = lang.split(";")[0].strip().lower()
            # Handle language variants (e.g., en-US -> en, es-MX -> es)
            primary_lang = lang_code.split("-")[0]
            if primary_lang in SUPPORTED_LANGUAGES:
                logger.debug("locale_from_accept_language", 
                           original=lang_code, selected=primary_lang)
                return primary_lang
    
    logger.debug("locale_default", locale=DEFAULT_LANGUAGE)
    return DEFAULT_LANGUAGE


def get_babel_middleware():
    """Get configured Babel middleware instance"""
    return BabelMiddleware(
        babel_configs=babel_configs,
        locale_selector=locale_selector
    )


def get_supported_languages() -> dict:
    """Get dictionary of supported language codes and names"""
    return SUPPORTED_LANGUAGES.copy()


def is_supported_language(lang_code: str) -> bool:
    """Check if language code is supported"""
    return lang_code in SUPPORTED_LANGUAGES