import json
import boto3
import os
import uuid
from decimal import Decimal

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["HOLDINGS_TABLE"])


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

    item = {
        "id": str(uuid.uuid4()),
        "ticker": ticker,
        "shares": Decimal(str(shares)),
        "avg_cost": Decimal(str(avg_cost)),
    }
    table.put_item(Item=item)

    return {
        "statusCode": 201,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"id": item["id"]}),
    }
