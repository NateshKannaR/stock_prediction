from __future__ import annotations

import asyncio
from datetime import datetime, timedelta, timezone
from typing import Any

import httpx
from motor.motor_asyncio import AsyncIOMotorDatabase

from app.core.config import get_settings

# Try to import transformers, but don't fail if not available
try:
    import torch
    from transformers import AutoModelForSequenceClassification, AutoTokenizer
    TRANSFORMERS_AVAILABLE = True
except ImportError:
    TRANSFORMERS_AVAILABLE = False
    torch = None
    AutoModelForSequenceClassification = None
    AutoTokenizer = None


class NewsSentimentService:
    """Analyze news sentiment for stocks using FinBERT."""
    
    def __init__(self, db: AsyncIOMotorDatabase):
        self.db = db
        self.settings = get_settings()
        self._sentiment_cache: dict[str, dict] = {}
        self._model = None
        self._tokenizer = None
        self._load_finbert()
    
    def _load_finbert(self) -> None:
        """Load FinBERT model and tokenizer."""
        if not TRANSFORMERS_AVAILABLE:
            print("⚠️  Transformers not available. Install with: pip install transformers sentencepiece")
            print("   Falling back to keyword-based sentiment analysis")
            self._model = None
            self._tokenizer = None
            return
        
        try:
            model_name = "ProsusAI/finbert"
            print(f"📥 Loading FinBERT model: {model_name}...")
            self._tokenizer = AutoTokenizer.from_pretrained(model_name)
            self._model = AutoModelForSequenceClassification.from_pretrained(model_name)
            self._model.eval()  # Set to evaluation mode
            
            # Move to GPU if available
            if torch.cuda.is_available():
                self._model = self._model.cuda()
                print("✅ FinBERT loaded on GPU")
            else:
                print("✅ FinBERT loaded on CPU")
        except Exception as e:
            print(f"⚠️  Failed to load FinBERT model: {e}")
            print("   Falling back to keyword-based sentiment analysis")
            self._model = None
            self._tokenizer = None
    
    async def get_stock_sentiment(
        self,
        symbol: str,
        company_name: str,
        hours: int = 24,
    ) -> dict[str, Any]:
        """
        Get sentiment score for a stock based on recent news.
        
        Returns:
            {
                "symbol": "NSE_EQ|INE002A01018",
                "company": "Reliance",
                "sentiment_score": 0.65,  # -1 to +1
                "sentiment_label": "positive",  # negative/neutral/positive
                "news_count": 15,
                "positive_count": 10,
                "negative_count": 2,
                "neutral_count": 3,
                "top_headlines": [...],
                "analyzed_at": "2024-01-15T10:30:00Z"
            }
        """
        # Check cache (5 min TTL)
        cache_key = f"{symbol}_{hours}"
        if cache_key in self._sentiment_cache:
            cached = self._sentiment_cache[cache_key]
            age = (datetime.now(timezone.utc) - cached["analyzed_at"]).seconds
            if age < 300:  # 5 minutes
                return cached
        
        # Fetch recent news
        articles = await self._fetch_news(company_name, hours)
        
        # If no articles found with primary name, try alternative search terms
        if len(articles) == 0 and symbol in COMPANY_SEARCH_TERMS:
            for alt_name in COMPANY_SEARCH_TERMS[symbol]:
                articles = await self._fetch_news(alt_name, hours)
                if len(articles) > 0:
                    break
        
        if not articles:
            return self._empty_sentiment(symbol, company_name)
        
        # Analyze sentiment
        sentiments = [self._analyze_text(a["title"] + " " + a.get("description", "")) for a in articles]
        
        positive = sum(1 for s in sentiments if s > 0.1)
        negative = sum(1 for s in sentiments if s < -0.1)
        neutral = len(sentiments) - positive - negative
        
        avg_sentiment = sum(sentiments) / len(sentiments) if sentiments else 0.0
        
        # Classify
        if avg_sentiment > 0.2:
            label = "positive"
        elif avg_sentiment < -0.2:
            label = "negative"
        else:
            label = "neutral"
        
        result = {
            "symbol": symbol,
            "company": company_name,
            "sentiment_score": round(avg_sentiment, 3),
            "sentiment_label": label,
            "news_count": len(articles),
            "positive_count": positive,
            "negative_count": negative,
            "neutral_count": neutral,
            "top_headlines": [
                {
                    "title": a["title"],
                    "sentiment": round(sentiments[i], 3),
                    "published_at": a.get("published_at", ""),
                    "source": a.get("source", ""),
                }
                for i, a in enumerate(articles[:5])
            ],
            "analyzed_at": datetime.now(timezone.utc),
        }
        
        # Cache result
        self._sentiment_cache[cache_key] = result
        
        # Persist to database
        await self._persist_sentiment(result)
        
        return result
    
    async def _fetch_news(self, query: str, hours: int = 24) -> list[dict]:
        """Fetch news articles specifically about the company from NewsData.io API."""
        try:
            # Build a more specific query for the company
            # Add stock market related keywords to ensure relevance
            specific_query = f'"{query}" AND (stock OR shares OR market OR trading OR earnings OR profit OR revenue)'
            
            async with httpx.AsyncClient(timeout=10) as client:
                response = await client.get(
                    "https://newsdata.io/api/1/news",
                    params={
                        "apikey": self.settings.news_api_key,
                        "q": specific_query,
                        "country": "in",
                        "language": "en",
                        "category": "business",
                    },
                )
                response.raise_for_status()
                data = response.json()
            
            articles = []
            cutoff = datetime.now(timezone.utc) - timedelta(hours=hours)
            
            for item in data.get("results", []):
                # Additional filtering: ensure company name is in title or description
                title = item.get("title", "").lower()
                description = item.get("description", "").lower()
                query_lower = query.lower()
                
                # Check if company name appears in title or description
                if query_lower not in title and query_lower not in description:
                    continue
                
                pub_date = item.get("pubDate", "")
                try:
                    pub_dt = datetime.fromisoformat(pub_date.replace("Z", "+00:00"))
                    if pub_dt < cutoff:
                        continue
                except Exception:
                    pass
                
                articles.append({
                    "title": item.get("title", ""),
                    "description": item.get("description", ""),
                    "source": item.get("source_name", ""),
                    "published_at": pub_date,
                    "url": item.get("link", ""),
                })
            
            return articles
        
        except Exception:
            return []
    
    def _analyze_text(self, text: str) -> float:
        """
        Analyze sentiment using FinBERT model.
        Returns score between -1 (negative) and +1 (positive).
        """
        if not text:
            return 0.0
        
        # Use FinBERT if available
        if self._model is not None and self._tokenizer is not None:
            return self._analyze_with_finbert(text)
        
        # Fallback to keyword-based analysis
        return self._analyze_with_keywords(text)
    
    def _analyze_with_finbert(self, text: str) -> float:
        """Use FinBERT model for sentiment analysis."""
        if not TRANSFORMERS_AVAILABLE or torch is None:
            return self._analyze_with_keywords(text)
        
        try:
            # Tokenize input (max 512 tokens)
            inputs = self._tokenizer(
                text,
                return_tensors="pt",
                truncation=True,
                max_length=512,
                padding=True,
            )
            
            # Move to GPU if model is on GPU
            if torch.cuda.is_available():
                inputs = {k: v.cuda() for k, v in inputs.items()}
            
            # Get predictions
            with torch.no_grad():
                outputs = self._model(**inputs)
                predictions = torch.nn.functional.softmax(outputs.logits, dim=-1)
            
            # FinBERT outputs: [positive, negative, neutral]
            # Convert to CPU and extract values
            probs = predictions[0].cpu().numpy()
            positive_prob = float(probs[0])
            negative_prob = float(probs[1])
            neutral_prob = float(probs[2])
            
            # Calculate sentiment score: positive - negative
            # Range: -1 (very negative) to +1 (very positive)
            sentiment_score = positive_prob - negative_prob
            
            return sentiment_score
        
        except Exception as e:
            print(f"FinBERT analysis failed: {e}. Using keyword fallback.")
            return self._analyze_with_keywords(text)
    
    def _analyze_with_keywords(self, text: str) -> float:
        """
        Fallback keyword-based sentiment analysis.
        Returns score between -1 (negative) and +1 (positive).
        """
        if not text:
            return 0.0
        
        text_lower = text.lower()
        
        # Positive keywords
        positive_words = [
            "profit", "gain", "surge", "rally", "bullish", "growth", "up", "rise",
            "strong", "beat", "outperform", "record", "high", "boost", "positive",
            "upgrade", "buy", "success", "win", "expansion", "breakthrough",
        ]
        
        # Negative keywords
        negative_words = [
            "loss", "fall", "drop", "crash", "bearish", "decline", "down", "weak",
            "miss", "underperform", "low", "cut", "negative", "downgrade", "sell",
            "fail", "concern", "risk", "warning", "debt", "lawsuit", "scandal",
        ]
        
        # Count occurrences
        pos_count = sum(text_lower.count(word) for word in positive_words)
        neg_count = sum(text_lower.count(word) for word in negative_words)
        
        total = pos_count + neg_count
        if total == 0:
            return 0.0
        
        # Normalize to -1 to +1
        score = (pos_count - neg_count) / total
        return max(-1.0, min(1.0, score))
    
    def _empty_sentiment(self, symbol: str, company: str) -> dict:
        """Return neutral sentiment when no news available."""
        return {
            "symbol": symbol,
            "company": company,
            "sentiment_score": 0.0,
            "sentiment_label": "neutral",
            "news_count": 0,
            "positive_count": 0,
            "negative_count": 0,
            "neutral_count": 0,
            "top_headlines": [],
            "analyzed_at": datetime.now(timezone.utc),
        }
    
    async def _persist_sentiment(self, sentiment: dict) -> None:
        """Save sentiment analysis to database."""
        await self.db["news_sentiment"].insert_one({
            "symbol": sentiment["symbol"],
            "company": sentiment["company"],
            "sentiment_score": sentiment["sentiment_score"],
            "sentiment_label": sentiment["sentiment_label"],
            "news_count": sentiment["news_count"],
            "positive_count": sentiment["positive_count"],
            "negative_count": sentiment["negative_count"],
            "neutral_count": sentiment["neutral_count"],
            "analyzed_at": sentiment["analyzed_at"],
        })
    
    async def get_sentiment_history(
        self,
        symbol: str,
        days: int = 7,
    ) -> list[dict]:
        """Get historical sentiment for a stock."""
        cutoff = datetime.now(timezone.utc) - timedelta(days=days)
        
        cursor = self.db["news_sentiment"].find(
            {"symbol": symbol, "analyzed_at": {"$gte": cutoff}},
            sort=[("analyzed_at", -1)],
        )
        
        docs = await cursor.to_list(length=1000)
        
        return [
            {
                "sentiment_score": d["sentiment_score"],
                "sentiment_label": d["sentiment_label"],
                "news_count": d["news_count"],
                "analyzed_at": d["analyzed_at"].isoformat(),
            }
            for d in docs
        ]


