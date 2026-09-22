"""Mutex shared between the per-minute scheduler tick and the manual
POST /api/email-settings/send-now endpoint, so they never send the daily snapshot concurrently."""

import threading

_lock = threading.Lock()
_sending = False


def try_acquire() -> bool:
    global _sending
    with _lock:
        if _sending:
            return False
        _sending = True
        return True


def release() -> None:
    global _sending
    with _lock:
        _sending = False


def is_sending() -> bool:
    return _sending
