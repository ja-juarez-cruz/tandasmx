import os, json, boto3, logging
from boto3.dynamodb.conditions import Key

logger   = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource("dynamodb")

USERS_TABLE        = os.environ["USERS_TABLE"]
SCORE_EVENTS_TABLE = os.environ["SCORE_EVENTS_TABLE"]

CORS = {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}
LEVELS = ["nuevo","confiable","destacado","elite"]
LEVEL_META = {
    "nuevo":     {"label":"Nuevo",     "emoji":"bronze",  "minScore":0,  "maxScore":30},
    "confiable": {"label":"Confiable", "emoji":"silver",  "minScore":31, "maxScore":60},
    "destacado": {"label":"Destacado", "emoji":"gold",    "minScore":61, "maxScore":80},
    "elite":     {"label":"Elite",     "emoji":"diamond", "minScore":81, "maxScore":100},
}

def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode":200,"headers":CORS,"body":""}

    user_id = (event.get("pathParameters") or {}).get("userId")
    if not user_id:
        return err(400, "userId requerido")

    user = dynamodb.Table(USERS_TABLE).get_item(Key={"userId":user_id}).get("Item")
    if not user:
        return err(404, "Usuario no encontrado")

    score = int(user.get("scoreGlobal", 20))
    level = user.get("scoreLevel", "nuevo")

    events_resp = dynamodb.Table(SCORE_EVENTS_TABLE).query(
        KeyConditionExpression=Key("userId").eq(user_id),
        ScanIndexForward=False, Limit=50
    )
    recent = [
        {"eventId":e["eventId"],"eventType":e["eventType"],"points":int(e.get("points",0)),
         "tandaId":e.get("tandaId"),"createdAt":e.get("createdAt")}
        for e in events_resp.get("Items", [])
    ]

    # Proximo nivel
    next_level = None
    idx = LEVELS.index(level) if level in LEVELS else 0
    if idx < len(LEVELS)-1:
        nxt = LEVELS[idx+1]
        next_level = {**LEVEL_META[nxt], "level":nxt,
                      "pointsLeft": max(0, LEVEL_META[nxt]["minScore"] - score)}

    return {"statusCode":200,"headers":CORS,"body":json.dumps({
        "userId": user_id,
        "scoreGlobal": score,
        "scoreLevel":  level,
        "levelInfo":   LEVEL_META.get(level, LEVEL_META["nuevo"]),
        "nextLevel":   next_level,
        "access": {
            "canJoinPublicTanda":   score >= 40,
            "canBeAdmin":           score >= 60,
            "canCreatePublicTanda": score >= 81,
            "isRestricted":         score < 25,
            "canJoinLargeTanda":    score >= 61,
        },
        "recentEvents": recent,
        "updatedAt": user.get("scoreUpdatedAt"),
    })}

def err(s, m):
    return {"statusCode":s,"headers":CORS,"body":json.dumps({"error":m})}