import os, json, uuid, boto3, logging
from decimal import Decimal
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key

logger    = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb  = boto3.resource("dynamodb")
lambda_cl = boto3.client("lambda")

SCORE_EVENTS_TABLE  = os.environ["SCORE_EVENTS_TABLE"]
CALCULATE_SCORE_ARN = os.environ["CALCULATE_SCORE_LAMBDA_ARN"]

# Eventos de pago se procesan exclusivamente via POST /webhooks/pagos → SQS
POINTS_CONFIG = {
    "TANDA_COMPLETED_PERFECT":5,"TANDA_COMPLETED":2,"TANDA_ABANDONED":-5,
    "ADMIN_TANDA":1,"ADMIN_TANDA_COMPLETED":3,
    "PROFILE_PHONE_VERIFIED":3,"PROFILE_PHOTO":1,"PROFILE_FULL_NAME":1,
    "PROFILE_PAYMENT_METHOD":2,"ACCOUNT_SENIORITY_6M":2,"ACCOUNT_SENIORITY_1Y":3,
    "REFERRAL_COMPLETED":2,"MULTI_TANDA_NO_DELAY":3,"NO_TANDA_ABANDONMENT":2,
    "INACTIVITY_DECAY":-5,
}
ONE_TIME = {
    "PROFILE_PHONE_VERIFIED","PROFILE_PHOTO","PROFILE_FULL_NAME",
    "PROFILE_PAYMENT_METHOD","ACCOUNT_SENIORITY_6M","ACCOUNT_SENIORITY_1Y",
}
ADMIN_ONLY        = {"ADMIN_TANDA","ADMIN_TANDA_COMPLETED"}
PARTICIPANTE_ONLY = {"TANDA_COMPLETED_PERFECT","TANDA_COMPLETED","TANDA_ABANDONED"}


def _meta_key(meta: dict) -> str:
    """Clave canónica de metadata para comparación de duplicados."""
    return json.dumps(meta, sort_keys=True, default=str)


def _fetch_all_events(table, subject_id: str) -> list:
    """Obtiene todos los eventos del sujeto, paginando si es necesario."""
    resp  = table.query(KeyConditionExpression=Key("userId").eq(subject_id))
    items = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = table.query(
            KeyConditionExpression=Key("userId").eq(subject_id),
            ExclusiveStartKey=resp["LastEvaluatedKey"],
        )
        items.extend(resp.get("Items", []))
    return items


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

    if actor_type not in ("admin", "participante"):
        return err(400, "actorType debe ser 'admin' o 'participante'")
    if not user_id or not event_type:
        return err(400, "userId y eventType son requeridos")
    if event_type not in POINTS_CONFIG:
        return err(400, f"eventType invalido. Validos: {list(POINTS_CONFIG.keys())}")
    if actor_type == "admin" and event_type in PARTICIPANTE_ONLY:
        return err(400, f"'{event_type}' solo aplica para participantes")
    if actor_type == "participante" and event_type in ADMIN_ONLY:
        return err(400, f"'{event_type}' solo aplica para administradores")
    if actor_type == "participante" and tanda_id == "GLOBAL":
        return err(400, "tandaId requerido para eventos de participante")
    if actor_type == "participante" and not participante_id:
        return err(400, "participanteId es requerido para actorType 'participante'")

    score_subject_id = participante_id if actor_type == "participante" else user_id
    actor_label      = "participante" if actor_type == "participante" else "administrador"

    table = dynamodb.Table(SCORE_EVENTS_TABLE)
    now   = datetime.now(timezone.utc).isoformat()

    # ── Traer historial del sujeto (necesario para múltiples validaciones) ──────
    all_events = _fetch_all_events(table, score_subject_id)
    all_events.sort(key=lambda x: x.get("createdAt", ""), reverse=True)

    # ── Validación ONE_TIME ─────────────────────────────────────────────────────
    if event_type in ONE_TIME:
        if any(e.get("eventType") == event_type for e in all_events):
            return err(409, f"'{event_type}' ya fue registrado para este {actor_label}")

    # ── Validación duplicado por metadata ───────────────────────────────────────
    # El mismo eventType con idénticos metadatos no puede registrarse dos veces
    # (ej: no se puede pagar la misma ronda, monto y fecha más de una vez)
    if metadata:
        incoming_meta_key = _meta_key(metadata)
        duplicate = next(
            (e for e in all_events
             if e.get("eventType") == event_type
             and _meta_key(e.get("metadata", {})) == incoming_meta_key),
            None,
        )
        if duplicate:
            return err(409,
                f"Evento '{event_type}' ya registrado con los mismos metadatos "
                f"para este {actor_label} (eventId: {duplicate['eventId']})"
            )

    # ── Guardar evento ──────────────────────────────────────────────────────────
    points   = POINTS_CONFIG[event_type]
    event_id = str(uuid.uuid4())
    item = {
        "userId":    score_subject_id,
        "eventId":   event_id,
        "eventType": event_type,
        "actorType": actor_type,
        "tandaId":   tanda_id,
        "points":    Decimal(str(points)),
        "metadata":  metadata,
        "createdAt": now,
    }
    if actor_type == "participante":
        item["adminUserId"] = user_id

    table.put_item(Item=item)
    logger.info(f"Event saved actorType={actor_type} subjectId={score_subject_id} type={event_type} pts={points}")

    _trigger_recalculate(score_subject_id, actor_type, tanda_id)

    return {"statusCode":201,"body":json.dumps({
        "eventId":   event_id,
        "userId":    score_subject_id,
        "actorType": actor_type,
        "eventType": event_type,
        "points":    points,
        "createdAt": now,
    })}


def _trigger_recalculate(subject_id: str, actor_type: str, tanda_id: str):
    lambda_cl.invoke(
        FunctionName=CALCULATE_SCORE_ARN,
        InvocationType="Event",
        Payload=json.dumps({"userId": subject_id, "actorType": actor_type, "tandaId": tanda_id}),
    )


def err(s, m):
    return {"statusCode":s,"body":json.dumps({"error":m})}
