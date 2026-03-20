# News Sentiment Analysis Integration

## Overview

The platform now includes **news sentiment analysis** that evaluates recent news articles for each stock and incorporates sentiment scores into the trading decision process. This enhances the stock scanner by adding a 15% weight for news sentiment in the composite scoring formula.

---

## How It Works

### 1. News Fetching
- Fetches recent news articles from NewsData.io API
- Filters by:
  - Company name
  - Time window (default: last 24 hours)
  - Country: India
  - Category: Business
  - Language: English

### 2. Sentiment Analysis
- Analyzes article titles and descriptions
- Uses keyword-based scoring:
  - **Positive keywords**: profit, gain, surge, rally, bullish, growth, etc.
  - **Negative keywords**: loss, fall, crash, bearish, decline, etc.
- Generates score from **-1 (very negative)** to **+1 (very positive)**

### 3. Aggregation
- Counts positive, negative, and neutral articles
- Calculates average sentiment score
- Classifies overall sentiment:
  - **Positive**: score > 0.2
  - **Negative**: score < -0.2
  - **Neutral**: -0.2 ≤ score ≤ 0.2

### 4. Integration with Scanner
- Adds 15% weight to composite score
- Boosts score by 10% when:
  - BUY signal + positive sentiment (> 0.3)
  - SELL signal + negative sentiment (< -0.3)
- Caches results for 5 minutes to reduce API calls

---

## Updated Scoring Formula

### Before (without sentiment):
```python
score = (
    volatility * 0.25 +
    volume_surge * 0.25 +
    trend_strength * 0.20 +
    ml_confidence * 0.20 +
    liquidity * 0.10
)
```

### After (with sentiment):
```python
score = (
    volatility * 0.20 +           # 25% → 20%
    volume_surge * 0.20 +          # 25% → 20%
    trend_strength * 0.15 +        # 20% → 15%
    ml_confidence * 0.20 +         # 20% (unchanged)
    liquidity * 0.10 +             # 10% (unchanged)
    abs(sentiment_score) * 0.15    # NEW: 15% for sentiment
)

# Bonus multipliers
if ml_signal in ["BUY", "SELL"]:
    score *= 1.2

if ml_signal == "BUY" and sentiment_score > 0.3:
    score *= 1.1  # Positive news confirms BUY

if ml_signal == "SELL" and sentiment_score < -0.3:
    score *= 1.1  # Negative news confirms SELL
```

---

## API Endpoints

### Get Stock Sentiment
```bash
GET /api/v1/sentiment/{instrument_key}?hours=24
```

**Example:**
```bash
curl http://localhost:8000/api/v1/sentiment/NSE_EQ%7CINE002A01018?hours=24
```

**Response:**
```json
{
  "symbol": "NSE_EQ|INE002A01018",
  "company": "Reliance Industries",
  "sentiment_score": 0.65,
  "sentiment_label": "positive",
  "news_count": 15,
  "positive_count": 10,
  "negative_count": 2,
  "neutral_count": 3,
  "top_headlines": [
    {
      "title": "Reliance Industries reports strong Q4 earnings",
      "sentiment": 0.85,
      "published_at": "2024-01-15T08:30:00Z",
      "source": "Economic Times"
    }
  ],
  "analyzed_at": "2024-01-15T10:30:00Z"
}
```

### Get Sentiment History
```bash
GET /api/v1/sentiment/{instrument_key}/history?days=7
```

**Response:**
```json
{
  "instrument_key": "NSE_EQ|INE002A01018",
  "history": [
    {
      "sentiment_score": 0.65,
      "sentiment_label": "positive",
      "news_count": 15,
      "analyzed_at": "2024-01-15T10:30:00Z"
    }
  ]
}
```

### Scanner with Sentiment
```bash
POST /api/v1/scanner/scan
{
  "interval": "5minute",
  "top_n": 5,
  "include_sentiment": true
}
```

**Response includes sentiment fields:**
```json
{
  "top_stocks": [
    {
      "symbol": "NSE_EQ|INE002A01018",
      "intraday_score": 0.8534,
      "sentiment_score": 0.65,
      "sentiment_label": "positive",
      ...
    }
  ],
  "sentiment_enabled": true
}
```

---

## Database Schema

