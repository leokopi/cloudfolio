import json
import os
import uuid
import boto3

TABLE = os.environ["WATCHLIST_TABLE"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE)

HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
}


def resp(body, status=200):
    return {"statusCode": status, "headers": HEADERS, "body": json.dumps(body)}


def lambda_handler(event, context):
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    body = json.loads(event.get("body") or "{}")
    ticker = str(body.get("ticker", "")).upper().strip()

    if not ticker:
        return resp({"error": "ticker is required"}, 400)

    item_id = str(uuid.uuid4())
    table.put_item(Item={"id": item_id, "user_id": user_id, "ticker": ticker})
    return resp({"id": item_id, "ticker": ticker}, 201)
