from __future__ import annotations

import math
from typing import Dict, Optional


class EnhancedRiskManager:
    """Advanced risk management with Kelly Criterion, trailing stops, and dynamic sizing."""
    
    def __init__(
        self,
        daily_loss_limit: float,
        max_capital_allocation: float,
        risk_per_trade_pct: float = 1.0,
        max_position_size_pct: float = 20.0,
    ) -> None:
        self.daily_loss_limit = daily_loss_limit
        self.max_capital_allocation = max_capital_allocation
        self.risk_per_trade_pct = risk_per_trade_pct  # % of capital to risk per trade
        self.max_position_size_pct = max_position_size_pct  # Max % of capital per position
        
        # Track performance for Kelly Criterion
        self.win_rate = 0.5  # Start with 50%
        self.avg_win = 0.0
        self.avg_loss = 0.0
        self.total_trades = 0
        self.winning_trades = 0
    
    def calculate_position_size(
        self,
        last_price: float,
        stop_loss_price: float,
        confidence: float = 0.5,
        atr: float = 0.0,
    ) -> int:
        """
        Calculate optimal position size using multiple methods.
        
        Args:
            last_price: Current stock price
            stop_loss_price: Stop loss price level
            confidence: Model confidence (0-1)
            atr: Average True Range for volatility adjustment
        
        Returns:
            Optimal quantity to trade
        """
        # Method 1: Fixed risk per trade
        risk_amount = self.max_capital_allocation * (self.risk_per_trade_pct / 100)
        stop_distance = abs(last_price - stop_loss_price)
        
        if stop_distance == 0:
            return 1
        
        qty_fixed_risk = int(risk_amount / stop_distance)
        
        # Method 2: Kelly Criterion (if we have trade history)
        kelly_fraction = self._calculate_kelly_fraction()
        qty_kelly = int((self.max_capital_allocation * kelly_fraction) / last_price)
        
        # Method 3: Confidence-based sizing
        # Higher confidence = larger position (up to max)
        confidence_multiplier = 0.5 + (confidence * 0.5)  # 0.5 to 1.0
        qty_confidence = int((self.max_capital_allocation * self.max_position_size_pct / 100 * confidence_multiplier) / last_price)
        
        # Method 4: Volatility-adjusted sizing
        # Higher volatility = smaller position
        if atr > 0:
            volatility_pct = (atr / last_price) * 100
            volatility_multiplier = max(0.5, min(1.5, 2.0 / (1 + volatility_pct)))
            qty_volatility = int(qty_confidence * volatility_multiplier)
        else:
            qty_volatility = qty_confidence
        
        # Take the minimum of all methods for safety
        quantity = min(qty_fixed_risk, qty_kelly, qty_confidence, qty_volatility)
        
        # Ensure within bounds
        max_qty = int((self.max_capital_allocation * self.max_position_size_pct / 100) / last_price)
        quantity = max(1, min(quantity, max_qty))
        
        return quantity
    
    def _calculate_kelly_fraction(self) -> float:
        """
        Calculate Kelly Criterion fraction for optimal position sizing.
        
        Kelly % = W - [(1 - W) / R]
        Where:
            W = Win rate
            R = Average Win / Average Loss ratio
        """
        if self.total_trades < 10:
            # Not enough data, use conservative 10%
            return 0.10
        
        if self.avg_loss == 0:
            return 0.10
        
        win_loss_ratio = abs(self.avg_win / self.avg_loss) if self.avg_loss != 0 else 1.0
        kelly = self.win_rate - ((1 - self.win_rate) / win_loss_ratio)
        
        # Use fractional Kelly (25% of full Kelly) for safety
        kelly_fraction = max(0.05, min(kelly * 0.25, 0.25))
        
        return kelly_fraction
    
    def update_performance(self, pnl: float) -> None:
        """Update performance metrics for Kelly Criterion."""
        self.total_trades += 1
        
        if pnl > 0:
            self.winning_trades += 1
            # Update average win
            if self.avg_win == 0:
                self.avg_win = pnl
            else:
                self.avg_win = (self.avg_win * (self.winning_trades - 1) + pnl) / self.winning_trades
        else:
            # Update average loss
            losing_trades = self.total_trades - self.winning_trades
            if self.avg_loss == 0:
                self.avg_loss = abs(pnl)
            else:
                self.avg_loss = (self.avg_loss * (losing_trades - 1) + abs(pnl)) / losing_trades
        
        # Update win rate
        self.win_rate = self.winning_trades / self.total_trades
    
    def calculate_trailing_stop(
        self,
        entry_price: float,
        current_price: float,
        initial_stop: float,
        trailing_pct: float = 0.5,
    ) -> float:
        """
        Calculate trailing stop loss that moves with profit.
        
        Args:
            entry_price: Original entry price
            current_price: Current market price
            initial_stop: Initial stop loss price
            trailing_pct: Percentage to trail (default 0.5%)
        
        Returns:
            New stop loss price
        """
        # For long positions
        if current_price > entry_price:
            profit_pct = ((current_price - entry_price) / entry_price) * 100
            
            # Start trailing after 0.5% profit
            if profit_pct > 0.5:
                # Trail at 50% of profit
                trailing_stop = entry_price + ((current_price - entry_price) * 0.5)
                return max(trailing_stop, initial_stop)
        
        return initial_stop
    
    def should_scale_out(
        self,
        entry_price: float,
        current_price: float,
        profit_target_pct: float,
    ) -> Optional[float]:
        """
        Determine if we should take partial profits (scale out).
        
        Returns:
            Percentage of position to close (0.0 to 1.0) or None
        """
        profit_pct = ((current_price - entry_price) / entry_price) * 100
        
        # Take 50% profit at 75% of target
        if profit_pct >= profit_target_pct * 0.75:
            return 0.5
        
        # Take 25% profit at 50% of target
        elif profit_pct >= profit_target_pct * 0.5:
            return 0.25
        
        return None
    
    def check_daily_limit(self, today_pnl: float) -> tuple[bool, str]:
        """
        Check if daily loss limit has been hit.
        
        Returns:
            (should_stop, reason)
        """
        if self.daily_loss_limit > 0 and today_pnl <= -self.daily_loss_limit:
            return True, f"Daily loss limit ₹{self.daily_loss_limit} hit (P&L: ₹{today_pnl:.2f})"
        
        # Also check if we've lost 50% of daily limit in last 3 trades
        # This prevents rapid drawdown
        
        return False, ""
    
    def calculate_risk_reward_ratio(
        self,
        entry_price: float,
        target_price: float,
        stop_price: float,
    ) -> float:
        """Calculate risk-reward ratio for a trade."""
        potential_profit = abs(target_price - entry_price)
        potential_loss = abs(entry_price - stop_price)
        
        if potential_loss == 0:
            return 0.0
        
        return potential_profit / potential_loss
    
    def should_take_trade(
        self,
        risk_reward_ratio: float,
        confidence: float,
        min_rr: float = 1.5,
        min_confidence: float = 0.6,
    ) -> tuple[bool, str]:
        """
        Determine if a trade meets risk management criteria.
        
        Args:
            risk_reward_ratio: R:R ratio of the trade
            confidence: Model confidence (0-1)
            min_rr: Minimum acceptable R:R ratio
            min_confidence: Minimum acceptable confidence
        
        Returns:
            (should_take, reason)
        """
        if risk_reward_ratio < min_rr:
            return False, f"R:R ratio {risk_reward_ratio:.2f} below minimum {min_rr}"
        
        if confidence < min_confidence:
            return False, f"Confidence {confidence:.2%} below minimum {min_confidence:.0%}"
        
        # Adjust minimum R:R based on confidence
        # Higher confidence = can accept lower R:R
        adjusted_min_rr = min_rr * (1 - (confidence - min_confidence) * 0.5)
        
        if risk_reward_ratio < adjusted_min_rr:
            return False, f"R:R ratio {risk_reward_ratio:.2f} below adjusted minimum {adjusted_min_rr:.2f}"
        
        return True, "Trade meets risk criteria"
    
    def get_performance_stats(self) -> Dict[str, float]:
        """Get current performance statistics."""
        return {
            "total_trades": self.total_trades,
            "winning_trades": self.winning_trades,
            "win_rate": self.win_rate,
            "avg_win": self.avg_win,
            "avg_loss": self.avg_loss,
            "kelly_fraction": self._calculate_kelly_fraction(),
            "profit_factor": (self.avg_win * self.winning_trades) / (self.avg_loss * (self.total_trades - self.winning_trades)) if self.total_trades > self.winning_trades and self.avg_loss > 0 else 0.0,
        }


class RiskManager:
    """Legacy risk manager for backward compatibility."""
    
    def __init__(self, daily_loss_limit: float, max_capital_allocation: float) -> None:
        self.daily_loss_limit = daily_loss_limit
        self.max_capital_allocation = max_capital_allocation

    def calculate_position_size(self, last_price: float, stop_loss_pct: float) -> int:
        risk_amount = max(self.max_capital_allocation * 0.01, 1)
        stop_distance = last_price * (stop_loss_pct / 100)
        quantity = math.floor(risk_amount / stop_distance) if stop_distance else 0
        return max(quantity, 1)
