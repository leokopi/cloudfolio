import json
import boto3
import os
import urllib.request
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["HOLDINGS_TABLE"])

POLYGON_API_KEY = os.environ["POLYGON_API_KEY"]


def fetch_price(ticker):
    url = (
        f"https://api.polygon.io/v2/snapshot/locale/us/markets/stocks/tickers"
        f"/{ticker}?apiKey={POLYGON_API_KEY}"
    )
    with urllib.request.urlopen(url, timeout=5) as resp:
        data = json.loads(resp.read())
    t = data["ticker"]
    return t["day"]["c"] or t["prevDay"]["c"]


def lambda_handler(event, context):
    result = table.scan()
    holdings = result.get("Items", [])

    updated = []
    for h in holdings:
        try:
            price = fetch_price(h["ticker"])
            table.update_item(
                Key={"id": h["id"]},
                UpdateExpression="SET current_price = :p",
                ExpressionAttributeValues={":p": Decimal(str(price))},
            )
            updated.append(h["ticker"])
        except Exception as e:
            print(f"Failed to update {h['ticker']}: {e}")

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"updated": updated}),
    }
