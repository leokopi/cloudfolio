import json
import os
import boto3

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
    item_id = event["pathParameters"]["id"]

    existing = table.get_item(Key={"id": item_id}).get("Item")
    if not existing or existing.get("user_id") != user_id:
        return resp({"error": "Not found"}, 404)

    table.delete_item(Key={"id": item_id})
    return resp({"deleted": item_id})