# Company name mapping for news queries
# Using exact company names as they appear in news
COMPANY_NAMES = {
    "NSE_EQ|INE002A01018": "Reliance Industries",
    "NSE_EQ|INE467B01029": "Tata Steel",
    "NSE_EQ|INE040A01034": "HDFC Bank",
    "NSE_EQ|INE009A01021": "Infosys",
    "NSE_EQ|INE090A01021": "ICICI Bank",
    "NSE_EQ|INE062A01020": "State Bank of India",
    "NSE_EQ|INE397D01024": "Bajaj Finance",
    "NSE_EQ|INE154A01025": "ITC Limited",
    "NSE_EQ|INE018A01030": "Larsen & Toubro",
    "NSE_EQ|INE030A01027": "HDFC",
    "NSE_EQ|INE155A01022": "Bharti Airtel",
    "NSE_EQ|INE721A01013": "Shriram Finance",
    "NSE_EQ|INE019A01038": "Asian Paints",
    "NSE_EQ|INE238A01034": "Axis Bank",
    "NSE_EQ|INE120A01034": "SBI Life Insurance",
    "NSE_EQ|INE752E01010": "Adani Ports",
    "NSE_EQ|INE742F01042": "Adani Enterprises",
    "NSE_EQ|INE066A01021": "Bajaj Finserv",
    "NSE_EQ|INE101D01020": "Mahindra & Mahindra",
    "NSE_EQ|INE239A01016": "Nestle India",
    "NSE_EQ|INE040H01021": "Adani Green Energy",
    "NSE_EQ|INE002S01010": "Adani Total Gas",
    "NSE_EQ|INE192A01025": "Wipro",
    "NSE_EQ|INE114A01011": "Titan Company",
    "NSE_EQ|INE296A01024": "Maruti Suzuki",
    "NSE_EQ|INE860A01027": "HCL Technologies",
    "NSE_EQ|INE075A01022": "Tech Mahindra",
    "NSE_EQ|INE769A01020": "Adani Transmission",
    "NSE_EQ|INE213A01029": "Tata Consultancy Services",
    "NSE_EQ|INE021A01026": "Bajaj Auto",
}

# Alternative search terms for better news matching
COMPANY_SEARCH_TERMS = {
    "NSE_EQ|INE002A01018": ["Reliance Industries", "RIL", "Reliance"],
    "NSE_EQ|INE467B01029": ["Tata Steel", "TATA Steel"],
    "NSE_EQ|INE040A01034": ["HDFC Bank", "HDFCBANK"],
    "NSE_EQ|INE009A01021": ["Infosys", "INFY"],
    "NSE_EQ|INE090A01021": ["ICICI Bank", "ICICIBANK"],
    "NSE_EQ|INE062A01020": ["State Bank of India", "SBI", "State Bank"],
    "NSE_EQ|INE397D01024": ["Bajaj Finance", "Bajaj Finserv"],
    "NSE_EQ|INE154A01025": ["ITC Limited", "ITC"],
    "NSE_EQ|INE018A01030": ["Larsen & Toubro", "L&T", "Larsen Toubro"],
    "NSE_EQ|INE213A01029": ["Tata Consultancy Services", "TCS", "Tata Consultancy"],
    "NSE_EQ|INE296A01024": ["Maruti Suzuki", "Maruti"],
    "NSE_EQ|INE860A01027": ["HCL Technologies", "HCL Tech", "HCL"],
}
