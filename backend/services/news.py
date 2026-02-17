from datetime import datetime


def list_news(db, symbol, limit):
    try:
        items = list(
            db["news"].find({"symbol": symbol}).sort("published_at", -1).limit(limit)
        )
    except Exception:
        return [
            {
                "symbol": symbol,
                "title": "MongoDB is not reachable",
                "source": "placeholder",
                "url": "",
                "summary": "Start MongoDB or set MONGO_URI to enable news storage.",
                "published_at": datetime.utcnow().isoformat(),
                "sentiment": 0.0,
            }
        ]
    if not items:
        return [
            {
                "symbol": symbol,
                "title": "Add your Reuters or Moneycontrol ingestion pipeline",
                "source": "placeholder",
                "url": "",
                "summary": "News scraping is disabled by default. Use /api/news to ingest items.",
                "published_at": datetime.utcnow().isoformat(),
                "sentiment": 0.0,
            }
        ]
    for item in items:
        item["_id"] = str(item.get("_id"))
    return items


def store_news(db, symbol, items):
    if not items:
        return 0
    enriched = []
    now = datetime.utcnow().isoformat()
    for item in items:
        enriched.append(
            {
                "symbol": symbol,
                "title": item.get("title"),
                "source": item.get("source"),
                "url": item.get("url"),
                "summary": item.get("summary"),
                "published_at": item.get("published_at", now),
                "sentiment": item.get("sentiment", 0.0),
            }
        )
    try:
        result = db["news"].insert_many(enriched)
        return len(result.inserted_ids)
    except Exception:
        return 0
