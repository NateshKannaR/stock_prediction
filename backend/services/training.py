from datetime import datetime


def start_training_job(payload):
    return {
        "status": "queued",
        "model": payload.get("model", "lstm"),
        "symbol": payload.get("symbol"),
        "created_at": datetime.utcnow().isoformat(),
        "note": "Training pipeline scaffolding only. Wire data prep and model training here.",
    }
