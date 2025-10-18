"""Mock cache implementation for demo purposes when Redis is not available."""
import json
import logging
import time
from typing import Any, Optional, Dict

logger = logging.getLogger(__name__)


class MockCache:
    """In-memory cache for demo purposes when Redis is not available."""
    
    def __init__(self):
        """Initialize mock cache."""
        self._cache: Dict[str, Dict[str, Any]] = {}
        self.ttl = 3600  # 1 hour default TTL
    
    async def connect(self):
        """Mock connection - always succeeds."""
        logger.info("Mock cache initialized (Redis not available)")
    
    async def disconnect(self):
        """Mock disconnection."""
        logger.info("Mock cache disconnected")
    
    async def get(self, key: str) -> Optional[Any]:
        """
        Get value from mock cache.
        
        Args:
            key: Cache key
            
        Returns:
            Cached value or None if not found or expired
        """
        try:
            if key in self._cache:
                entry = self._cache[key]
                if time.time() < entry['expires_at']:
                    return entry['value']
                else:
                    # Remove expired entry
                    del self._cache[key]
            return None
        except Exception as e:
            logger.error(f"Mock cache get error for key {key}: {str(e)}")
            return None
    
    async def set(self, key: str, value: Any, ttl: Optional[int] = None, expire: Optional[int] = None) -> bool:
        """
        Set value in mock cache.
        
        Args:
            key: Cache key
            value: Value to cache
            ttl: Time to live in seconds (optional)
            expire: Alternative name for ttl (for compatibility)
            
        Returns:
            True if successful, False otherwise
        """
        try:
            # Use expire parameter if provided, otherwise use ttl, otherwise use default
            expiry_time = expire or ttl or self.ttl
            self._cache[key] = {
                'value': value,
                'expires_at': time.time() + expiry_time
            }
            return True
        except Exception as e:
            logger.error(f"Mock cache set error for key {key}: {str(e)}")
            return False
    
    async def delete(self, key: str) -> bool:
        """
        Delete value from mock cache.
        
        Args:
            key: Cache key
            
        Returns:
            True if successful, False otherwise
        """
        try:
            if key in self._cache:
                del self._cache[key]
            return True
        except Exception as e:
            logger.error(f"Mock cache delete error for key {key}: {str(e)}")
            return False
    
    async def increment(self, key: str, amount: int = 1, ttl: Optional[int] = None) -> Optional[int]:
        """
        Increment a counter in mock cache.
        
        Args:
            key: Cache key
            amount: Amount to increment by
            ttl: Time to live in seconds (optional)
            
        Returns:
            New counter value or None if error
        """
        try:
            current_value = await self.get(key) or 0
            new_value = current_value + amount
            await self.set(key, new_value, ttl)
            return new_value
        except Exception as e:
            logger.error(f"Mock cache increment error for key {key}: {str(e)}")
            return None
    
    async def health_check(self) -> bool:
        """
        Mock health check - always returns True.
        
        Returns:
            Always True for mock cache
        """
        return True


# Global mock cache instance
mock_cache = MockCache()