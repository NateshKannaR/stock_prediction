"use client";

import { useState, useRef, useEffect } from "react";

type Message = {
  id: string;
  role: "user" | "assistant";
  content: string;
  timestamp: Date;
};

const KNOWLEDGE_BASE = {
  features: {
    dashboard: "The Dashboard shows an overview of your portfolio with live market data for 30 NSE stocks, including Nifty 50 and Sensex indices. It displays real-time prices, changes, and provides a search feature to quickly find stocks.",
    aiPredictions: "AI Predictions uses an LSTM neural network to generate BUY/SELL/HOLD signals for all 30 stocks. It provides confidence scores (0-100%), target prices, stop-loss levels, and 30-day price forecasts based on technical indicators like RSI, MACD, and Bollinger Bands.",
    liveMarket: "Live Market displays a watchlist of all 30 tracked stocks with real-time quotes. Click any stock to view detailed OHLC data (Open, High, Low, Close, Volume) and interactive price charts with multiple timeframes (1D, 1W, 1M, 1Y).",
    strategyBuilder: "Strategy Builder lets you create custom trading strategies by selecting stocks, configuring technical indicators (RSI, MACD, Moving Averages, Bollinger Bands), defining entry/exit rules, and setting risk parameters.",
    backtesting: "Backtesting allows you to test your trading strategies on historical data. It provides performance metrics including total return %, win rate, Sharpe ratio, maximum drawdown, and equity curve visualization.",
    autoTrading: "Auto-Trading enables automated trade execution based on AI signals. It includes paper trading mode, daily loss limits, capital allocation controls, and real-time monitoring of bot activity.",
    portfolio: "Portfolio Management tracks your holdings, P&L (profit and loss), allocation breakdown, and performance metrics. View realized and unrealized gains across all your positions.",
    riskManagement: "Risk Management helps you set daily loss limits, position sizing rules, stop-loss and take-profit targets, and monitors risk exposure across your portfolio.",
    liveNews: "Live News provides real-time market news from credible sources, focused on Indian stock market (NSE/BSE) with search functionality to find specific topics.",
  },
  stocks: {
    list: "The platform tracks 30 major NSE stocks across 7 sectors: Banking & Finance (HDFCBANK, ICICIBANK, SBIN, AXISBANK, KOTAK, BAJFINANCE, BAJAJFINSV), IT & Technology (TCS, INFY, WIPRO, HCL, TECHM), Energy & Utilities (RELIANCE, ONGC, POWERGRID), Automotive (TATAMOTORS, MARUTI, MAHINDRA), FMCG & Consumer (HINDUNILVR, ITC, TITAN, NESTLEIND), Infrastructure (LT, TATASTEEL, ADANIPORTS, ULTRACEMCO), and Others (BHARTIARTL, ADANIENT, ASIANPAINT, SUNPHARMA).",
    sectors: "Stocks are diversified across 7 sectors: Banking & Finance (23%), IT & Technology (17%), FMCG & Consumer (13%), Infrastructure (13%), Energy & Utilities (10%), Automotive (10%), and Others (13%).",
  },
  predictions: {
    signals: "AI generates three types of signals: BUY (bullish indicators, oversold conditions), SELL (bearish indicators, overbought conditions), and HOLD (neutral indicators, consolidation phase).",
    confidence: "Confidence scores range from 0-100%. Scores above 70% indicate high confidence, 50-70% moderate confidence, and below 50% low confidence. Higher confidence suggests stronger signal reliability.",
    indicators: "Technical indicators analyzed include RSI (14-period Relative Strength Index), MACD (Moving Average Convergence Divergence), SMA/EMA (Simple/Exponential Moving Averages), Bollinger Bands, Volume Analysis, and Support/Resistance levels.",
  },
  terms: {
    rsi: "RSI (Relative Strength Index) measures momentum on a scale of 0-100. Below 30 indicates oversold (potential buy), above 70 indicates overbought (potential sell).",
    macd: "MACD (Moving Average Convergence Divergence) shows trend direction and momentum. Bullish crossover (MACD crosses above signal line) suggests buy, bearish crossover suggests sell.",
    bollingerBands: "Bollinger Bands show volatility. Price near lower band suggests oversold, near upper band suggests overbought. Bands widen during high volatility, narrow during low volatility.",
    stopLoss: "Stop-Loss is a price level where you automatically exit a trade to limit losses. Typically set 1-2% below entry price for risk management.",
    takeProfit: "Take-Profit is a price level where you automatically exit to lock in gains. Typically set 2-5% above entry price based on risk-reward ratio.",
    sharpeRatio: "Sharpe Ratio measures risk-adjusted returns. Above 1.0 is good, above 2.0 is excellent. It shows how much return you get per unit of risk taken.",
    winRate: "Win Rate is the percentage of profitable trades. Above 60% is strong, 50-60% is average, below 50% needs improvement.",
    drawdown: "Maximum Drawdown is the largest peak-to-trough decline. Lower is better. Below 10% is low risk, 10-20% is moderate, above 20% is high risk.",
    paperTrading: "Paper Trading simulates real trading without using real money. Perfect for testing strategies and learning without financial risk.",
    ohlc: "OHLC stands for Open, High, Low, Close - the four key price points for any trading period. Used to analyze price action and create candlestick charts.",
  },
  howTo: {
    startTrading: "To start: 1) Review AI Predictions for BUY signals, 2) Check confidence scores (aim for 70%+), 3) Enable Paper Trading in Auto-Trading, 4) Set daily loss limits, 5) Monitor trades in Portfolio.",
    createStrategy: "Go to Strategy Builder → Click 'New Strategy' → Select stocks → Configure indicators (RSI, MACD) → Set entry rules (when to buy) → Set exit rules (stop-loss, take-profit) → Define risk parameters → Save strategy.",
    backtest: "Go to Backtesting → Select a stock → Set starting capital → Click 'Run Backtest' → Review metrics (return %, win rate, Sharpe ratio) → Analyze equity curve → Adjust strategy if needed.",
    readSignals: "Check AI Predictions page → Look for BUY signals with 70%+ confidence → Review target price and stop-loss → Check technical indicators (RSI, MACD) → Verify with price chart → Make informed decision.",
  },
};

