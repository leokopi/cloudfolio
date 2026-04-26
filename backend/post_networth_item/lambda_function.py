import json
import os
import uuid
import boto3
from decimal import Decimal

TABLE = os.environ["NETWORTH_TABLE"]
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
    name = str(body.get("name", "")).strip()
    item_type = body.get("type", "")
    value = body.get("value")

    if not name or item_type not in ("asset", "liability") or value is None:
        return resp({"error": "name, type (asset/liability), and value are required"}, 400)

    item_id = str(uuid.uuid4())
    table.put_item(Item={
        "id": item_id,
        "user_id": user_id,
        "name": name,
        "type": item_type,
        "value": Decimal(str(value)),
    })
    return resp({"id": item_id, "name": name, "type": item_type, "value": float(value)}, 201)
