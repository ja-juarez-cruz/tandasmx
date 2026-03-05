import os, json, boto3, logging
from boto3.dynamodb.conditions import Key

logger   = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource("dynamodb")

LEADERBOARD_TABLE = os.environ["LEADERBOARD_TABLE"]
CORS = {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}

def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode":200,"headers":CORS,"body":""}

    params = event.get("queryStringParameters") or {}
    limit  = min(int(params.get("limit", 20)), 50)
    level  = params.get("level")   # filtro opcional: nuevo|confiable|destacado|elite

    resp  = dynamodb.Table(LEADERBOARD_TABLE).query(
        KeyConditionExpression=Key("partitionKey").eq("GLOBAL"),
        ScanIndexForward=False,  # mayor score primero
        Limit=limit * 3          # buffer para filtro por nivel
    )
    items = resp.get("Items", [])
    if level:
        items = [i for i in items if i.get("scoreLevel") == level]
    items = items[:limit]

    leaderboard = [
        {"rank": i+1, "userId": item["userId"],
         "scoreGlobal": int(item.get("scoreGlobal", 0)),
         "scoreLevel": item.get("scoreLevel", "nuevo"),
         "updatedAt": item.get("updatedAt")}
        for i, item in enumerate(items)
    ]

    return {"statusCode":200,"headers":CORS,"body":json.dumps({
        "leaderboard": leaderboard,
        "total": len(leaderboard),
        "filterLevel": level,
    })}