### news_sentiment Table
```sql
CREATE TABLE news_sentiment (
  id BIGSERIAL PRIMARY KEY,
  symbol VARCHAR(100) NOT NULL,
  company VARCHAR(200),
  sentiment_score NUMERIC(10,4) NOT NULL,
  sentiment_label VARCHAR(20) NOT NULL,
  news_count INTEGER NOT NULL,
  positive_count INTEGER NOT NULL,
  negative_count INTEGER NOT NULL,
  neutral_count INTEGER NOT NULL,
  analyzed_at TIMESTAMPTZ NOT NULL
);

CREATE INDEX idx_news_sentiment_symbol ON news_sentiment (symbol, analyzed_at DESC);
```

### stock_scores Table (updated)
```sql
ALTER TABLE stock_scores ADD COLUMN sentiment_score NUMERIC(10,4);
ALTER TABLE stock_scores ADD COLUMN sentiment_label VARCHAR(20);
```

---

## Configuration

### Enable/Disable Sentiment
```python
# In scanner call
scanner.scan_universe(
    interval="5minute",
    top_n=5,
    include_sentiment=True  # Set to False to disable
)
```

### Adjust Sentiment Weight
Edit `backend/app/services/stock_scanner.py`:
```python
score = (
    # ...
    abs(self.sentiment_score) * 0.20  # Increase from 0.15 to 0.20
)
```

### Change Sentiment Boost
```python
# Boost for aligned sentiment
if self.ml_signal == "BUY" and self.sentiment_score > 0.3:
    score *= 1.15  # Increase from 1.1 to 1.15
```

---

## Sentiment Analysis Methods

### Current: FinBERT (Production-Ready)
- **Model**: ProsusAI/finbert (BERT fine-tuned on financial news)
- **Accuracy**: ~85-90% on financial text
- **Speed**: ~50-100ms per article (CPU), ~10-20ms (GPU)
- **Size**: ~500 MB download
- **Fallback**: Keyword-based if model fails to load

**Advantages:**
- Specifically trained on financial news and sentiment
- Understands context and nuance
- Handles negations and complex sentences
- Industry-standard for financial NLP

**Output:**
- 3 classes: positive, negative, neutral
- Confidence scores for each class
- Converted to -1 to +1 scale (positive_prob - negative_prob)

### Alternative Options:

#### 1. Keyword-Based (Fallback)
```python
# Already implemented as fallback
# Used when FinBERT fails to load
# Accuracy: ~60-70%
```

#### 2. TextBlob (Not Recommended for Finance)
```python
from textblob import TextBlob

def _analyze_text(self, text: str) -> float:
    blob = TextBlob(text)
    return blob.sentiment.polarity  # -1 to +1
# Accuracy: ~65-75% (general text, not finance-specific)
```

#### 3. VADER (Better than TextBlob)
```python
from vaderSentiment.vaderSentiment import SentimentIntensityAnalyzer

analyzer = SentimentIntensityAnalyzer()

def _analyze_text(self, text: str) -> float:
    scores = analyzer.polarity_scores(text)
    return scores['compound']  # -1 to +1
# Accuracy: ~70-80% (social media tuned)
```

#### 4. FinBERT (CURRENT - Best for Finance) ✅
```python
# Already implemented!
# See backend/app/services/news_sentiment.py
# Accuracy: ~85-90%
```

#### 5. OpenAI API (Most Accurate but Expensive)
```python
import openai

def _analyze_text(self, text: str) -> float:
    response = openai.ChatCompletion.create(
        model="gpt-3.5-turbo",
        messages=[{
            "role": "user",
            "content": f"Rate sentiment from -1 to +1: {text}"
        }]
    )
    return float(response.choices[0].message.content)
# Accuracy: ~90-95% but costs $0.002 per article
```

---

## Usage Examples

### 1. Check Sentiment Before Trading
```python
sentiment = await sentiment_service.get_stock_sentiment(
    "NSE_EQ|INE002A01018",
    "Reliance Industries",
    hours=24
)

if sentiment["sentiment_label"] == "positive" and ml_signal == "BUY":
    # Strong buy signal with positive news
    execute_trade("BUY", quantity * 1.2)  # Increase position size
```

### 2. Filter Stocks by Sentiment
```python
top_stocks = await scanner.scan_universe(include_sentiment=True)

# Only trade stocks with positive or neutral sentiment
tradeable = [
    s for s in top_stocks
    if s["sentiment_label"] in ["positive", "neutral"]
]
```