function getAIResponse(userMessage: string): string {
  const msg = userMessage.toLowerCase();

  // Greetings
  if (msg.match(/^(hi|hello|hey|good morning|good afternoon|good evening)/)) {
    return "Hello! 👋 I'm your AI trading assistant. I can help you with:\n\n• Platform features and how to use them\n• Stock information and predictions\n• Trading terms and concepts\n• Strategy building and backtesting\n\nWhat would you like to know?";
  }

  // Features
  if (msg.includes("dashboard")) return KNOWLEDGE_BASE.features.dashboard;
  if (msg.includes("ai prediction") || msg.includes("prediction")) return KNOWLEDGE_BASE.features.aiPredictions;
  if (msg.includes("live market") || msg.includes("watchlist")) return KNOWLEDGE_BASE.features.liveMarket;
  if (msg.includes("strategy") && msg.includes("build")) return KNOWLEDGE_BASE.features.strategyBuilder;
  if (msg.includes("backtest")) return KNOWLEDGE_BASE.features.backtesting;
  if (msg.includes("auto") && msg.includes("trad")) return KNOWLEDGE_BASE.features.autoTrading;
  if (msg.includes("portfolio")) return KNOWLEDGE_BASE.features.portfolio;
  if (msg.includes("risk")) return KNOWLEDGE_BASE.features.riskManagement;
  if (msg.includes("news")) return KNOWLEDGE_BASE.features.liveNews;

  // Stocks
  if (msg.includes("stock") && (msg.includes("list") || msg.includes("available") || msg.includes("track"))) {
    return KNOWLEDGE_BASE.stocks.list;
  }
  if (msg.includes("sector")) return KNOWLEDGE_BASE.stocks.sectors;

  // Predictions
  if (msg.includes("signal") || msg.includes("buy") || msg.includes("sell") || msg.includes("hold")) {
    return KNOWLEDGE_BASE.predictions.signals;
  }
  if (msg.includes("confidence")) return KNOWLEDGE_BASE.predictions.confidence;
  if (msg.includes("indicator") || msg.includes("technical")) return KNOWLEDGE_BASE.predictions.indicators;

  // Terms
  if (msg.includes("rsi")) return KNOWLEDGE_BASE.terms.rsi;
  if (msg.includes("macd")) return KNOWLEDGE_BASE.terms.macd;
  if (msg.includes("bollinger")) return KNOWLEDGE_BASE.terms.bollingerBands;
  if (msg.includes("stop") && msg.includes("loss")) return KNOWLEDGE_BASE.terms.stopLoss;
  if (msg.includes("take") && msg.includes("profit")) return KNOWLEDGE_BASE.terms.takeProfit;
  if (msg.includes("sharpe")) return KNOWLEDGE_BASE.terms.sharpeRatio;
  if (msg.includes("win rate")) return KNOWLEDGE_BASE.terms.winRate;
  if (msg.includes("drawdown")) return KNOWLEDGE_BASE.terms.drawdown;
  if (msg.includes("paper") && msg.includes("trad")) return KNOWLEDGE_BASE.terms.paperTrading;
  if (msg.includes("ohlc")) return KNOWLEDGE_BASE.terms.ohlc;

  // How-to
  if (msg.includes("how") && msg.includes("start")) return KNOWLEDGE_BASE.howTo.startTrading;
  if (msg.includes("how") && msg.includes("create") && msg.includes("strategy")) return KNOWLEDGE_BASE.howTo.createStrategy;
  if (msg.includes("how") && msg.includes("backtest")) return KNOWLEDGE_BASE.howTo.backtest;
  if (msg.includes("how") && msg.includes("read") && msg.includes("signal")) return KNOWLEDGE_BASE.howTo.readSignals;

  // Features list
  if (msg.includes("feature") || msg.includes("what can")) {
    return "The platform offers these key features:\n\n📊 Dashboard - Portfolio overview and live market data\n🤖 AI Predictions - LSTM-powered BUY/SELL/HOLD signals\n📈 Live Market - Real-time quotes and price charts\n🎯 Strategy Builder - Create custom trading strategies\n⏮️ Backtesting - Test strategies on historical data\n🤖 Auto-Trading - Automated trade execution\n💼 Portfolio - Track holdings and P&L\n⚠️ Risk Management - Set limits and controls\n📰 Live News - Market news feed\n\nAsk me about any feature for more details!";
  }

  // Help
  if (msg.includes("help") || msg === "?") {
    return "I can help you with:\n\n1️⃣ Features - Ask about dashboard, predictions, backtesting, etc.\n2️⃣ Stocks - Ask about available stocks and sectors\n3️⃣ Predictions - Ask about signals, confidence, indicators\n4️⃣ Terms - Ask about RSI, MACD, stop-loss, etc.\n5️⃣ How-to - Ask how to start trading, create strategies, etc.\n\nTry asking: 'What stocks are available?' or 'How do I read signals?'";
  }

  // Default
  return "I'm not sure about that. Try asking about:\n\n• Platform features (dashboard, predictions, backtesting)\n• Available stocks and sectors\n• Trading signals and indicators\n• Key trading terms (RSI, MACD, stop-loss)\n• How to get started\n\nType 'help' to see all topics I can assist with!";
}

