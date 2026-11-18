"""Shared rate limiter for the API.

Kept in its own module so both ``main.py`` (which registers it on the app)
and the routers (which decorate routes with ``@limiter.limit(...)``) can import
it without importing each other."""

from slowapi import Limiter
from slowapi.util import get_remote_address

# Count requests per client IP address.
# limits are stored in memory: they reset when the server restarts,
# and aren't shared between multiple server processes.
limiter = Limiter(key_func=get_remote_address)