### 3. Sentiment-Based Alerts
```python
if sentiment["sentiment_score"] < -0.5:
    alert("High negative sentiment for " + company)
    # Consider exiting position or avoiding entry
```

---

## Frontend Display

The scanner dashboard now shows:
- **Sentiment column** with color coding:
  - Green: Positive
  - Red: Negative
  - Gray: Neutral
- **Sentiment score** in parentheses (e.g., +0.65)

---

## Performance Considerations

### FinBERT Model Performance
- **First load**: 2-5 seconds (downloads model if not cached)
- **Subsequent loads**: <1 second (cached)
- **Inference time**: 
  - CPU: 50-100ms per article
  - GPU: 10-20ms per article
- **Memory usage**: ~500 MB (model) + ~100 MB (runtime)
- **Model size**: ~440 MB download

### Optimization for Production
1. **Model caching**: Model loads once at startup
2. **Batch processing**: Analyze multiple articles together
3. **GPU acceleration**: Automatically uses CUDA if available
4. **Result caching**: 5-minute TTL for sentiment scores
5. **Fallback**: Keyword-based if FinBERT fails

### Comparison: FinBERT vs Keyword-Based

| Metric | FinBERT | Keyword-Based |
|--------|---------|---------------|
| Accuracy | 85-90% | 60-70% |
| Speed (CPU) | 50-100ms | <1ms |
| Speed (GPU) | 10-20ms | <1ms |
| Memory | 500 MB | <1 MB |
| Context awareness | Yes | No |
| Handles negations | Yes | No |
| Setup complexity | Medium | Easy |

### API Rate Limits
- NewsData.io free tier: 200 requests/day
- Caching: 5-minute TTL reduces calls
- For 30 stocks: ~30 calls per scan
- Max scans per day: ~6 (with caching)

### Optimization Tips
1. **Increase cache TTL** to 15-30 minutes
2. **Batch sentiment analysis** for multiple stocks
3. **Use paid API tier** for higher limits
4. **Pre-fetch sentiment** during off-hours
5. **Store sentiment** in database for reuse

---

## Troubleshooting

### "No news found"
- **Cause**: Company name not matching news articles
- **Fix**: Update `COMPANY_NAMES` mapping in `news_sentiment.py`

### "Sentiment always neutral"
- **Cause**: Keyword list too limited
- **Fix**: Expand positive/negative keyword lists or upgrade to ML-based analysis

### "API rate limit exceeded"
- **Cause**: Too many requests to NewsData.io
- **Fix**: Increase cache TTL or upgrade API plan

### "Sentiment not affecting scores"
- **Cause**: Weight too low or sentiment values near zero
- **Fix**: Increase sentiment weight from 0.15 to 0.20+

---

## Benefits

✅ **Better stock selection**: Avoid stocks with negative news  
✅ **Confirmation signals**: Positive news + BUY signal = stronger trade  
✅ **Risk reduction**: Exit positions with deteriorating sentiment  
✅ **Market awareness**: Stay informed about company developments  
✅ **Competitive edge**: React to news faster than manual traders  

---

## Limitations

⚠️ **Keyword-based analysis**: Limited accuracy (~60-70%)  
⚠️ **API rate limits**: Free tier restricts scan frequency  
⚠️ **News lag**: Articles may be delayed by hours  
⚠️ **False signals**: Sentiment doesn't always predict price movement  
⚠️ **Language barrier**: Only English news analyzed  

---

## Future Enhancements

- [ ] Upgrade to FinBERT for better accuracy
- [ ] Add social media sentiment (Twitter, Reddit)
- [ ] Real-time news alerts via webhooks
- [ ] Sentiment trend analysis (improving/deteriorating)
- [ ] Sector-wide sentiment aggregation
- [ ] News impact scoring (major vs minor news)
- [ ] Multi-language support (Hindi, regional languages)

---

## Summary

News sentiment analysis adds a **15% weight** to the stock scanner's composite scoring, helping identify stocks with positive momentum backed by favorable news coverage. This enhances trading decisions by combining technical analysis, ML predictions, and market sentiment into a unified scoring system.

**Status**: ✅ Fully implemented and integrated with stock scanner
