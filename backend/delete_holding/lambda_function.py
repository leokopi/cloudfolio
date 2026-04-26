import json
import boto3
import os

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["HOLDINGS_TABLE"])


def lambda_handler(event, context):
    holding_id = (event.get("pathParameters") or {}).get("id")

    if not holding_id:
        return {
            "statusCode": 400,
            "headers": {"Access-Control-Allow-Origin": "*"},
            "body": json.dumps({"error": "Missing holding id"}),
        }

    table.delete_item(Key={"id": holding_id})

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"deleted": holding_id}),
    }