export function AIAssistant() {
  const [isOpen, setIsOpen] = useState(false);
  const [messages, setMessages] = useState<Message[]>([
    {
      id: "welcome",
      role: "assistant",
      content: "Hi! 👋 I'm your AI trading assistant. I can help you understand the platform features, stocks, predictions, and trading concepts. What would you like to know?",
      timestamp: new Date(),
    },
  ]);
  const [inputValue, setInputValue] = useState("");
  const messagesEndRef = useRef<HTMLDivElement>(null);

  const scrollToBottom = () => {
    messagesEndRef.current?.scrollIntoView({ behavior: "smooth" });
  };

  useEffect(() => {
    scrollToBottom();
  }, [messages]);

  const handleSend = () => {
    if (!inputValue.trim()) return;

    const userMessage: Message = {
      id: Date.now().toString(),
      role: "user",
      content: inputValue,
      timestamp: new Date(),
    };

    setMessages((prev) => [...prev, userMessage]);
    setInputValue("");

    // Simulate AI response delay
    setTimeout(() => {
      const aiResponse: Message = {
        id: (Date.now() + 1).toString(),
        role: "assistant",
        content: getAIResponse(inputValue),
        timestamp: new Date(),
      };
      setMessages((prev) => [...prev, aiResponse]);
    }, 500);
  };

  const handleKeyPress = (e: React.KeyboardEvent) => {
    if (e.key === "Enter" && !e.shiftKey) {
      e.preventDefault();
      handleSend();
    }
  };

  return (
    <>
      {/* Floating Button */}
      {!isOpen && (
        <button
          onClick={() => setIsOpen(true)}
          className="fixed bottom-6 right-6 z-50 h-14 w-14 rounded-full bg-accent shadow-lg hover:shadow-xl transition-all hover:scale-110 flex items-center justify-center group"
          aria-label="Open AI Assistant"
        >
          <svg className="w-7 h-7 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M8 10h.01M12 10h.01M16 10h.01M9 16H5a2 2 0 01-2-2V6a2 2 0 012-2h14a2 2 0 012 2v8a2 2 0 01-2 2h-5l-5 5v-5z" />
          </svg>
          <span className="absolute -top-1 -right-1 h-4 w-4 bg-red-500 rounded-full animate-pulse"></span>
        </button>
      )}

      {/* Chat Window */}
      {isOpen && (
        <div className="fixed bottom-6 right-6 z-50 w-96 h-[600px] rounded-2xl border border-border bg-panel shadow-2xl flex flex-col">
          {/* Header */}
          <div className="flex items-center justify-between p-4 border-b border-border">
            <div className="flex items-center gap-3">
              <div className="h-10 w-10 rounded-full bg-accent flex items-center justify-center">
                <svg className="w-6 h-6 text-black" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9.663 17h4.673M12 3v1m6.364 1.636l-.707.707M21 12h-1M4 12H3m3.343-5.657l-.707-.707m2.828 9.9a5 5 0 117.072 0l-.548.547A3.374 3.374 0 0014 18.469V19a2 2 0 11-4 0v-.531c0-.895-.356-1.754-.988-2.386l-.548-.547z" />
                </svg>
              </div>
              <div>
                <h3 className="font-semibold text-text">AI Assistant</h3>
                <p className="text-xs text-accent">Online</p>
              </div>
            </div>
            <button
              onClick={() => setIsOpen(false)}
              className="text-muted hover:text-text transition"
              aria-label="Close"
            >
              <svg className="w-6 h-6" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M6 18L18 6M6 6l12 12" />
              </svg>
            </button>
          </div>

          {/* Messages */}
          <div className="flex-1 overflow-y-auto p-4 space-y-4">
            {messages.map((message) => (
              <div
                key={message.id}
                className={`flex ${message.role === "user" ? "justify-end" : "justify-start"}`}
              >
                <div
                  className={`max-w-[80%] rounded-2xl px-4 py-2 ${
                    message.role === "user"
                      ? "bg-accent text-black"
                      : "bg-[#0f162a] text-text border border-border"
                  }`}
                >
                  <p className="text-sm whitespace-pre-line">{message.content}</p>
                  <p className={`text-xs mt-1 ${message.role === "user" ? "text-black/70" : "text-muted"}`}>
                    {message.timestamp.toLocaleTimeString("en-IN", { hour: "2-digit", minute: "2-digit" })}
                  </p>
                </div>
              </div>
            ))}
            <div ref={messagesEndRef} />
          </div>

          {/* Input */}
          <div className="p-4 border-t border-border">
            <div className="flex gap-2">
              <input
                type="text"
                value={inputValue}
                onChange={(e) => setInputValue(e.target.value)}
                onKeyPress={handleKeyPress}
                placeholder="Ask me anything..."
                className="flex-1 rounded-xl border border-border bg-[#0f162a] px-4 py-2 text-sm text-text placeholder:text-muted focus:border-accent focus:outline-none"
              />
              <button
                onClick={handleSend}
                disabled={!inputValue.trim()}
                className="rounded-xl bg-accent px-4 py-2 text-black font-medium hover:bg-accent/90 transition disabled:opacity-50 disabled:cursor-not-allowed"
              >
                <svg className="w-5 h-5" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 19l9 2-9-18-9 18 9-2zm0 0v-8" />
                </svg>
              </button>
            </div>
            <p className="text-xs text-muted mt-2 text-center">
              Press Enter to send • Shift+Enter for new line
            </p>
          </div>
        </div>
      )}
    </>
  );
}
