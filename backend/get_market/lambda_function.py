import json
import urllib.request
import os

POLYGON_API_KEY = os.environ["POLYGON_API_KEY"]

TICKERS = {
    "SPY":    "S&P 500",
    "QQQ":    "Nasdaq",
    "USO":    "Crude Oil",
    "X:BTCUSD": "Bitcoin",
}


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
    close = r["c"]
    open_ = r["o"]
    change_pct = round(((close - open_) / open_) * 100, 2) if open_ else 0
    return close, change_pct


def lambda_handler(event, context):
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

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"markets": markets}),
    }
