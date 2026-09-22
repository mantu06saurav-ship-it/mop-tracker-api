from fastapi import APIRouter, HTTPException, Query

from app.services.job_store import job_store
from app.services.scheduler import fetch_records_from_db, start_job

router = APIRouter(tags=["jobs"])


@router.post("/run-from-db")
def run_from_db(portal: str = Query(default="flipkart")):
    records = fetch_records_from_db(portal)
    if not records:
        raise HTTPException(status_code=400, detail=f'No rows found in dbo.mop_data for portal "{portal}"')
    job_id = start_job(portal.strip().lower(), records)
    return {"job_id": job_id, "total": len(records), "source": "mop_data"}


@router.get("/job/{job_id}")
def get_job(job_id: str):
    job = job_store.as_response(job_id)
    if job is None:
        raise HTTPException(status_code=404, detail="Unknown job id")
    return job
