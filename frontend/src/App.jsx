import React, { useEffect, useMemo, useRef, useState } from "react";
import { Chart } from "chart.js/auto";

const API_BASE = import.meta.env.VITE_API_BASE || "http://localhost:5000";

const routes = [
  { id: "dashboard", label: "Command Deck", meta: "Overview + signals" },
  { id: "prediction", label: "AI Prediction Engine", meta: "Ensemble + confidence" },
  { id: "news", label: "AI News Sentiment", meta: "Sources + impact" },
  { id: "indicators", label: "Indicators Panel", meta: "RSI / MACD / VWAP" },
  { id: "portfolio", label: "Portfolio Simulator", meta: "PnL + risk" },
  { id: "backtest", label: "Backtesting Engine", meta: "Strategy replay" },
  { id: "strategy", label: "Strategy Builder", meta: "No-code rules" },
  { id: "live", label: "Live Market Mode", meta: "Streaming snapshot" },
  { id: "risk", label: "Risk Dashboard", meta: "VaR + beta" },
  { id: "accounts", label: "Accounts", meta: "Login + watchlist" },
  { id: "explain", label: "AI Explainability", meta: "Feature impact" },
  { id: "institutional", label: "Institutional Data", meta: "FII / DII" },
  { id: "macro", label: "Macro Impact", meta: "Rates + events" },
  { id: "assistant", label: "Market Assistant", meta: "Q&A" }
];

const sampleSignals = [
  { label: "Momentum", value: "Strong", tag: "12h" },
  { label: "Volatility", value: "Elevated", tag: "6h" },
  { label: "Liquidity", value: "High", tag: "Live" },
  { label: "Sentiment", value: "Neutral", tag: "Realtime" }
];

const sampleFunds = [
  { name: "Axis Bluechip Fund", tag: "Large Cap", score: "7.8" },
  { name: "Parag Parikh Flexi Cap", tag: "Flexi Cap", score: "8.2" },
  { name: "Mirae Asset Midcap", tag: "Mid Cap", score: "7.1" }
];

const getRoute = () => {
  const hash = window.location.hash.replace("#", "");
  return routes.some((route) => route.id === hash) ? hash : "dashboard";
};

const fetchJson = async (url, options = {}) => {
  const res = await fetch(url, options);
  const data = await res.json();
  if (!res.ok) {
    throw new Error(data.error || "Request failed");
  }
  return data;
};

