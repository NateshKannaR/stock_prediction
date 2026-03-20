from __future__ import annotations

import math

import pandas as pd

from app.services.indicators import add_technical_indicators


class Backtester:
    def run(self, frame: pd.DataFrame, capital: float) -> dict:
        enriched = add_technical_indicators(frame)
        position = 0
        cash = capital
        equity_curve: list[float] = []
        trades = 0
        wins = 0
        for _, row in enriched.iterrows():
            buy_signal = row["rsi_14"] < 35 and row["macd"] > row["macd_signal"]
            sell_signal = row["rsi_14"] > 65 and row["macd"] < row["macd_signal"]
            if position == 0 and buy_signal:
                position = math.floor(cash / row["close"])
                cash -= position * row["close"]
                trades += 1
            elif position > 0 and sell_signal:
                exit_value = position * row["close"]
                if exit_value > position * row["open"]:
                    wins += 1
                cash += exit_value
                position = 0
                trades += 1
            equity_curve.append(cash + position * row["close"])

        equity_series = pd.Series(equity_curve)
        returns = equity_series.pct_change().dropna()
        drawdown = ((equity_series.cummax() - equity_series) / equity_series.cummax()).fillna(0)
        sharpe = float((returns.mean() / returns.std()) * (252**0.5)) if not returns.empty and returns.std() else 0.0
        return {
            "ending_capital": float(equity_series.iloc[-1]) if not equity_series.empty else capital,
            "total_return_pct": float(((equity_series.iloc[-1] - capital) / capital) * 100) if not equity_series.empty else 0.0,
            "win_rate": float((wins / trades) * 100) if trades else 0.0,
            "sharpe_ratio": sharpe,
            "max_drawdown_pct": float(drawdown.max() * 100) if not drawdown.empty else 0.0,
            "trades": trades,
            "equity_curve": [float(value) for value in equity_curve],
        }

