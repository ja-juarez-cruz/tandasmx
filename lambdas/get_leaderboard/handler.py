import os, json, boto3, logging
from boto3.dynamodb.conditions import Key

logger   = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource("dynamodb")

LEADERBOARD_TABLE = os.environ["LEADERBOARD_TABLE"]

def handler(event, _context):
    params     = event.get("queryStringParameters") or {}
    limit      = min(int(params.get("limit", 20)), 50)
    level      = params.get("level")
    actor_type = params.get("actorType")

    resp  = dynamodb.Table(LEADERBOARD_TABLE).query(
        KeyConditionExpression=Key("partitionKey").eq("GLOBAL"),
        ScanIndexForward=False,
        Limit=limit * 5,
    )
    items = resp.get("Items", [])

    if level:
        items = [i for i in items if i.get("scoreLevel") == level]
    if actor_type:
        items = [i for i in items if i.get("actorType", "admin") == actor_type]

    items = items[:limit]

    leaderboard = [
        {
            "rank":        i + 1,
            "userId":      item["userId"],
            "actorType":   item.get("actorType", "admin"),
            "scoreGlobal": int(item.get("scoreGlobal", 0)),
            "scoreLevel":  item.get("scoreLevel", "nuevo"),
            "updatedAt":   item.get("updatedAt"),
        }
        for i, item in enumerate(items)
    ]

    return {"statusCode":200,"body":json.dumps({
        "leaderboard":     leaderboard,
        "total":           len(leaderboard),
        "filterLevel":     level,
        "filterActorType": actor_type,
    })}
