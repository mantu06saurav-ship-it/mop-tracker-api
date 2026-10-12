"""In-memory scrape-job registry — deliberately not persisted, mirrors the Node app's
`const jobs = {}` (lost on restart, single-process). Thread-safe enough for FastAPI's
threadpool + asyncio usage since dict item assignment is atomic under the GIL.
"""

import threading
from typing import Optional
from uuid import uuid4


class JobStore:
    def __init__(self) -> None:
        self._jobs: dict[str, dict] = {}
        self._lock = threading.Lock()

    def create(self, total: int) -> str:
        job_id = str(uuid4())
        with self._lock:
            self._jobs[job_id] = {
                "status": "QUEUED",
                "total": total,
                "done": 0,
                "errors": 0,
                "inserted": 0,
                "db_error": None,
                "last_error": None,
                "rows": [],
            }
        return job_id

    def get(self, job_id: str) -> Optional[dict]:
        with self._lock:
            job = self._jobs.get(job_id)
            return dict(job) if job else None

    def set_status(self, job_id: str, status: str, last_error: str | None = None) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job["status"] = status
            if last_error is not None:
                job["last_error"] = last_error

    def record_success(self, job_id: str, row: dict) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job["done"] += 1
            job["rows"].append(row)

    def record_insert(self, job_id: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job["inserted"] += 1

    def record_db_error(self, job_id: str, message: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job["db_error"] = message

    def record_error(self, job_id: str, message: str) -> None:
        with self._lock:
            job = self._jobs.get(job_id)
            if job is None:
                return
            job["done"] += 1
            job["errors"] += 1
            job["last_error"] = message

    def as_response(self, job_id: str) -> Optional[dict]:
        job = self.get(job_id)
        if job is None:
            return None
        total = job["total"] or 1
        job["percent"] = round((job["done"] / total) * 100)
        job["job_id"] = job_id
        return job


job_store = JobStore()
