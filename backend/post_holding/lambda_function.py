import json
import boto3
import os
import uuid
import urllib.request
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["HOLDINGS_TABLE"])

POLYGON_API_KEY = os.environ["POLYGON_API_KEY"]


def fetch_price(ticker):
    url = (
        f"https://api.polygon.io/v2/aggs/ticker/{ticker}/prev"
        f"?adjusted=true&apiKey={POLYGON_API_KEY}"
    )
    with urllib.request.urlopen(url, timeout=5) as resp:
        data = json.loads(resp.read())
    results = data.get("results", [])
    if not results:
        raise ValueError(f"No price data for {ticker}")
    return results[0]["c"]


def lambda_handler(event, context):
    body = json.loads(event.get("body", "{}"))
    ticker = body.get("ticker", "").upper().strip()
    shares = body.get("shares")
    avg_cost = body.get("avg_cost")

    if not ticker or shares is None or avg_cost is None:
        return {
            "statusCode": 400,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "ticker, shares, and avg_cost are required"}),
        }

    try:
        current_price = fetch_price(ticker)
    except Exception as e:
        print(f"Price fetch failed for {ticker}: {e}")
        current_price = None

    item = {
        "id": str(uuid.uuid4()),
        "ticker": ticker,
        "shares": Decimal(str(shares)),
        "avg_cost": Decimal(str(avg_cost)),
    }
    if current_price is not None:
        item["current_price"] = Decimal(str(current_price))

    table.put_item(Item=item)

    return {
        "statusCode": 201,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"id": item["id"]}),
    }
