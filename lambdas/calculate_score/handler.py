import os, json, boto3, logging
from decimal import Decimal
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
from botocore.exceptions import ClientError

logger   = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource("dynamodb")

SCORE_EVENTS_TABLE  = os.environ["SCORE_EVENTS_TABLE"]
USUARIOS_TABLE      = os.environ["USUARIOS_TABLE"]
PARTICIPANTES_TABLE = os.environ["PARTICIPANTES_TABLE"]
LEADERBOARD_TABLE   = os.environ["LEADERBOARD_TABLE"]
SNAPSHOTS_TABLE     = os.environ["SCORE_SNAPSHOTS_TABLE"]
BASE_SCORE          = int(os.environ.get("BASE_SCORE", "20"))

SCORE_LEVELS = [(81,100,"elite"),(61,80,"destacado"),(31,60,"confiable"),(0,30,"nuevo")]

CATEGORY_MAP = {
    "PAYMENT_EARLY":"pagos","PAYMENT_ON_TIME":"pagos","PAYMENT_LATE":"pagos",
    "PAYMENT_MISSED":"pagos","PAYMENT_CANCEL":"pagos",
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

def handler(event, _context):
    user_id    = event.get("userId")
    actor_type = event.get("actorType", "admin")   # "admin" | "participante"
    tanda_id   = event.get("tandaId", "GLOBAL")

    if not user_id:
        return {"statusCode":400,"body":json.dumps({"error":"userId requerido"})}

    ev_table   = dynamodb.Table(SCORE_EVENTS_TABLE)
    lb_table   = dynamodb.Table(LEADERBOARD_TABLE)
    snap_table = dynamodb.Table(SNAPSHOTS_TABLE)

    # 1. Traer todos los eventos del sujeto (admin o participante comparten la tabla por userId)
    resp   = ev_table.query(KeyConditionExpression=Key("userId").eq(user_id))
    events = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = ev_table.query(KeyConditionExpression=Key("userId").eq(user_id),
                              ExclusiveStartKey=resp["LastEvaluatedKey"])
        events.extend(resp.get("Items", []))

    # 2. Calcular breakdown y score total
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

    # 3. Persistir score de vuelta a la tabla correspondiente
    # ConditionExpression="attribute_exists(id)" evita que update_item haga
    # un INSERT si la Key no existe (DynamoDB hace upsert por defecto).
    score_fields = {
        ":s": Decimal(str(score)),
        ":l": level,
        ":t": now,
    }
    update_expr = "SET scoreGlobal=:s, scoreLevel=:l, scoreUpdatedAt=:t"

    try:
        if actor_type == "participante":
            if tanda_id == "GLOBAL":
                logger.warning(f"Skipping score update: participante sin tandaId userId={user_id}")
            else:
                dynamodb.Table(PARTICIPANTES_TABLE).update_item(
                    Key={"id": tanda_id, "participanteId": user_id},
                    UpdateExpression=update_expr,
                    ExpressionAttributeValues=score_fields,
                    ConditionExpression="attribute_exists(id)",
                )
        else:
            dynamodb.Table(USUARIOS_TABLE).update_item(
                Key={"id": user_id},
                UpdateExpression=update_expr,
                ExpressionAttributeValues=score_fields,
                ConditionExpression="attribute_exists(id)",
            )
    except ClientError as e:
        if e.response["Error"]["Code"] == "ConditionalCheckFailedException":
            logger.warning(
                f"Score no actualizado: registro no existe "
                f"actorType={actor_type} userId={user_id} tandaId={tanda_id}"
            )
        else:
            raise

    # 4. Leaderboard global (zero-padded para sort lexicográfico)
    lb_table.put_item(Item={
        "partitionKey": "GLOBAL",
        "scoreUserId":  f"{str(score).zfill(3)}#{user_id}",
        "userId":       user_id,
        "actorType":    actor_type,
        "scoreGlobal":  Decimal(str(score)),
        "scoreLevel":   level,
        "updatedAt":    now,
    })

    # 5. Snapshot diario
    snap_table.put_item(Item={
        "userId":       user_id,
        "actorType":    actor_type,
        "snapshotDate": datetime.now(timezone.utc).strftime("%Y-%m-%d"),
        "scoreGlobal":  Decimal(str(score)),
        "scoreLevel":   level,
        "breakdown":    {k: Decimal(str(v)) for k, v in breakdown.items()},
    })

    logger.info(f"Score OK actorType={actor_type} userId={user_id} score={score} level={level}")
    return {"statusCode":200,"body":json.dumps({
        "userId": user_id, "actorType": actor_type,
        "scoreGlobal": score, "scoreLevel": level,
        "breakdown": breakdown, "updatedAt": now,
    })}
