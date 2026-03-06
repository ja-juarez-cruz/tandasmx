import os, json, uuid, boto3, logging
from decimal import Decimal
from datetime import datetime, timezone, timedelta
from boto3.dynamodb.conditions import Key

logger    = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb  = boto3.resource("dynamodb")
lambda_cl = boto3.client("lambda")

USUARIOS_TABLE     = os.environ["USUARIOS_TABLE"]
SCORE_EVENTS_TABLE = os.environ["SCORE_EVENTS_TABLE"]
CALCULATE_SCORE_ARN = os.environ["CALCULATE_SCORE_LAMBDA_ARN"]

INACTIVITY_DAYS = 90

# Eventos que ya no se recalculan: son resultado de acciones de negocio concretas
# y se registran en el momento en que ocurren (via update_score_event).
TERMINAL_EVENTS = {
    "TANDA_COMPLETED", "TANDA_COMPLETED_PERFECT", "TANDA_ABANDONED",
    "ADMIN_TANDA", "ADMIN_TANDA_COMPLETED", "REFERRAL_COMPLETED",
    "PROFILE_PHONE_VERIFIED", "PROFILE_PHOTO", "PROFILE_FULL_NAME",
    "PROFILE_PAYMENT_METHOD", "MULTI_TANDA_NO_DELAY", "NO_TANDA_ABANDONMENT",
}

# Antigüedad de cuenta: días mínimos → (eventType, puntos)
SENIORITY_THRESHOLDS = [
    (365, "ACCOUNT_SENIORITY_1Y", 3),
    (180, "ACCOUNT_SENIORITY_6M", 2),
]


def handler(event, _context):
    now = datetime.now(timezone.utc)
    logger.info(f"process_periodic_events iniciado: {now.isoformat()}")

    user_table = dynamodb.Table(USUARIOS_TABLE)
    ev_table   = dynamodb.Table(SCORE_EVENTS_TABLE)

    # Escanear todos los usuarios (solo campos necesarios)
    resp  = user_table.scan(ProjectionExpression="id, creadoEn")
    users = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = user_table.scan(
            ProjectionExpression="id, creadoEn",
            ExclusiveStartKey=resp["LastEvaluatedKey"],
        )
        users.extend(resp.get("Items", []))

    processed = 0
    for user in users:
        user_id    = user.get("id")
        created_at = user.get("creadoEn", "")
        if not user_id:
            continue
        try:
            awarded = _process_user(ev_table, user_id, created_at, now)
            if awarded:
                processed += 1
        except Exception as e:
            logger.error(f"Error procesando userId={user_id}: {e}", exc_info=True)

    logger.info(f"process_periodic_events finalizado. Procesados: {processed}/{len(users)} usuarios")
    return {"processed": processed, "total": len(users)}


def _process_user(ev_table, user_id: str, created_at_str: str, now: datetime) -> bool:
    """Evalúa y registra eventos periódicos para un usuario. Retorna True si se registró algo."""

    # Traer historial completo
    resp   = ev_table.query(KeyConditionExpression=Key("userId").eq(user_id))
    events = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = ev_table.query(
            KeyConditionExpression=Key("userId").eq(user_id),
            ExclusiveStartKey=resp["LastEvaluatedKey"],
        )
        events.extend(resp.get("Items", []))

    existing_types = {e.get("eventType") for e in events}
    now_iso        = now.isoformat()
    new_events     = []

    # ── INACTIVITY_DECAY ────────────────────────────────────────────────────────
    # Se aplica cada semana si el usuario no ha tenido actividad en 90+ días.
    # No es ONE_TIME: se acumula mientras persista la inactividad.
    dates = [e.get("createdAt", "") for e in events if e.get("createdAt")]
    if dates:
        last_event_dt = datetime.fromisoformat(max(dates).replace("Z", "+00:00"))
        if (now - last_event_dt).days >= INACTIVITY_DAYS:
            new_events.append(("INACTIVITY_DECAY", -5, "GLOBAL"))

    # ── ACCOUNT_SENIORITY ───────────────────────────────────────────────────────
    # ONE_TIME: solo se otorga una vez por umbral alcanzado.
    if created_at_str:
        try:
            created_dt = datetime.fromisoformat(created_at_str.replace("Z", "+00:00"))
            age_days   = (now - created_dt).days
            for threshold_days, event_type, points in SENIORITY_THRESHOLDS:
                if age_days >= threshold_days and event_type not in existing_types:
                    new_events.append((event_type, points, "GLOBAL"))
                    break  # Solo otorgar el más alto no obtenido aún
        except (ValueError, TypeError):
            pass

    if not new_events:
        return False

    for (event_type, points, tanda_id) in new_events:
        ev_table.put_item(Item={
            "userId":    user_id,
            "eventId":   str(uuid.uuid4()),
            "eventType": event_type,
            "actorType": "admin",
            "tandaId":   tanda_id,
            "points":    Decimal(str(points)),
            "metadata":  {},
            "createdAt": now_iso,
        })
        logger.info(f"Evento periódico: userId={user_id} type={event_type} pts={points}")

    # Recalcular score global del administrador
    lambda_cl.invoke(
        FunctionName=CALCULATE_SCORE_ARN,
        InvocationType="Event",
        Payload=json.dumps({"userId": user_id, "actorType": "admin", "tandaId": "GLOBAL"}),
    )
    return True
