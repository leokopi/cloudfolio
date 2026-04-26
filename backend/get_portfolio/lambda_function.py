import json
import boto3
import os
from decimal import Decimal
from boto3.dynamodb.conditions import Attr

dynamodb = boto3.resource("dynamodb")
table = dynamodb.Table(os.environ["HOLDINGS_TABLE"])


def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError


def lambda_handler(event, context):
    user_id = event["requestContext"]["authorizer"]["claims"]["sub"]

    result = table.scan(FilterExpression=Attr("user_id").eq(user_id))
    holdings = result.get("Items", [])

    return {
        "statusCode": 200,
        "headers": {"Access-Control-Allow-Origin": "*"},
        "body": json.dumps({"holdings": holdings}, default=decimal_default),
    }
