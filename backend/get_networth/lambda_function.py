import json
import os
import boto3
from boto3.dynamodb.conditions import Attr

TABLE = os.environ["NETWORTH_TABLE"]
dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(TABLE)

HEADERS = {
    "Access-Control-Allow-Origin": "*",
    "Content-Type": "application/json",
}


def lambda_handler(event, context):
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    resp = table.scan(FilterExpression=Attr("user_id").eq(user_id))
    items = resp.get("Items", [])
    for item in items:
        item["value"] = float(item["value"])
    return {
        "statusCode": 200,
        "headers": HEADERS,
        "body": json.dumps({"items": items}),
    }
