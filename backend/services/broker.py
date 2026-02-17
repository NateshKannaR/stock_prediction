from datetime import datetime


def get_status():
    return {
        "provider": "upstox",
        "connected": False,
        "note": "Upstox OAuth credentials not configured.",
        "updated_at": datetime.utcnow().isoformat(),
    }


def place_order(payload):
    return {
        "status": "blocked",
        "reason": "Upstox credentials missing. Configure OAuth before live orders.",
        "payload": payload,
        "created_at": datetime.utcnow().isoformat(),
    }
