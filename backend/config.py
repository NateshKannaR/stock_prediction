import os


class Config:
    SECRET_KEY = os.environ.get("SECRET_KEY", "dev")
    MONGO_URI = os.environ.get("MONGO_URI", "mongodb://localhost:27017/stockai")
    NEWS_SCRAPE_ENABLED = os.environ.get("NEWS_SCRAPE_ENABLED", "false").lower() == "true"
    FINBERT_ENABLED = os.environ.get("FINBERT_ENABLED", "false").lower() == "true"
