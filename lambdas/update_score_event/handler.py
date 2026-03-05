import os, json, uuid, boto3, logging
from decimal import Decimal
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key, Attr

logger    = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb  = boto3.resource("dynamodb")
lambda_cl = boto3.client("lambda")

SCORE_EVENTS_TABLE  = os.environ["SCORE_EVENTS_TABLE"]
CALCULATE_SCORE_ARN = os.environ["CALCULATE_SCORE_LAMBDA_ARN"]

POINTS_CONFIG = {
    "PAYMENT_EARLY":2,"PAYMENT_ON_TIME":1,"PAYMENT_LATE":-1,"PAYMENT_MISSED":-3,
    "TANDA_COMPLETED_PERFECT":5,"TANDA_COMPLETED":2,"TANDA_ABANDONED":-5,
    "ADMIN_TANDA":1,"ADMIN_TANDA_COMPLETED":3,
    "PROFILE_PHONE_VERIFIED":3,"PROFILE_PHOTO":1,"PROFILE_FULL_NAME":1,
    "PROFILE_PAYMENT_METHOD":2,"ACCOUNT_SENIORITY_6M":2,"ACCOUNT_SENIORITY_1Y":3,
    "REFERRAL_COMPLETED":2,"MULTI_TANDA_NO_DELAY":3,"NO_TANDA_ABANDONMENT":2,
    "INACTIVITY_DECAY":-5,
}
ONE_TIME = {"PROFILE_PHONE_VERIFIED","PROFILE_PHOTO","PROFILE_FULL_NAME",
            "PROFILE_PAYMENT_METHOD","ACCOUNT_SENIORITY_6M","ACCOUNT_SENIORITY_1Y"}

CORS = {"Content-Type":"application/json","Access-Control-Allow-Origin":"*",
        "Access-Control-Allow-Methods":"POST,OPTIONS"}

def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode":200,"headers":CORS,"body":""}
    try:
        body = json.loads(event.get("body") or "{}")
    except:
        return err(400, "Body JSON invalido")

    user_id    = body.get("userId")
    event_type = body.get("eventType")
    tanda_id   = body.get("tandaId", "GLOBAL")
    metadata   = body.get("metadata", {})

    if not user_id or not event_type:
        return err(400, "userId y eventType requeridos")
    if event_type not in POINTS_CONFIG:
        return err(400, f"eventType invalido. Validos: {list(POINTS_CONFIG.keys())}")

    table  = dynamodb.Table(SCORE_EVENTS_TABLE)
    points = POINTS_CONFIG[event_type]
    now    = datetime.now(timezone.utc).isoformat()

    # Validar one-time events
    if event_type in ONE_TIME:
        existing = table.query(
            KeyConditionExpression=Key("userId").eq(user_id),
            FilterExpression=Attr("eventType").eq(event_type),
            Limit=1
        )
        if existing.get("Items"):
            return err(409, f"'{event_type}' ya fue registrado para este usuario")

    event_id = str(uuid.uuid4())
    table.put_item(Item={
        "userId":user_id,"eventId":event_id,"eventType":event_type,
        "tandaId":tanda_id,"points":Decimal(str(points)),
        "metadata":metadata,"createdAt":now,
    })
    logger.info(f"Event saved userId={user_id} type={event_type} pts={points}")

    # Recalculo async
    lambda_cl.invoke(
        FunctionName=CALCULATE_SCORE_ARN,
        InvocationType="Event",
        Payload=json.dumps({"userId": user_id}),
    )

    return {"statusCode":201,"headers":CORS,"body":json.dumps({
        "eventId":event_id,"userId":user_id,
        "eventType":event_type,"points":points,"createdAt":now,
    })}

def err(s, m):
    return {"statusCode":s,"headers":CORS,"body":json.dumps({"error":m})}