import re

from fastapi import APIRouter, Depends, HTTPException
from sqlalchemy import text

from app.api.deps import get_current_user, require_admin
from app.db.session import get_conn
from app.schemas.misc import ScrapeScheduleRequest
from app.services.scheduler import configure_auto_scrape_schedule

router = APIRouter(prefix="/api/scrape-schedule", tags=["scrape schedule"])
_TIME_RE = re.compile(r"^(?:[01]\d|2[0-3]):[0-5]\d$")


def _get_schedule() -> dict:
    with get_conn() as conn:
        row = conn.execute(text("SELECT * FROM dbo.scrape_schedule_settings WHERE id = 1")).fetchone()
    if row is None:
        return {"enabled": True, "times": ["00:00", "06:00", "12:00", "18:00"], "updated_by": None, "updated_at": None}
    schedule = dict(row._mapping)
    schedule["enabled"] = bool(schedule.get("enabled"))
    schedule["times"] = sorted(set(time.strip() for time in (schedule.get("times") or "").split(",") if time.strip()))
    return schedule


@router.get("")
def get_scrape_schedule(_: dict = Depends(get_current_user)):
    return {"schedule": _get_schedule(), "timezone": "Asia/Kolkata"}


@router.put("")
def update_scrape_schedule(body: ScrapeScheduleRequest, admin: dict = Depends(require_admin)):
    times = sorted(set(time.strip() for time in body.times if time.strip()))
    if any(not _TIME_RE.fullmatch(time) for time in times):
        raise HTTPException(status_code=400, detail="Each time must use HH:MM 24-hour format")
    if body.enabled and not times:
        raise HTTPException(status_code=400, detail="Choose at least one daily run time or turn the schedule off")
    if len(times) > 24:
        raise HTTPException(status_code=400, detail="A maximum of 24 daily run times is allowed")

    with get_conn() as conn:
        conn.execute(
            text(
                """
                UPDATE dbo.scrape_schedule_settings
                SET enabled = :enabled, times = :times, updated_by = :updated_by, updated_at = GETDATE()
                WHERE id = 1
                """
            ),
            {"enabled": body.enabled, "times": ",".join(times), "updated_by": admin["email"]},
        )

    configure_auto_scrape_schedule(body.enabled, times)
    return {"schedule": _get_schedule(), "timezone": "Asia/Kolkata"}
