from services.utils import seeded_random, iso_now


def macro_snapshot(region="IN"):
    rng = seeded_random(region, "macro")
    return {
        "region": region,
        "interest_rate": round(rng.uniform(5.25, 7.5), 2),
        "inflation": round(rng.uniform(3.1, 6.2), 2),
        "policy_event": rng.choice(["RBI Statement", "Fed Minutes", "Budget Review"]),
        "impact": rng.choice(["Low", "Moderate", "High"]),
        "next_events": [
            {"title": "Policy Meeting", "eta_days": rng.randint(2, 14)},
            {"title": "CPI Release", "eta_days": rng.randint(5, 18)},
        ],
        "created_at": iso_now(),
    }
