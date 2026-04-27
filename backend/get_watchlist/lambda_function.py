import json
import os
import time
import urllib.request
import boto3
from boto3.dynamodb.conditions import Attr

TABLE = os.environ["WATCHLIST_TABLE"]
POLYGON_API_KEY = os.environ["POLYGON_API_KEY"]

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE)

_price_cache = {}
CACHE_TTL = 300

HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
}


def fetch_price(ticker):
    cached = _price_cache.get(ticker)
    if cached and (time.time() - cached["ts"]) < CACHE_TTL:
        return cached["price"], cached["change_pct"]

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
    price = r["c"]
    change_pct = round(((r["c"] - r["o"]) / r["o"]) * 100, 2) if r["o"] else 0

    _price_cache[ticker] = {"price": price, "change_pct": change_pct, "ts": time.time()}
    return price, change_pct


def lambda_handler(event, context):
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]

    resp = table.scan(FilterExpression=Attr("user_id").eq(user_id))
    items = resp.get("Items", [])

    result = []
    for item in items:
        ticker = item["ticker"]
        try:
            price, change_pct = fetch_price(ticker)
            result.append({
                "id": item["id"],
                "ticker": ticker,
                "price": price,
                "change_pct": change_pct,
            })
        except Exception as e:
            print(f"Price fetch failed for {ticker}: {e}")
            result.append({
                "id": item["id"],
                "ticker": ticker,
                "price": None,
                "change_pct": None,
            })

    return {
        "statusCode": 200,
        "headers": HEADERS,
        "body": json.dumps({"items": result}),
    }
