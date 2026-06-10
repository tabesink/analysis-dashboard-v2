"""Rate limiter categorization and middleware behavior."""

from unittest.mock import AsyncMock, MagicMock

import pytest
from fastapi import HTTPException, Request
from starlette.datastructures import URL

from server.config import RateLimitingSettings, Settings
from server.middleware.rate_limiter import RateLimiter, RateLimitMiddleware


def _make_request(path: str, method: str = "GET") -> Request:
    scope = {
        "type": "http",
        "method": method,
        "path": path,
        "headers": [],
        "query_string": b"",
        "client": ("127.0.0.1", 12345),
    }
    request = Request(scope)
    request._url = URL(path)  # type: ignore[attr-defined]
    return request


@pytest.fixture
def rate_limiter(tmp_path) -> RateLimiter:
    settings = Settings(
        data_root=tmp_path / "data",
        log_dir=tmp_path / "logs",
        rate_limiting=RateLimitingSettings(
            enabled=True,
            default_requests_per_minute=120,
            upload_requests_per_minute=10,
            burst_allowance=0,
        ),
    )
    return RateLimiter(settings)


@pytest.mark.parametrize(
    ("path", "method", "expected_category"),
    [
        ("/api/v1/upload/datasets", "GET", "default"),
        ("/api/v1/upload/folder/task/task-1", "GET", "default"),
        ("/api/v1/upload/folder/events/task-1", "GET", "default"),
        ("/api/v1/upload/folder/start", "POST", "upload"),
        ("/api/v1/upload/events/delete", "POST", "upload"),
        ("/api/v1/upload/events/event-1", "DELETE", "upload"),
    ],
)
def test_categorize_upload_read_vs_write(
    rate_limiter: RateLimiter,
    path: str,
    method: str,
    expected_category: str,
) -> None:
    category, _rpm = rate_limiter._categorize_endpoint(_make_request(path, method))
    assert category == expected_category


def test_upload_task_polling_does_not_block_dataset_list(
    rate_limiter: RateLimiter,
) -> None:
    task_request = _make_request("/api/v1/upload/folder/task/task-1", "GET")
    datasets_request = _make_request("/api/v1/upload/datasets", "GET")
    start_request = _make_request("/api/v1/upload/folder/start", "POST")

    upload_bucket = rate_limiter._get_bucket("upload:ip:127.0.0.1", 10)
    upload_bucket.tokens = 0

    with pytest.raises(HTTPException) as exc_info:
        rate_limiter.check_rate_limit(start_request)
    assert exc_info.value.status_code == 429
    assert "upload" in str(exc_info.value.detail)

    rate_limiter.check_rate_limit(task_request)
    rate_limiter.check_rate_limit(datasets_request)


@pytest.mark.asyncio
async def test_middleware_returns_json_429_without_unhandled_exception(
    rate_limiter: RateLimiter,
) -> None:
    request = _make_request("/api/v1/upload/folder/start", "POST")
    upload_bucket = rate_limiter._get_bucket("upload:ip:127.0.0.1", 10)
    upload_bucket.tokens = 0

    middleware = RateLimitMiddleware(MagicMock(), rate_limiter)
    call_next = AsyncMock()

    response = await middleware.dispatch(request, call_next)

    assert response.status_code == 429
    assert response.headers.get("retry-after") is not None
    call_next.assert_not_called()
