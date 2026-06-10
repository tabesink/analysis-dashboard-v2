"""Protocol interfaces used by shared backend dependencies."""

from datetime import datetime
from typing import Any, Protocol, runtime_checkable


@runtime_checkable
class SessionStorage(Protocol):
    """Protocol for session storage operations."""

    def get(self, session_id: str) -> dict[str, Any] | None:
        """Get session by ID."""
        ...

    def create(self, session_id: str, data: dict[str, Any]) -> None:
        """Create new session."""
        ...

    def update(self, session_id: str, data: dict[str, Any]) -> None:
        """Update existing session."""
        ...

    def delete(self, session_id: str) -> bool:
        """Delete session. Returns True if existed."""
        ...

    def cleanup_expired(self) -> int:
        """Remove expired sessions. Returns count removed."""
        ...


@runtime_checkable
class CacheProtocol(Protocol):
    """Protocol for caching operations."""

    def get(self, key: str) -> Any | None:
        """Get cached value."""
        ...

    def set(self, key: str, value: Any, ttl_seconds: int | None = None) -> None:
        """Set cached value with optional TTL."""
        ...

    def invalidate(self, key: str) -> bool:
        """Invalidate specific key. Returns True if existed."""
        ...

    def invalidate_prefix(self, prefix: str) -> int:
        """Invalidate all keys with prefix. Returns count."""
        ...

    def clear(self) -> int:
        """Clear all cache. Returns count."""
        ...


@runtime_checkable
class UserLookupStore(Protocol):
    """Read-only user lookup surface for display/auth references."""

    def get_user_by_id(self, user_id: str) -> dict[str, Any] | None:
        """Get user by internal ID."""
        ...


@runtime_checkable
class UserManagementStore(UserLookupStore, Protocol):
    """Host-local user store surface used by auth and admin user flows."""

    def get_user_by_username(self, username: str) -> dict[str, Any] | None:
        """Get user by username."""
        ...

    def create_user(
        self,
        username: str,
        role: str = "user",
        password_hash: str | None = None,
        can_write: bool = False,
    ) -> dict[str, Any]:
        """Create a user record and return it."""
        ...

    def update_user_last_login(self, user_id: str) -> None:
        """Update user's last login timestamp."""
        ...

    def list_users(self) -> list[dict[str, Any]]:
        """Return all users ordered by creation time."""
        ...

    def update_user_role_and_write(
        self,
        user_id: str,
        role: str | None = None,
        can_write: bool | None = None,
    ) -> dict[str, Any] | None:
        """Patch role and/or write permission."""
        ...

    def set_user_password_hash(self, user_id: str, password_hash: str) -> bool:
        """Replace a user's password hash."""
        ...

    def delete_user(self, user_id: str) -> bool:
        """Delete a user row."""
        ...

    def count_users_created_after(
        self,
        after: datetime | None,
        exclude_user_id: str,
    ) -> int:
        """Count users created after a timestamp, excluding one user."""
        ...

    def mark_user_settings_visited(self, user_id: str) -> None:
        """Stamp the user's settings visit time."""
        ...

    def bump_user_token_version(self, user_id: str) -> int:
        """Increment token_version for a user and return the new value."""
        ...

