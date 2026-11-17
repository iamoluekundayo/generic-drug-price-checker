"""Date helpers that use US Eastern time.

The app treats "today" as the current calendar date in New York
(America/New_York), not the server's local date or UTC. This keeps
date-based logic consistent wherever the code runs.
"""

from datetime import date, datetime
from zoneinfo import ZoneInfo


def today_eastern() -> date:
    """Return today's date in US Eastern time.

    Daylight saving time is handled automatically (EST/EDT).
    """
    return datetime.now(ZoneInfo("America/New_York")).date()
