from __future__ import annotations

import math


class RiskManager:
    def __init__(self, daily_loss_limit: float, max_capital_allocation: float) -> None:
        self.daily_loss_limit = daily_loss_limit
        self.max_capital_allocation = max_capital_allocation

    def calculate_position_size(self, last_price: float, stop_loss_pct: float) -> int:
        risk_amount = max(self.max_capital_allocation * 0.01, 1)
        stop_distance = last_price * (stop_loss_pct / 100)
        quantity = math.floor(risk_amount / stop_distance) if stop_distance else 0
        return max(quantity, 1)

