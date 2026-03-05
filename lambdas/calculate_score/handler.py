import os, json, boto3, logging
from decimal import Decimal
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key

logger = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource("dynamodb")

SCORE_EVENTS_TABLE = os.environ["SCORE_EVENTS_TABLE"]
USERS_TABLE        = os.environ["USERS_TABLE"]
LEADERBOARD_TABLE  = os.environ["LEADERBOARD_TABLE"]
SNAPSHOTS_TABLE    = os.environ["SCORE_SNAPSHOTS_TABLE"]
BASE_SCORE         = int(os.environ.get("BASE_SCORE", "20"))

SCORE_LEVELS = [(81,100,"elite"),(61,80,"destacado"),(31,60,"confiable"),(0,30,"nuevo")]

CATEGORY_MAP = {
    "PAYMENT_EARLY":"pagos","PAYMENT_ON_TIME":"pagos","PAYMENT_LATE":"pagos","PAYMENT_MISSED":"pagos",
    "TANDA_COMPLETED_PERFECT":"historial","TANDA_COMPLETED":"historial","TANDA_ABANDONED":"historial",
    "ADMIN_TANDA":"administracion","ADMIN_TANDA_COMPLETED":"administracion",
    "PROFILE_PHONE_VERIFIED":"perfil","PROFILE_PHOTO":"perfil","PROFILE_FULL_NAME":"perfil",
    "PROFILE_PAYMENT_METHOD":"perfil","ACCOUNT_SENIORITY_6M":"perfil","ACCOUNT_SENIORITY_1Y":"perfil",
    "REFERRAL_COMPLETED":"comunidad","MULTI_TANDA_NO_DELAY":"comunidad","NO_TANDA_ABANDONMENT":"comunidad",
    "INACTIVITY_DECAY":"penalizaciones",
}

def get_level(score):
    for lo, hi, lv in SCORE_LEVELS:
        if lo <= score <= hi:
            return lv
    return "nuevo"

def handler(event, context):
    user_id = event.get("userId")
    if not user_id:
        return {"statusCode": 400, "body": json.dumps({"error": "userId requerido"})}

    ev_table   = dynamodb.Table(SCORE_EVENTS_TABLE)
    usr_table  = dynamodb.Table(USERS_TABLE)
    lb_table   = dynamodb.Table(LEADERBOARD_TABLE)
    snap_table = dynamodb.Table(SNAPSHOTS_TABLE)

    # 1. Traer todos los eventos del usuario
    resp   = ev_table.query(KeyConditionExpression=Key("userId").eq(user_id))
    events = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = ev_table.query(KeyConditionExpression=Key("userId").eq(user_id),
                              ExclusiveStartKey=resp["LastEvaluatedKey"])
        events.extend(resp.get("Items", []))

    # 2. Calcular breakdown
    breakdown = {c: 0 for c in set(CATEGORY_MAP.values())}
    total     = BASE_SCORE
    for ev in events:
        pts = int(ev.get("points", 0))
        cat = CATEGORY_MAP.get(ev.get("eventType",""), "otros")
        total += pts
        if cat in breakdown:
            breakdown[cat] += pts

    score = max(0, min(100, total))
    level = get_level(score)
    now   = datetime.now(timezone.utc).isoformat()

    # 3. Actualizar users
    usr_table.update_item(
        Key={"userId": user_id},
        UpdateExpression="SET scoreGlobal=:s, scoreLevel=:l, scoreUpdatedAt=:t",
        ExpressionAttributeValues={":s": Decimal(str(score)), ":l": level, ":t": now}
    )

    # 4. Leaderboard (zero-padded para sort lexicografico)
    lb_table.put_item(Item={
        "partitionKey": "GLOBAL",
        "scoreUserId":  f"{str(score).zfill(3)}#{user_id}",
        "userId": user_id,
        "scoreGlobal": Decimal(str(score)),
        "scoreLevel": level,
        "updatedAt": now,
    })

    # 5. Snapshot diario
    snap_table.put_item(Item={
        "userId": user_id,
        "snapshotDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "scoreGlobal": Decimal(str(score)),
        "scoreLevel": level,
        "breakdown": {k: Decimal(str(v)) for k, v in breakdown.items()},
    })

    logger.info(f"Score OK userId={user_id} score={score} level={level}")
    return {"statusCode": 200, "body": json.dumps({
        "userId": user_id, "scoreGlobal": score, "scoreLevel": level,
        "breakdown": breakdown, "updatedAt": now,
    })}