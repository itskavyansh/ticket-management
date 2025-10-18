"""Rate limiting middleware for AI service endpoints."""
import time
import logging
from typing import Callable
from fastapi import Request, HTTPException, status
from fastapi.responses import JSONResponse
from cache.redis_cache import redis_cache
from config import settings

logger = logging.getLogger(__name__)


class RateLimiter:
    """Rate limiter using Redis for distributed rate limiting."""
    
    def __init__(
        self,
        requests_per_window: int = settings.rate_limit_requests,
        window_seconds: int = settings.rate_limit_window
    ):
        """
        Initialize rate limiter.
        
        Args:
            requests_per_window: Maximum requests allowed per window
            window_seconds: Time window in seconds
        """
        self.requests_per_window = requests_per_window
        self.window_seconds = window_seconds
    
    async def is_allowed(self, identifier: str) -> tuple[bool, dict]:
        """
        Check if request is allowed based on rate limits.
        
        Args:
            identifier: Unique identifier for rate limiting (e.g., IP, user ID)
            
        Returns:
            Tuple of (is_allowed, rate_limit_info)
        """
        current_time = int(time.time())
        window_start = current_time - (current_time % self.window_seconds)
        key = f"rate_limit:{identifier}:{window_start}"
        
        try:
            # Get current count for this window
            current_count = await redis_cache.increment(key, 1, self.window_seconds)
            
            if current_count is None:
                # Redis unavailable, allow request but log warning
                logger.warning("Redis unavailable for rate limiting, allowing request")
                return True, {
                    "requests_remaining": self.requests_per_window - 1,
                    "reset_time": window_start + self.window_seconds,
                    "limit": self.requests_per_window
                }
            
            is_allowed = current_count <= self.requests_per_window
            
            rate_limit_info = {
                "requests_remaining": max(0, self.requests_per_window - current_count),
                "reset_time": window_start + self.window_seconds,
                "limit": self.requests_per_window,
                "current_count": current_count
            }
            
            return is_allowed, rate_limit_info
            
        except Exception as e:
            logger.error(f"Rate limiting error for {identifier}: {str(e)}")
            # On error, allow request but log the issue
            return True, {
                "requests_remaining": self.requests_per_window - 1,
                "reset_time": window_start + self.window_seconds,
                "limit": self.requests_per_window
            }
    
    def get_identifier(self, request: Request) -> str:
        """
        Get unique identifier for rate limiting.
        
        Args:
            request: FastAPI request object
            
        Returns:
            Unique identifier string
        """
        # Try to get user ID from auth header, fallback to IP
        auth_header = request.headers.get("authorization")
        if auth_header:
            # Extract user ID from JWT token if available
            # For now, use the auth header as identifier
            return f"user:{auth_header[:20]}"  # Truncate for privacy
        
        # Fallback to client IP
        client_ip = request.client.host if request.client else "unknown"
        forwarded_for = request.headers.get("x-forwarded-for")
        if forwarded_for:
            client_ip = forwarded_for.split(",")[0].strip()
        
        return f"ip:{client_ip}"


async def rate_limit_middleware(request: Request, call_next: Callable):
    """
    Rate limiting middleware for FastAPI.
    
    Args:
        request: FastAPI request object
        call_next: Next middleware/endpoint in chain
        
    Returns:
        Response or rate limit error
    """
    # Skip rate limiting for health checks and root endpoint
    if request.url.path in ["/", "/health", "/docs", "/redoc", "/openapi.json"]:
        return await call_next(request)
    
    rate_limiter = RateLimiter()
    identifier = rate_limiter.get_identifier(request)
    
    is_allowed, rate_info = await rate_limiter.is_allowed(identifier)
    
    if not is_allowed:
        logger.warning(f"Rate limit exceeded for {identifier}")
        return JSONResponse(
            status_code=status.HTTP_429_TOO_MANY_REQUESTS,
            content={
                "error": "Rate limit exceeded",
                "message": f"Too many requests. Limit: {rate_info['limit']} per {settings.rate_limit_window} seconds",
                "retry_after": rate_info["reset_time"] - int(time.time())
            },
            headers={
                "X-RateLimit-Limit": str(rate_info["limit"]),
                "X-RateLimit-Remaining": str(rate_info["requests_remaining"]),
                "X-RateLimit-Reset": str(rate_info["reset_time"]),
                "Retry-After": str(rate_info["reset_time"] - int(time.time()))
            }
        )
    
    # Add rate limit headers to successful responses
    response = await call_next(request)
    response.headers["X-RateLimit-Limit"] = str(rate_info["limit"])
    response.headers["X-RateLimit-Remaining"] = str(rate_info["requests_remaining"])
    response.headers["X-RateLimit-Reset"] = str(rate_info["reset_time"])
    
    return response