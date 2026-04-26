import json
import urllib.request
import os
import time

POLYGON_API_KEY = os.environ["POLYGON_API_KEY"]

TICKERS = {
    "SPY":      "SPY - SP500",
    "QQQ":      "QQQ - Nasdaq",
    "USO":      "Crude Oil",
    "X:BTCUSD": "Bitcoin",
}

# Module-level cache — persists across warm Lambda invocations
_cache = None
_cache_ts = 0
CACHE_TTL = 300  # seconds


def fetch_prev(ticker):
    url = (
        f"https://api.polygon.io/v2/aggs/ticker/{ticker}/prev"
        f"?adjusted=true&apiKey={POLYGON_API_KEY}"
    )
    with urllib.request.urlopen(url, timeout=5) as resp:
        data = json.loads(resp.read())
    results = data.get("results", [])
    if not results:
        raise ValueError(f"No data for {ticker}")
    r = results[0]
    change_pct = round(((r["c"] - r["o"]) / r["o"]) * 100, 2) if r["o"] else 0
    return r["c"], change_pct


def lambda_handler(event, context):
    global _cache, _cache_ts

    if _cache and (time.time() - _cache_ts) < CACHE_TTL:
        return {
            "statusCode": 200,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"markets": _cache}),
        }

    markets = []
    for ticker, name in TICKERS.items():
        try:
            price, change_pct = fetch_prev(ticker)
            display = "BTC" if ticker == "X:BTCUSD" else ticker
            markets.append({
                "ticker":     display,
                "name":       name,
                "price":      price,
                "change_pct": change_pct,
            })
        except Exception as e:
            print(f"Error fetching {ticker}: {e}")

    if len(markets) == len(TICKERS):
        _cache = markets
        _cache_ts = time.time()

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"markets": markets}),
    }
