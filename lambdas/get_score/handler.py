import os, json, boto3, logging
from boto3.dynamodb.conditions import Key

logger   = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource("dynamodb")

USUARIOS_TABLE      = os.environ["USUARIOS_TABLE"]
PARTICIPANTES_TABLE = os.environ["PARTICIPANTES_TABLE"]
SCORE_EVENTS_TABLE  = os.environ["SCORE_EVENTS_TABLE"]

LEVELS = ["nuevo","confiable","destacado","elite"]
LEVEL_META = {
    "nuevo":     {"label":"Nuevo",     "badge":"bronze",  "minScore":0,  "maxScore":30},
    "confiable": {"label":"Confiable", "badge":"silver",  "minScore":31, "maxScore":60},
    "destacado": {"label":"Destacado", "badge":"gold",    "minScore":61, "maxScore":80},
    "elite":     {"label":"Elite",     "badge":"diamond", "minScore":81, "maxScore":100},
}

def handler(event, _context):
    user_id = (event.get("pathParameters") or {}).get("userId")
    if not user_id:
        return err(400, "userId requerido")

    params     = event.get("queryStringParameters") or {}
    actor_type = params.get("actorType", "admin")
    tanda_id   = params.get("tandaId")

    if actor_type not in ("admin", "participante"):
        return err(400, "actorType debe ser 'admin' o 'participante'")
    if actor_type == "participante" and not tanda_id:
        return err(400, "tandaId requerido cuando actorType es 'participante'")

    if actor_type == "participante":
        subject = dynamodb.Table(PARTICIPANTES_TABLE).get_item(
            Key={"id": tanda_id, "participanteId": user_id}
        ).get("Item")
    else:
        subject = dynamodb.Table(USUARIOS_TABLE).get_item(
            Key={"id": user_id}
        ).get("Item")

    if not subject:
        return err(404, "Usuario no encontrado")

    score = int(subject.get("scoreGlobal", 20))
    level = subject.get("scoreLevel", "nuevo")

    events_resp = dynamodb.Table(SCORE_EVENTS_TABLE).query(
        KeyConditionExpression=Key("actorId").eq(user_id),
        ScanIndexForward=False,
        Limit=50,
    )
    recent = [
        {
            "eventId":   e["eventId"],
            "eventType": e["eventType"],
            "actorType": e.get("actorType", "admin"),
            "points":    int(e.get("points", 0)),
            "tandaId":   e.get("tandaId"),
            "createdAt": e.get("createdAt"),
        }
        for e in events_resp.get("Items", [])
    ]

    next_level = None
    idx = LEVELS.index(level) if level in LEVELS else 0
    if idx < len(LEVELS) - 1:
        nxt = LEVELS[idx + 1]
        next_level = {
            **LEVEL_META[nxt],
            "level":      nxt,
            "pointsLeft": max(0, LEVEL_META[nxt]["minScore"] - score),
        }

    return {"statusCode":200,"body":json.dumps({
        "userId":      user_id,
        "actorType":   actor_type,
        "nombre":      subject.get("nombre", ""),
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
        "updatedAt":   subject.get("scoreUpdatedAt"),
    })}

def err(s, m):
    return {"statusCode":s,"body":json.dumps({"error":m})}
