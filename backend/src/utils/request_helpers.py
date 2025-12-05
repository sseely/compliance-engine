"""
Request helper utilities for the Compliance Engine API.
Provides common request handling patterns to avoid code duplication.
"""

from typing import Optional
from fastapi import Request


def get_client_ip(request: Request) -> Optional[str]:
    """
    Extract client IP address from request.

    Handles the common pattern of safely accessing request.client.host
    with a fallback to None when client information is unavailable.

    Args:
        request: The FastAPI request object

    Returns:
        The client IP address or None if unavailable
    """
    return request.client.host if request.client else None


def get_request_id(request: Request) -> Optional[str]:
    """
    Extract the request ID from request state or headers.

    Args:
        request: The FastAPI request object

    Returns:
        The request ID or None if not set
    """
    # Check request state first (set by middleware)
    if hasattr(request.state, 'request_id'):
        return request.state.request_id

    # Fall back to header
    return request.headers.get('ce-request-id')


def get_user_agent(request: Request) -> Optional[str]:
    """
    Extract user agent from request headers.

    Args:
        request: The FastAPI request object

    Returns:
        The user agent string or None if not provided
    """
    return request.headers.get('user-agent')


def get_client_version(request: Request) -> Optional[str]:
    """
    Extract client version from request headers.

    Args:
        request: The FastAPI request object

    Returns:
        The client version or None if not provided
    """
    return request.headers.get('ce-client-version')
