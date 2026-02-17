import pandas as pd


def fetch_history(symbol, start=None, end=None):
    try:
        import yfinance as yf
    except ImportError as exc:
        raise RuntimeError("yfinance is not installed. Install backend requirements.") from exc

    ticker = yf.Ticker(symbol)
    try:
        frame = ticker.history(start=start, end=end, auto_adjust=False)
    except Exception as exc:
        raise RuntimeError("Failed to fetch price data from provider. Check network access or symbol.") from exc
    if frame.empty:
        raise RuntimeError("No price data returned. Check symbol or data provider access.")
    frame = frame.reset_index()
    frame.rename(
        columns={"Date": "date", "Open": "open", "High": "high", "Low": "low", "Close": "close", "Volume": "volume"},
        inplace=True,
    )
    return frame[["date", "open", "high", "low", "close", "volume"]]
