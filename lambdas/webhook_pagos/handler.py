import os, json, uuid, hashlib, boto3, logging
from datetime import datetime, timezone

logger   = logging.getLogger()
logger.setLevel(logging.INFO)
sqs      = boto3.client("sqs")

QUEUE_URL = os.environ["PAYMENT_EVENTS_QUEUE_URL"]

PAYMENT_EVENTS    = {"PAYMENT_EARLY", "PAYMENT_ON_TIME", "PAYMENT_LATE", "PAYMENT_MISSED", "PAYMENT_CANCEL"}
PARTICIPANTE_ONLY = PAYMENT_EVENTS  # all payment events are participant-only


def handler(event, _context):
    try:
        body = json.loads(event.get("body") or "{}")
    except Exception:
        return err(400, "Body JSON invalido")

    actor_type      = body.get("actorType", "admin")
    user_id         = body.get("userId")
    event_type      = body.get("eventType")
    tanda_id        = body.get("tandaId") or "GLOBAL"
    participante_id = body.get("participanteId")
    metadata        = body.get("metadata", {})

    if not user_id or not event_type:
        return err(400, "userId y eventType son requeridos")
    if event_type not in PAYMENT_EVENTS:
        return err(400, f"Solo se aceptan eventos de pago: {sorted(PAYMENT_EVENTS)}")
    if actor_type not in ("admin", "participante"):
        return err(400, "actorType debe ser 'admin' o 'participante'")
    if actor_type != "participante":
        return err(400, f"'{event_type}' solo aplica para participantes")
    if not participante_id:
        return err(400, "participanteId es requerido")
    if tanda_id == "GLOBAL":
        return err(400, "tandaId requerido para eventos de pago")

    score_subject_id = participante_id
    event_id         = str(uuid.uuid4())

    # Deterministic dedup key for SQS FIFO (5-min window): prevents same payment enqueued twice
    dedup_src = f"{score_subject_id}:{event_type}:{json.dumps(metadata, sort_keys=True, default=str)}"
    dedup_id  = hashlib.sha256(dedup_src.encode()).hexdigest()[:128]

    message = {
        "eventId":        event_id,
        "actorType":      actor_type,
        "adminUserId":    user_id,
        "participanteId": participante_id,
        "scoreSubjectId": score_subject_id,
        "eventType":      event_type,
        "tandaId":        tanda_id,
        "metadata":       metadata,
        "enqueuedAt":     datetime.now(timezone.utc).isoformat(),
    }

    sqs.send_message(
        QueueUrl=QUEUE_URL,
        MessageBody=json.dumps(message),
        MessageGroupId=score_subject_id,
        MessageDeduplicationId=dedup_id,
    )

    logger.info(f"Payment event queued eventId={event_id} type={event_type} subject={score_subject_id}")
    return {
        "statusCode": 202,
        "body": json.dumps({"eventId": event_id, "status": "queued", "eventType": event_type}),
    }


def err(s, m):
    return {"statusCode": s, "body": json.dumps({"error": m})}
