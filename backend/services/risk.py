from services.utils import seeded_random, iso_now


def risk_overview(symbol):
    rng = seeded_random(symbol, "risk")
    correlations = [
        {"sector": "Tech", "corr": round(rng.uniform(0.4, 0.85), 2)},
        {"sector": "Finance", "corr": round(rng.uniform(0.2, 0.6), 2)},
        {"sector": "Energy", "corr": round(rng.uniform(0.1, 0.5), 2)},
        {"sector": "FMCG", "corr": round(rng.uniform(0.15, 0.55), 2)},
    ]
    sector_comp = [
        {"sector": "Tech", "volatility": round(rng.uniform(0.18, 0.32), 3)},
        {"sector": "Finance", "volatility": round(rng.uniform(0.12, 0.26), 3)},
        {"sector": "Energy", "volatility": round(rng.uniform(0.2, 0.38), 3)},
        {"sector": "FMCG", "volatility": round(rng.uniform(0.08, 0.18), 3)},
    ]
    return {
        "symbol": symbol,
        "beta": round(rng.uniform(0.7, 1.4), 2),
        "volatility": round(rng.uniform(0.18, 0.35), 3),
        "var": round(rng.uniform(0.02, 0.08), 3),
        "correlations": correlations,
        "sector_comparison": sector_comp,
        "created_at": iso_now(),
    }
