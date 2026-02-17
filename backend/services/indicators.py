import numpy as np


def compute_indicators(frame, settings=None):
    config = settings or {}
    rsi_period = int(config.get("rsi_period", 14))
    sma_fast = int(config.get("sma_fast", 20))
    sma_slow = int(config.get("sma_slow", 50))
    ema_fast = int(config.get("ema_fast", 12))
    ema_slow = int(config.get("ema_slow", 26))
    bb_period = int(config.get("bb_period", 20))
    bb_std = float(config.get("bb_std", 2))

    data = frame.copy()
    data["sma_fast"] = data["close"].rolling(sma_fast).mean()
    data["sma_slow"] = data["close"].rolling(sma_slow).mean()

    delta = data["close"].diff()
    gain = delta.where(delta > 0, 0.0)
    loss = -delta.where(delta < 0, 0.0)
    avg_gain = gain.rolling(rsi_period).mean()
    avg_loss = loss.rolling(rsi_period).mean()
    rs = avg_gain / avg_loss.replace(0, np.nan)
    data["rsi"] = 100 - (100 / (1 + rs))

    ema_fast_series = data["close"].ewm(span=ema_fast, adjust=False).mean()
    ema_slow_series = data["close"].ewm(span=ema_slow, adjust=False).mean()
    data["ema_fast"] = ema_fast_series
    data["ema_slow"] = ema_slow_series
    data["macd"] = ema_fast_series - ema_slow_series
    data["macd_signal"] = data["macd"].ewm(span=9, adjust=False).mean()
    data["macd_hist"] = data["macd"] - data["macd_signal"]

    rolling_mean = data["close"].rolling(bb_period).mean()
    rolling_std = data["close"].rolling(bb_period).std()
    data["bb_upper"] = rolling_mean + (rolling_std * bb_std)
    data["bb_lower"] = rolling_mean - (rolling_std * bb_std)

    typical = (data["high"] + data["low"] + data["close"]) / 3
    vwap = (typical * data["volume"]).cumsum() / data["volume"].replace(0, np.nan).cumsum()
    data["vwap"] = vwap

    fib_high = data["high"].max()
    fib_low = data["low"].min()
    fib_range = fib_high - fib_low
    data["fib_236"] = fib_high - fib_range * 0.236
    data["fib_382"] = fib_high - fib_range * 0.382
    data["fib_618"] = fib_high - fib_range * 0.618

    data.replace([np.inf, -np.inf], np.nan, inplace=True)
    data.bfill(inplace=True)
    return data
