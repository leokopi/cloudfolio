import json
import boto3
import os

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["HOLDINGS_TABLE"])


def lambda_handler(event, context):
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]
    holding_id = (event.get("pathParameters") or {}).get("id")

    if not holding_id:
        return {
            "statusCode": 400,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Missing holding id"}),
        }

    existing = table.get_item(Key={"id": holding_id}).get("Item")
    if not existing or existing.get("user_id") != user_id:
        return {
            "statusCode": 404,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Not found"}),
        }

    table.delete_item(Key={"id": holding_id})

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"deleted": holding_id}),
    }
