import json
import urllib.request
import os

POLYGON_API_KEY = os.environ["POLYGON_API_KEY"]

STOCK_TICKERS = {"SPY": "S&P 500", "QQQ": "Nasdaq", "USO": "Crude Oil"}


def fetch_stocks():
    symbols = ",".join(STOCK_TICKERS.keys())
    url = (
        f"https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers"
        f"?tickers={symbols}&apiKey={POLYGON_API_KEY}"
    )
    with urllib.request.urlopen(url, timeout=5) as resp:
        data = json.loads(resp.read())
    return data.get("tickers", [])


def fetch_btc():
    url = (
        f"https://api.polygon.io/v2/snapshot/locale/global/markets/crypto"
        f"/tickers/X:BTCUSD?apiKey={POLYGON_API_KEY}"
    )
    with urllib.request.urlopen(url, timeout=5) as resp:
        data = json.loads(resp.read())
    return data.get("ticker", {})


def lambda_handler(event, context):
    markets = []

    try:
        for s in fetch_stocks():
            ticker = s.get("ticker", "")
            day = s.get("day", {})
            prev = s.get("prevDay", {})
            markets.append({
                "ticker": ticker,
                "name": STOCK_TICKERS.get(ticker, ticker),
                "price": day.get("c") or prev.get("c") or 0,
                "change_pct": round(s.get("todaysChangePerc", 0), 2),
            })
    except Exception as e:
        print(f"Stock error: {e}")

    try:
        btc = fetch_btc()
        day = btc.get("day", {})
        prev = btc.get("prevDay", {})
        markets.append({
            "ticker": "BTC",
            "name": "Bitcoin",
            "price": day.get("c") or prev.get("c") or 0,
            "change_pct": round(btc.get("todaysChangePerc", 0), 2),
        })
    except Exception as e:
        print(f"BTC error: {e}")

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"markets": markets}),
    }