export default function App() {
  const chartRef = useRef(null);
  const chartInstance = useRef(null);
  const [route, setRoute] = useState(getRoute());
  const [symbol, setSymbol] = useState("AAPL");
  const [prediction, setPrediction] = useState(null);
  const [status, setStatus] = useState("idle");

  const [newsData, setNewsData] = useState({ items: [], breakdown: null, sources: [] });
  const [ensemble, setEnsemble] = useState(null);
  const [multiFrame, setMultiFrame] = useState(null);
  const [indicatorCatalog, setIndicatorCatalog] = useState([]);
  const [indicatorSettings, setIndicatorSettings] = useState({
    rsi_period: 14,
    sma_fast: 20,
    sma_slow: 50,
    ema_fast: 12,
    ema_slow: 26,
    bb_period: 20,
    bb_std: 2
  });
  const [indicatorRows, setIndicatorRows] = useState([]);
  const [portfolioResult, setPortfolioResult] = useState(null);
  const [backtestResult, setBacktestResult] = useState(null);
  const [strategyRule, setStrategyRule] = useState("IF RSI < 30 AND Sentiment Positive THEN BUY");
  const [strategyParse, setStrategyParse] = useState(null);
  const [strategyEval, setStrategyEval] = useState(null);
  const [liveSnapshot, setLiveSnapshot] = useState(null);
  const [riskData, setRiskData] = useState(null);
  const [explainData, setExplainData] = useState(null);
  const [institutionalData, setInstitutionalData] = useState(null);
  const [macroData, setMacroData] = useState(null);
  const [assistantQuestion, setAssistantQuestion] = useState("Should I buy AAPL?");
  const [assistantReply, setAssistantReply] = useState(null);

  const [authEmail, setAuthEmail] = useState(() => localStorage.getItem("authEmail") || "");
  const [authToken, setAuthToken] = useState(() => localStorage.getItem("authToken") || "");
  const [authPassword, setAuthPassword] = useState("");
  const [watchlist, setWatchlist] = useState([]);
  const [history, setHistory] = useState([]);

  const activeRoute = useMemo(
    () => routes.find((item) => item.id === route) || routes[0],
    [route]
  );

  useEffect(() => {
    const onHashChange = () => setRoute(getRoute());
    window.addEventListener("hashchange", onHashChange);
    return () => window.removeEventListener("hashchange", onHashChange);
  }, []);

  useEffect(() => {
    if (!chartRef.current || route !== "dashboard") return;
    if (chartInstance.current) chartInstance.current.destroy();

    chartInstance.current = new Chart(chartRef.current, {
      type: "line",
      data: {
        labels: ["Mon", "Tue", "Wed", "Thu", "Fri", "Mon", "Tue"],
        datasets: [
          {
            label: "Price Forecast",
            data: [162, 166, 164, 170, 173, 171, 178],
            borderColor: "#f7c96b",
            backgroundColor: "rgba(247, 201, 107, 0.12)",
            borderWidth: 2,
            tension: 0.35,
            pointRadius: 3,
            pointBackgroundColor: "#f7c96b"
          }
        ]
      },
      options: {
        responsive: true,
        plugins: { legend: { display: false } },
        scales: {
          x: { grid: { color: "rgba(255,255,255,0.08)" } },
          y: { grid: { color: "rgba(255,255,255,0.08)" } }
        }
      }
    });
  }, [route]);

  useEffect(() => {
    if (route === "news" || route === "dashboard") {
      fetchNews();
    }
    if (route === "indicators") {
      fetchIndicatorCatalog();
    }
    if (route === "risk") {
      fetchRisk();
    }
    if (route === "explain") {
      fetchExplainability();
    }
    if (route === "institutional") {
      fetchInstitutional();
    }
    if (route === "macro") {
      fetchMacro();
    }
  }, [route, symbol]);

  useEffect(() => {
    if (route !== "live") return;
    fetchLive();
    const timer = setInterval(fetchLive, 4000);
    return () => clearInterval(timer);
  }, [route, symbol]);

  useEffect(() => {
    if (!authToken || route !== "accounts") return;
    fetchWatchlist();
    fetchHistory();
  }, [authToken, route]);

  const fetchNews = async () => {
    try {
      const [sentiment, sources] = await Promise.all([
        fetchJson(`${API_BASE}/api/news/sentiment?symbol=${symbol}`),
        fetchJson(`${API_BASE}/api/news/sources`)
      ]);
      setNewsData({ items: sentiment.items || [], breakdown: sentiment.breakdown, sources: sources.sources || [] });
    } catch (err) {
      setNewsData({ items: [], breakdown: null, sources: [] });
    }
  };

  const fetchIndicatorCatalog = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/indicators/catalog`);
      setIndicatorCatalog(data.indicators || []);
    } catch (err) {
      setIndicatorCatalog([]);
    }
  };

  const fetchIndicators = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/indicators/advanced`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, settings: indicatorSettings })
      });
      setIndicatorRows(data.rows || []);
    } catch (err) {
      setIndicatorRows([]);
    }
  };

  const fetchRisk = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/risk/overview?symbol=${symbol}`);
      setRiskData(data);
    } catch (err) {
      setRiskData(null);
    }
  };

  const fetchExplainability = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/explainability?symbol=${symbol}`);
      setExplainData(data);
    } catch (err) {
      setExplainData(null);
    }
  };

  const fetchInstitutional = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/institutional?symbol=${symbol}`);
      setInstitutionalData(data);
    } catch (err) {
      setInstitutionalData(null);
    }
  };

  const fetchMacro = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/macro?region=IN`);
      setMacroData(data);
    } catch (err) {
      setMacroData(null);
    }
  };

  const fetchLive = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/live/price?symbol=${symbol}`);
      setLiveSnapshot(data);
    } catch (err) {
      setLiveSnapshot(null);
    }
  };

  const runPrediction = async () => {
    setStatus("loading");
    setPrediction(null);
    try {
      const data = await fetchJson(`${API_BASE}/api/predict`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": authToken },
        body: JSON.stringify({ symbol })
      });
      setPrediction(data);
    } catch (err) {
      setPrediction({ error: err.message || "Prediction failed. Check backend logs." });
    } finally {
      setStatus("idle");
    }
  };

  const runEnsemble = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/predict/ensemble`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, timeframe: "daily" })
      });
      setEnsemble(data);
      const multi = await fetchJson(`${API_BASE}/api/predict/multiframe?symbol=${symbol}`);
      setMultiFrame(multi);
    } catch (err) {
      setEnsemble(null);
      setMultiFrame(null);
    }
  };

  const runPortfolioSim = async () => {
    try {
      const payload = {
        symbol,
        initial_cash: 100000,
        trades: [{ side: "buy", qty: 50 }, { side: "sell", qty: 20 }]
      };
      const data = await fetchJson(`${API_BASE}/api/portfolio/simulate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify(payload)
      });
      setPortfolioResult(data);
    } catch (err) {
      setPortfolioResult(null);
    }
  };

  const runBacktest = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/backtest/run`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, start: "2023-01-01", end: "2024-01-01", strategy: "rsi_reversion" })
      });
      setBacktestResult(data);
    } catch (err) {
      setBacktestResult(null);
    }
  };

  const parseStrategy = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/strategy/parse`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ rule: strategyRule })
      });
      setStrategyParse(data);
    } catch (err) {
      setStrategyParse(null);
    }
  };

  const evaluateStrategy = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/strategy/evaluate`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ symbol, rule: strategyRule })
      });
      setStrategyEval(data);
    } catch (err) {
      setStrategyEval(null);
    }
  };

  const askAssistant = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/assistant`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ question: assistantQuestion, symbol })
      });
      setAssistantReply(data);
    } catch (err) {
      setAssistantReply(null);
    }
  };

  const registerAccount = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/users/register`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      return data;
    } catch (err) {
      return { error: err.message };
    }
  };

  const loginAccount = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/users/login`, {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ email: authEmail, password: authPassword })
      });
      localStorage.setItem("authToken", data.token);
      localStorage.setItem("authEmail", data.email);
      setAuthToken(data.token);
      setAuthEmail(data.email);
    } catch (err) {
      setAuthToken("");
    }
  };

  const logoutAccount = () => {
    localStorage.removeItem("authToken");
    localStorage.removeItem("authEmail");
    setAuthToken("");
  };

  const fetchWatchlist = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/users/watchlist`, {
        headers: { "X-Auth-Token": authToken }
      });
      setWatchlist(data.watchlist || []);
    } catch (err) {
      setWatchlist([]);
    }
  };

  const fetchHistory = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/users/history`, {
        headers: { "X-Auth-Token": authToken }
      });
      setHistory(data.history || []);
    } catch (err) {
      setHistory([]);
    }
  };

  const addToWatchlist = async () => {
    try {
      const data = await fetchJson(`${API_BASE}/api/users/watchlist`, {
        method: "POST",
        headers: { "Content-Type": "application/json", "X-Auth-Token": authToken },
        body: JSON.stringify({ symbol })
      });
      setWatchlist(data.watchlist || []);
    } catch (err) {
      setWatchlist([]);
    }
  };

  return (
    <div className="app-shell">
      <aside className="sidebar">
        <div className="brand">
          <div className="brand-mark">PF</div>
          <div>
            <p>PulseForge</p>
            <span>Intelligence Suite</span>
          </div>
        </div>
        <nav className="nav">
          {routes.map((item) => (
            <a key={item.id} href={`#${item.id}`} className={route === item.id ? "nav-link active" : "nav-link"}>
              <span className="nav-dot" />
              <div>
                <p>{item.label}</p>
                <span>{item.meta}</span>
              </div>
            </a>
          ))}
        </nav>
        <div className="sidebar-footer">
          <div>
            <p>Latency</p>
            <strong>128ms</strong>
          </div>
          <div>
            <p>Market</p>
            <strong>Open</strong>
          </div>
        </div>
      </aside>

      <main className="content">
        <header className="topbar">
          <div>
            <p className="eyebrow">PulseForge Intelligence Suite</p>
            <h1>{activeRoute.label}</h1>
            <p className="subtitle">{activeRoute.meta}</p>
          </div>
          <div className="topbar-actions">
            <div className="status-pill">Risk: Balanced</div>
            <div className="input-group">
              <label>Symbol</label>
              <input
                value={symbol}
                onChange={(event) => setSymbol(event.target.value.toUpperCase())}
                placeholder="Symbol"
              />
            </div>
            <button onClick={runPrediction} disabled={status === "loading"}>
              {status === "loading" ? "Running..." : "Run Prediction"}
            </button>
          </div>
        </header>

        {route === "dashboard" && (
          <section className="page">
            <div className="hero-grid">
              <div className="hero-panel">
                <h2>Predict. Trade. Orchestrate market moves.</h2>
                <p>
                  Real-time signals merged with sentiment, momentum indicators, and model training workflows. Connected to
                  broker automation when you are ready.
                </p>
                <div className="hero-metrics">
                  {sampleSignals.map((item) => (
                    <div key={item.label} className="metric-chip">
                      <span>{item.label}</span>
                      <strong>{item.value}</strong>
                      <em>{item.tag}</em>
                    </div>
                  ))}
                </div>
                {prediction?.action && (
                  <div className={`signal ${prediction.action}`}>
                    <strong>{prediction.action.toUpperCase()}</strong>
                    <span>Confidence {Math.round((prediction.confidence || 0) * 100)}%</span>
                    <span>Score {prediction.score}</span>
                  </div>
                )}
                {prediction?.error && <div className="signal warn">{prediction.error}</div>}
              </div>
              <div className="hero-card">
                <div className="hero-card-header">
                  <span>Forecast Momentum</span>
                  <span className="tag">Next 7 Days</span>
                </div>
                <canvas ref={chartRef} height="180" />
                <div className="metrics">
                  <div>
                    <p>Signal Quality</p>
                    <h3>88%</h3>
                  </div>
                  <div>
                    <p>Macro Drift</p>
                    <h3>+0.4</h3>
                  </div>
                  <div>
                    <p>Event Risk</p>
                    <h3>Moderate</h3>
                  </div>
                  <div>
                    <p>Alpha Rate</p>
                    <h3>1.6x</h3>
                  </div>
                </div>
              </div>
            </div>

            <div className="card-grid">
              <div className="panel">
                <div className="panel-header">
                  <h2>News Intelligence</h2>
                  <span className="tag">Reuters / Moneycontrol</span>
                </div>
                <div className="news-list">
                  {newsData.items.map((item, index) => (
                    <article key={`${item.title}-${index}`}>
                      <div>
                        <h4>{item.title}</h4>
                        <p>{item.summary}</p>
                      </div>
                      <span>{item.source || "source"}</span>
                    </article>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2>Strategy Watchlist</h2>
                  <span className="tag">Priority</span>
                </div>
                <div className="list-grid">
                  {sampleFunds.map((fund) => (
                    <div key={fund.name} className="list-row">
                      <div>
                        <h4>{fund.name}</h4>
                        <p>{fund.tag}</p>
                      </div>
                      <strong>{fund.score}</strong>
                      <span>7D</span>
                    </div>
                  ))}
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2>Execution Queue</h2>
                  <span className="tag">Live Guard</span>
                </div>
                <div className="trade">
                  <div>
                    <p>Mode</p>
                    <h3>Manual Arm</h3>
                  </div>
                  <div>
                    <p>Order Guard</p>
                    <h3>Price Bands</h3>
                  </div>
                  <button className="secondary">Connect Broker</button>
                  <p className="note">Credentials are required to enable live orders.</p>
                </div>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2>Model Lab</h2>
                  <span className="tag">LSTM / XGBoost / Transformer</span>
                </div>
                <div className="lab">
                  <div>
                    <p>Training Status</p>
                    <h3>Queued</h3>
                  </div>
                  <div>
                    <p>Last Accuracy</p>
                    <h3>--</h3>
                  </div>
                  <button className="secondary">Start Training</button>
                  <p className="note">Training pipeline scaffolding is ready in the backend.</p>
                </div>
              </div>
            </div>
          </section>
        )}

        {route === "prediction" && (
          <section className="page">
            <div className="panel">
              <div className="panel-header">
                <h2>Multi-Model Ensemble</h2>
                <span className="tag">LSTM / XGBoost / Random Forest</span>
              </div>
              <p className="note">Run ensemble predictions with weighted voting and confidence breakdown.</p>
              <button onClick={runEnsemble}>Run Ensemble</button>
              {ensemble && (
                <div className="data-grid">
                  <div className="stat-card">
                    <p>Direction</p>
                    <strong>{ensemble.direction}</strong>
                  </div>
                  <div className="stat-card">
                    <p>Next Close</p>
                    <strong>{ensemble.next_close}</strong>
                  </div>
                  <div className="stat-card">
                    <p>Probability</p>
                    <strong>{Math.round(ensemble.probability * 100)}%</strong>
                  </div>
                </div>
              )}
              {ensemble && (
                <div className="table">
                  {ensemble.models.map((model) => (
                    <div key={model.name} className="table-row">
                      <span>{model.name}</span>
                      <strong>{model.direction}</strong>
                      <span>{model.price}</span>
                      <span>{Math.round(model.confidence * 100)}%</span>
                    </div>
                  ))}
                </div>
              )}
            </div>

            {multiFrame && (
              <div className="panel">
                <div className="panel-header">
                  <h2>Multi-Timeframe</h2>
                  <span className="tag">1h / Daily / Weekly</span>
                </div>
                <div className="data-grid">
                  {Object.keys(multiFrame).map((key) => (
                    <div key={key} className="stat-card">
                      <p>{key}</p>
                      <strong>{multiFrame[key].direction}</strong>
                      <span>{multiFrame[key].next_close}</span>
                    </div>
                  ))}
                </div>
              </div>
            )}
          </section>
        )}

        {route === "news" && (
          <section className="page">
            <div className="split-grid">
              <div className="panel">
                <div className="panel-header">
                  <h2>Sentiment Breakdown</h2>
                  <span className="tag">FinBERT</span>
                </div>
                {newsData.breakdown && (
                  <div className="data-grid">
                    <div className="stat-card">
                      <p>Positive</p>
                      <strong>{Math.round(newsData.breakdown.positive * 100)}%</strong>
                    </div>
                    <div className="stat-card">
                      <p>Negative</p>
                      <strong>{Math.round(newsData.breakdown.negative * 100)}%</strong>
                    </div>
                    <div className="stat-card">
                      <p>Neutral</p>
                      <strong>{Math.round(newsData.breakdown.neutral * 100)}%</strong>
                    </div>
                  </div>
                )}
                <div className="panel-sub">
                  <p>Model</p>
                  <strong>{newsData.breakdown?.model || "Mock"}</strong>
                  <span>Sentiment overlay is computed from live headlines.</span>
                </div>
              </div>
              <div className="panel">
                <div className="panel-header">
                  <h2>Source Health</h2>
                  <span className="tag">Streaming</span>
                </div>
                <div className="status-grid">
                  {newsData.sources.map((feed) => (
                    <div key={feed.name} className="status-card">
                      <p>{feed.name}</p>
                      <strong>{feed.status}</strong>
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>Headlines</h2>
                <span className="tag">Realtime</span>
              </div>
              <div className="news-list">
                {newsData.items.map((item, index) => (
                  <article key={`${item.title}-${index}`}>
                    <div>
                      <h4>{item.title}</h4>
                      <p>{item.summary}</p>
                    </div>
                    <span>{item.source || "source"}</span>
                  </article>
                ))}
              </div>
            </div>
          </section>
        )}

        {route === "indicators" && (
          <section className="page">
            <div className="panel">
              <div className="panel-header">
                <h2>Indicator Controls</h2>
                <span className="tag">Interactive</span>
              </div>
              <div className="pill-grid">
                {indicatorCatalog.map((item) => (
                  <div key={item.id} className="pill">{item.label}</div>
                ))}
              </div>
              <div className="form-grid">
                {Object.keys(indicatorSettings).map((key) => (
                  <label key={key} className="field">
                    <span>{key.replace("_", " ")}</span>
                    <input
                      value={indicatorSettings[key]}
                      onChange={(event) =>
                        setIndicatorSettings((prev) => ({ ...prev, [key]: event.target.value }))
                      }
                    />
                  </label>
                ))}
              </div>
              <button onClick={fetchIndicators}>Generate Indicators</button>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>Latest Indicator Snapshot</h2>
                <span className="tag">Output</span>
              </div>
              {indicatorRows.length > 0 ? (
                <div className="data-grid">
                  {[
                    "rsi",
                    "macd_hist",
                    "sma_fast",
                    "sma_slow",
                    "ema_fast",
                    "ema_slow",
                    "bb_upper",
                    "bb_lower",
                    "vwap",
                    "fib_382",
                    "fib_618"
                  ].map((field) => (
                    <div key={field} className="stat-card">
                      <p>{field}</p>
                      <strong>{Number(indicatorRows[indicatorRows.length - 1][field]).toFixed(2)}</strong>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="note">Run the indicator engine to populate the latest values.</p>
              )}
            </div>
          </section>
        )}

        {route === "portfolio" && (
          <section className="page">
            <div className="panel">
              <div className="panel-header">
                <h2>Virtual Portfolio</h2>
                <span className="tag">INR 100000</span>
              </div>
              <p className="note">Simulate trades and view profit, drawdown, and risk score.</p>
              <button onClick={runPortfolioSim}>Run Simulation</button>
              {portfolioResult && (
                <div className="data-grid">
                  <div className="stat-card">
                    <p>PnL</p>
                    <strong>{portfolioResult.pnl}</strong>
                  </div>
                  <div className="stat-card">
                    <p>Sharpe</p>
                    <strong>{portfolioResult.sharpe}</strong>
                  </div>
                  <div className="stat-card">
                    <p>Drawdown</p>
                    <strong>{portfolioResult.max_drawdown}</strong>
                  </div>
                  <div className="stat-card">
                    <p>Risk Score</p>
                    <strong>{portfolioResult.risk_score}</strong>
                  </div>
                </div>
              )}
            </div>
          </section>
        )}

        {route === "backtest" && (
          <section className="page">
            <div className="panel">
              <div className="panel-header">
                <h2>Backtesting Engine</h2>
                <span className="tag">Strategy replay</span>
              </div>
              <button onClick={runBacktest}>Run Backtest</button>
              {backtestResult && (
                <div className="data-grid">
                  <div className="stat-card">
                    <p>Total Return</p>
                    <strong>{Math.round(backtestResult.total_return * 100)}%</strong>
                  </div>
                  <div className="stat-card">
                    <p>Win Rate</p>
                    <strong>{Math.round(backtestResult.win_rate * 100)}%</strong>
                  </div>
                  <div className="stat-card">
                    <p>Max Drawdown</p>
                    <strong>{Math.round(backtestResult.max_drawdown * 100)}%</strong>
                  </div>
                </div>
              )}
              {backtestResult && (
                <div className="table">
                  {backtestResult.trades.map((trade) => (
                    <div key={trade.id} className="table-row">
                      <span>{trade.side}</span>
                      <span>{trade.entry}</span>
                      <span>{trade.exit}</span>
                      <strong>{trade.pnl}</strong>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {route === "strategy" && (
          <section className="page">
            <div className="panel">
              <div className="panel-header">
                <h2>Strategy Builder</h2>
                <span className="tag">No-code rules</span>
              </div>
              <label className="field">
                <span>Rule Definition</span>
                <textarea value={strategyRule} onChange={(event) => setStrategyRule(event.target.value)} />
              </label>
              <div className="button-row">
                <button onClick={parseStrategy}>Parse Rule</button>
                <button className="secondary" onClick={evaluateStrategy}>
                  Evaluate
                </button>
              </div>
              {strategyParse && (
                <div className="panel-sub">
                  <p>Status</p>
                  <strong>{strategyParse.valid ? "Valid" : "Invalid"}</strong>
                  <span>{strategyParse.message}</span>
                </div>
              )}
              {strategyEval && (
                <div className="signal">
                  <strong>{strategyEval.action.toUpperCase()}</strong>
                  <span>Confidence {Math.round(strategyEval.confidence * 100)}%</span>
                  <span>{strategyEval.explanation}</span>
                </div>
              )}
            </div>
          </section>
        )}

        {route === "live" && (
          <section className="page">
            <div className="panel">
              <div className="panel-header">
                <h2>Live Market Mode</h2>
                <span className="tag">Polling snapshot</span>
              </div>
              {liveSnapshot ? (
                <div className="data-grid">
                  <div className="stat-card">
                    <p>Price</p>
                    <strong>{liveSnapshot.price}</strong>
                  </div>
                  <div className="stat-card">
                    <p>Change</p>
                    <strong>{liveSnapshot.change}</strong>
                  </div>
                  <div className="stat-card">
                    <p>Market</p>
                    <strong>{liveSnapshot.market_state}</strong>
                  </div>
                </div>
              ) : (
                <p className="note">Waiting for live snapshot...</p>
              )}
            </div>
          </section>
        )}

        {route === "risk" && (
          <section className="page">
            <div className="panel">
              <div className="panel-header">
                <h2>Risk & Volatility</h2>
                <span className="tag">VaR + Beta</span>
              </div>
              {riskData && (
                <div className="data-grid">
                  <div className="stat-card">
                    <p>Beta</p>
                    <strong>{riskData.beta}</strong>
                  </div>
                  <div className="stat-card">
                    <p>Volatility</p>
                    <strong>{Math.round(riskData.volatility * 100)}%</strong>
                  </div>
                  <div className="stat-card">
                    <p>VaR</p>
                    <strong>{Math.round(riskData.var * 100)}%</strong>
                  </div>
                </div>
              )}
              {riskData && (
                <div className="table">
                  {riskData.correlations.map((item) => (
                    <div key={item.sector} className="table-row">
                      <span>{item.sector}</span>
                      <strong>{item.corr}</strong>
                      <span>Correlation</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {route === "accounts" && (
          <section className="page">
            <div className="split-grid">
              <div className="panel">
                <div className="panel-header">
                  <h2>User Access</h2>
                  <span className="tag">Login</span>
                </div>
                <label className="field">
                  <span>Email</span>
                  <input value={authEmail} onChange={(event) => setAuthEmail(event.target.value)} />
                </label>
                <label className="field">
                  <span>Password</span>
                  <input type="password" value={authPassword} onChange={(event) => setAuthPassword(event.target.value)} />
                </label>
                <div className="button-row">
                  <button onClick={loginAccount}>Login</button>
                  <button
                    className="secondary"
                    onClick={async () => {
                      await registerAccount();
                      await loginAccount();
                    }}
                  >
                    Register + Login
                  </button>
                  {authToken && (
                    <button className="secondary" onClick={logoutAccount}>
                      Logout
                    </button>
                  )}
                </div>
                <p className="note">Token auth is stored locally for demo purposes.</p>
              </div>

              <div className="panel">
                <div className="panel-header">
                  <h2>Watchlist</h2>
                  <span className="tag">Personal</span>
                </div>
                <button className="secondary" onClick={addToWatchlist} disabled={!authToken}>
                  Add Current Symbol
                </button>
                <div className="pill-grid">
                  {watchlist.map((item) => (
                    <div key={item} className="pill">
                      {item}
                    </div>
                  ))}
                </div>
              </div>
            </div>

            <div className="panel">
              <div className="panel-header">
                <h2>Prediction History</h2>
                <span className="tag">Per User</span>
              </div>
              {history.length > 0 ? (
                <div className="table">
                  {history.map((entry, index) => (
                    <div key={`${entry.symbol}-${index}`} className="table-row">
                      <span>{entry.symbol}</span>
                      <strong>{entry.action}</strong>
                      <span>{entry.score}</span>
                      <span>{entry.created_at}</span>
                    </div>
                  ))}
                </div>
              ) : (
                <p className="note">No predictions yet. Run the model to populate history.</p>
              )}
            </div>
          </section>
        )}

        {route === "explain" && (
          <section className="page">
            <div className="panel">
              <div className="panel-header">
                <h2>Explainability</h2>
                <span className="tag">SHAP-style</span>
              </div>
              {explainData && (
                <div className="table">
                  {explainData.contributions.map((item) => (
                    <div key={item.feature} className="table-row">
                      <span>{item.feature}</span>
                      <strong>{item.impact}</strong>
                      <span>Impact</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {route === "institutional" && (
          <section className="page">
            <div className="panel">
              <div className="panel-header">
                <h2>Institutional Data Layer</h2>
                <span className="tag">FII / DII</span>
              </div>
              {institutionalData && (
                <div className="data-grid">
                  <div className="stat-card">
                    <p>FII Flow</p>
                    <strong>{institutionalData.fii_flow}</strong>
                  </div>
                  <div className="stat-card">
                    <p>DII Flow</p>
                    <strong>{institutionalData.dii_flow}</strong>
                  </div>
                  <div className="stat-card">
                    <p>Insider</p>
                    <strong>{institutionalData.insider_activity}</strong>
                  </div>
                  <div className="stat-card">
                    <p>Earnings</p>
                    <strong>{institutionalData.earnings_impact}</strong>
                  </div>
                </div>
              )}
              {institutionalData && (
                <div className="table">
                  {institutionalData.block_deals.map((deal, index) => (
                    <div key={`${deal.party}-${index}`} className="table-row">
                      <span>{deal.party}</span>
                      <strong>{deal.volume}</strong>
                      <span>Shares</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {route === "macro" && (
          <section className="page">
            <div className="panel">
              <div className="panel-header">
                <h2>Macro Impact</h2>
                <span className="tag">Rates + CPI</span>
              </div>
              {macroData && (
                <div className="data-grid">
                  <div className="stat-card">
                    <p>Interest Rate</p>
                    <strong>{macroData.interest_rate}%</strong>
                  </div>
                  <div className="stat-card">
                    <p>Inflation</p>
                    <strong>{macroData.inflation}%</strong>
                  </div>
                  <div className="stat-card">
                    <p>Event</p>
                    <strong>{macroData.policy_event}</strong>
                  </div>
                </div>
              )}
              {macroData && (
                <div className="table">
                  {macroData.next_events.map((event) => (
                    <div key={event.title} className="table-row">
                      <span>{event.title}</span>
                      <strong>{event.eta_days} days</strong>
                      <span>ETA</span>
                    </div>
                  ))}
                </div>
              )}
            </div>
          </section>
        )}

        {route === "assistant" && (
          <section className="page">
            <div className="panel">
              <div className="panel-header">
                <h2>AI Market Assistant</h2>
                <span className="tag">Q&A</span>
              </div>
              <label className="field">
                <span>Question</span>
                <textarea value={assistantQuestion} onChange={(event) => setAssistantQuestion(event.target.value)} />
              </label>
              <button onClick={askAssistant}>Ask</button>
              {assistantReply && (
                <div className="panel-sub">
                  <p>Response</p>
                  <strong>{assistantReply.reply}</strong>
                </div>
              )}
            </div>
          </section>
        )}

        <footer className="page-footer">
          <p>Data sources, model performance, and automation controls must be validated before real trading.</p>
        </footer>
      </main>
    </div>
  );
}
