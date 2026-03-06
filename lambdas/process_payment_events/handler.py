import os, json, boto3, logging
from decimal import Decimal
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key

logger    = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb  = boto3.resource("dynamodb")
lambda_cl = boto3.client("lambda")

SCORE_EVENTS_TABLE  = os.environ["SCORE_EVENTS_TABLE"]
CALCULATE_SCORE_ARN = os.environ["CALCULATE_SCORE_LAMBDA_ARN"]

POINTS_CONFIG = {
    "PAYMENT_EARLY": 2, "PAYMENT_ON_TIME": 1, "PAYMENT_LATE": -1, "PAYMENT_MISSED": -3,
    "PAYMENT_CANCEL": 0,
}
PAYMENT_TYPES       = {"PAYMENT_EARLY", "PAYMENT_ON_TIME", "PAYMENT_LATE", "PAYMENT_MISSED"}
CANCELABLE_PAYMENTS = {"PAYMENT_EARLY", "PAYMENT_ON_TIME"}


def _normalize_meta(val):
    """Normaliza Decimals de DynamoDB a int/float para que la comparación de metadata sea correcta."""
    if isinstance(val, Decimal):
        return int(val) if val == val.to_integral_value() else float(val)
    if isinstance(val, dict):
        return {k: _normalize_meta(v) for k, v in val.items()}
    if isinstance(val, list):
        return [_normalize_meta(v) for v in val]
    return val


def _meta_key(meta: dict) -> str:
    return json.dumps(_normalize_meta(meta), sort_keys=True)


def _fetch_all_events(table, subject_id: str) -> list:
    resp  = table.query(KeyConditionExpression=Key("actorId").eq(subject_id))
    items = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = table.query(
            KeyConditionExpression=Key("actorId").eq(subject_id),
            ExclusiveStartKey=resp["LastEvaluatedKey"],
        )
        items.extend(resp.get("Items", []))
    return items


def handler(event, _context):
    table   = dynamodb.Table(SCORE_EVENTS_TABLE)
    results = []

    for record in event.get("Records", []):
        try:
            msg    = json.loads(record["body"])
            result = _process_record(table, msg)
            results.append(result)
            logger.info(f"Record result: {result}")
        except Exception as e:
            logger.error(f"Error procesando record: {e}", exc_info=True)
            raise  # Let SQS retry the batch

    return {"processed": len(results)}


def _process_record(table, msg: dict) -> dict:
    event_id         = msg["eventId"]
    actor_type       = msg["actorType"]
    user_id          = msg.get("adminUserId", msg.get("userId", ""))
    score_subject_id = msg["scoreSubjectId"]
    event_type       = msg["eventType"]
    tanda_id         = msg.get("tandaId", "GLOBAL")
    metadata         = msg.get("metadata", {})

    # Idempotency check: fast path — if this specific eventId is already in DynamoDB, skip
    existing = table.get_item(Key={"actorId": score_subject_id, "eventId": event_id})
    if "Item" in existing:
        logger.info(f"Skipping already-processed eventId={event_id}")
        return {"eventId": event_id, "status": "duplicate"}

    now        = datetime.now(timezone.utc).isoformat()
    all_events = _fetch_all_events(table, score_subject_id)

    if event_type == "PAYMENT_CANCEL":
        incoming_meta_key = _meta_key(metadata)
        # Buscar el pago original (PAYMENT_EARLY o PAYMENT_ON_TIME) con la misma ronda
        original = next(
            (e for e in all_events
             if e.get("eventType") in CANCELABLE_PAYMENTS
             and _meta_key(e.get("metadata", {})) == incoming_meta_key),
            None,
        )
        if not original:
            logger.warning(f"PAYMENT_CANCEL: no cancelable payment found eventId={event_id}")
            return {"eventId": event_id, "status": "no_cancelable_payment"}

        already_cancelled = any(
            e.get("eventType") == "PAYMENT_CANCEL"
            and e.get("originalEventId") == original["eventId"]
            for e in all_events
        )
        if already_cancelled:
            logger.warning(f"PAYMENT_CANCEL: already cancelled eventId={event_id}")
            return {"eventId": event_id, "status": "already_cancelled"}

        # Descontar exactamente los puntos del tipo original:
        # PAYMENT_ON_TIME (+1) → -1  |  PAYMENT_EARLY (+2) → -2
        original_type = original.get("eventType")
        cancel_points = -POINTS_CONFIG.get(original_type, 0)
        item = {
            "actorId":         score_subject_id,
            "eventId":         event_id,
            "eventType":       "PAYMENT_CANCEL",
            "actorType":       actor_type,
            "tandaId":         tanda_id,
            "points":          Decimal(str(cancel_points)),
            "metadata":        metadata,
            "originalEventId": original["eventId"],
            "originalType":    original["eventType"],
            "createdAt":       now,
        }
    else:
        # Para eventos de pago: verificar que no exista YA un pago activo (no cancelado)
        # para el mismo roundNumber, sin importar el tipo de pago anterior.
        if event_type in PAYMENT_TYPES and metadata:
            incoming_meta_key = _meta_key(metadata)
            existing_payment = next(
                (e for e in all_events
                 if e.get("eventType") in PAYMENT_TYPES
                 and _meta_key(e.get("metadata", {})) == incoming_meta_key),
                None,
            )
            if existing_payment:
                # Permitir solo si ese pago fue cancelado previamente
                is_cancelled = any(
                    e.get("eventType") == "PAYMENT_CANCEL"
                    and e.get("originalEventId") == existing_payment["eventId"]
                    for e in all_events
                )
                if not is_cancelled:
                    logger.info(
                        f"Pago duplicado para misma ronda eventId={event_id} "
                        f"existing={existing_payment['eventId']} type={existing_payment['eventType']}"
                    )
                    return {"eventId": event_id, "status": "round_already_paid"}

        points = POINTS_CONFIG[event_type]
        item = {
            "actorId":   score_subject_id,
            "eventId":   event_id,
            "eventType": event_type,
            "actorType": actor_type,
            "tandaId":   tanda_id,
            "points":    Decimal(str(points)),
            "metadata":  metadata,
            "createdAt": now,
        }

    item["adminUserId"] = user_id  # Always set: who triggered the payment event
    table.put_item(Item=item)
    logger.info(f"Payment event saved eventId={event_id} type={event_type} subject={score_subject_id}")

    _trigger_recalculate(score_subject_id, actor_type, tanda_id)
    return {"eventId": event_id, "status": "processed"}


def _trigger_recalculate(subject_id: str, actor_type: str, tanda_id: str):
    lambda_cl.invoke(
        FunctionName=CALCULATE_SCORE_ARN,
        InvocationType="Event",
        Payload=json.dumps({"actorId": subject_id, "actorType": actor_type, "tandaId": tanda_id}),
    )
