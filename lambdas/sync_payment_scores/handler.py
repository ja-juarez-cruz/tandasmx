import os, json, uuid, boto3, logging, calendar
from decimal import Decimal
from datetime import date, timedelta, datetime, timezone
from boto3.dynamodb.conditions import Key, Attr
from botocore.exceptions import ClientError

logger    = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb  = boto3.resource("dynamodb")
lambda_cl = boto3.client("lambda")

TANDAS_TABLE        = os.environ["TANDAS_TABLE"]
PARTICIPANTES_TABLE = os.environ["PARTICIPANTES_TABLE"]
PAGOS_TABLE         = os.environ["PAGOS_TABLE"]
SCORE_EVENTS_TABLE  = os.environ["SCORE_EVENTS_TABLE"]
CALCULATE_SCORE_ARN = os.environ["CALCULATE_SCORE_LAMBDA_ARN"]

DIAS_LIMITE_PAGO = 3
PAYMENT_TYPES    = {"PAYMENT_EARLY", "PAYMENT_ON_TIME", "PAYMENT_LATE", "PAYMENT_MISSED"}
POINTS_CONFIG    = {"PAYMENT_EARLY": 2, "PAYMENT_ON_TIME": 1, "PAYMENT_LATE": -1, "PAYMENT_MISSED": -3}


# ═══════════════════════════════════════════════════════════════
# Cálculo de fechas de rondas (equivalente a tandaCalculos.js)
# ═══════════════════════════════════════════════════════════════

def _calcular_fecha_ronda(fecha_inicial: date, indice: int, frecuencia: str) -> date:
    if frecuencia == "semanal":
        return fecha_inicial + timedelta(weeks=indice - 1)

    if frecuencia == "mensual":
        dia_original = fecha_inicial.day
        total_months = (fecha_inicial.month - 1) + (indice - 1)
        new_year     = fecha_inicial.year + total_months // 12
        new_month    = total_months % 12 + 1
        max_day      = calendar.monthrange(new_year, new_month)[1]
        return date(new_year, new_month, min(dia_original, max_day))

    if frecuencia == "quincenal":
        temp          = fecha_inicial
        es_fin_de_mes = fecha_inicial.day > 15

        for i in range(1, indice + 1):
            if es_fin_de_mes:
                last_day = calendar.monthrange(temp.year, temp.month)[1]
                temp = date(temp.year, temp.month, last_day)
            else:
                temp = date(temp.year, temp.month, 15)

            if i < indice:
                if es_fin_de_mes:
                    new_month = temp.month + 1
                    new_year  = temp.year
                    if new_month > 12:
                        new_month = 1
                        new_year += 1
                    temp = date(new_year, new_month, 15)
                else:
                    last_day = calendar.monthrange(temp.year, temp.month)[1]
                    temp = date(temp.year, temp.month, last_day)
                es_fin_de_mes = not es_fin_de_mes
        return temp

    return fecha_inicial


def _clasificar_tipo_pago(fecha_pago_str: str, fecha_ronda: date) -> str:
    try:
        fecha_pago = date.fromisoformat(str(fecha_pago_str).split("T")[0])
    except (ValueError, AttributeError):
        return "PAYMENT_ON_TIME"

    fecha_limite = fecha_ronda + timedelta(days=DIAS_LIMITE_PAGO)
    if fecha_pago < fecha_ronda:
        return "PAYMENT_EARLY"
    if fecha_pago <= fecha_limite:
        return "PAYMENT_ON_TIME"
    return "PAYMENT_LATE"


# ═══════════════════════════════════════════════════════════════
# Handler principal
# ═══════════════════════════════════════════════════════════════

def handler(event, _context):
    """
    Parámetros de entrada:
      { "tandaId": "xxx" }          → procesa solo esa tanda
      {}                             → procesa todas las tandas
      { "forzarReproceso": true }    → reprocesa tandas ya sincronizadas
    """
    tanda_id         = event.get("tandaId")
    forzar_reproceso = bool(event.get("forzarReproceso", False))

    tandas_table = dynamodb.Table(TANDAS_TABLE)
    ev_table     = dynamodb.Table(SCORE_EVENTS_TABLE)

    if tanda_id:
        item = tandas_table.get_item(Key={"id": tanda_id}).get("Item")
        if not item:
            return {"statusCode": 404, "body": json.dumps({"error": f"Tanda {tanda_id} no encontrada"})}
        tandas = [item]
    else:
        resp  = tandas_table.scan()
        tandas = resp.get("Items", [])
        while "LastEvaluatedKey" in resp:
            resp = tandas_table.scan(ExclusiveStartKey=resp["LastEvaluatedKey"])
            tandas.extend(resp.get("Items", []))

    resultados = {"procesadas": 0, "omitidas": 0, "errores": 0, "tandas": []}

    for tanda in tandas:
        t_id = tanda.get("id", "")
        try:
            resultado = _procesar_tanda(tanda, ev_table, forzar_reproceso)
            if resultado["status"] == "omitida":
                resultados["omitidas"] += 1
            else:
                resultados["procesadas"] += 1
                # Marcar tanda como sincronizada
                tandas_table.update_item(
                    Key={"id": t_id},
                    UpdateExpression="SET scoreSyncedAt = :t",
                    ExpressionAttributeValues={":t": datetime.now(timezone.utc).isoformat()},
                )
            resultados["tandas"].append({"tandaId": t_id, **resultado})
        except Exception as e:
            logger.error(f"Error en tanda {t_id}: {e}", exc_info=True)
            resultados["errores"] += 1
            resultados["tandas"].append({"tandaId": t_id, "status": "error", "error": str(e)})

    logger.info(f"sync_payment_scores: procesadas={resultados['procesadas']} "
                f"omitidas={resultados['omitidas']} errores={resultados['errores']}")
    return {"statusCode": 200, "body": json.dumps(resultados)}


def _procesar_tanda(tanda: dict, ev_table, forzar_reproceso: bool) -> dict:
    tanda_id   = tanda["id"]
    frecuencia = tanda.get("frecuencia", "mensual")

    # Tandas cumpleañeras tienen fechas de ronda distintas por participante — omitir
    if frecuencia == "cumpleaños":
        logger.info(f"Omitiendo tanda cumpleaños {tanda_id}")
        return {"status": "omitida", "razon": "frecuencia_cumpleanos"}

    fecha_inicio_str = tanda.get("fechaInicio")
    total_rondas     = int(tanda.get("totalRondas", 0))

    if not fecha_inicio_str or total_rondas == 0:
        return {"status": "omitida", "razon": "sin_fechaInicio_o_rondas"}

    # Si ya fue sincronizada y no se fuerza el reproceso
    if not forzar_reproceso and tanda.get("scoreSyncedAt"):
        logger.info(f"Tanda {tanda_id} ya sincronizada ({tanda['scoreSyncedAt']}), omitiendo")
        return {"status": "omitida", "razon": "ya_sincronizada", "syncedAt": tanda["scoreSyncedAt"]}

    hoy           = date.today()
    fecha_inicio  = date.fromisoformat(fecha_inicio_str)

    # Calcular solo rondas cuya fecha límite ya pasó
    rondas_pasadas = []
    for i in range(1, total_rondas + 1):
        fecha_ronda  = _calcular_fecha_ronda(fecha_inicio, i, frecuencia)
        fecha_limite = fecha_ronda + timedelta(days=DIAS_LIMITE_PAGO)
        if fecha_limite < hoy:
            rondas_pasadas.append((i, fecha_ronda))

    if not rondas_pasadas:
        return {"status": "omitida", "razon": "sin_rondas_pasadas"}

    # Obtener participantes de la tanda
    part_table    = dynamodb.Table(PARTICIPANTES_TABLE)
    resp          = part_table.query(KeyConditionExpression=Key("id").eq(tanda_id))
    participantes = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = part_table.query(KeyConditionExpression=Key("id").eq(tanda_id),
                                ExclusiveStartKey=resp["LastEvaluatedKey"])
        participantes.extend(resp.get("Items", []))

    if not participantes:
        return {"status": "omitida", "razon": "sin_participantes"}

    # Obtener todos los pagos de la tanda
    pagos_table = dynamodb.Table(PAGOS_TABLE)
    resp        = pagos_table.query(KeyConditionExpression=Key("id").eq(tanda_id))
    pagos_list  = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = pagos_table.query(KeyConditionExpression=Key("id").eq(tanda_id),
                                 ExclusiveStartKey=resp["LastEvaluatedKey"])
        pagos_list.extend(resp.get("Items", []))

    # Índice de pagos: "{participanteId}_{ronda}" → pago
    pagos_idx = {f"{p['participanteId']}_{int(p['ronda'])}": p for p in pagos_list}

    admin_id          = tanda.get("adminId", "")
    now_iso           = datetime.now(timezone.utc).isoformat()
    actores_afectados = set()
    eventos_creados   = 0
    eventos_omitidos  = 0

    for participante in participantes:
        actor_id = participante["participanteId"]

        # Obtener eventos de pago existentes para este actor en esta tanda
        resp = ev_table.query(
            KeyConditionExpression=Key("actorId").eq(actor_id),
            FilterExpression=Attr("tandaId").eq(tanda_id) & Attr("eventType").is_in(list(PAYMENT_TYPES)),
        )
        existing_events = resp.get("Items", [])

        # Índice de rondas ya procesadas: ronda_num → evento existente
        rondas_procesadas = {}
        for e in existing_events:
            ronda_meta = e.get("metadata", {}).get("ronda")
            if ronda_meta is not None:
                try:
                    rondas_procesadas[int(ronda_meta)] = e
                except (ValueError, TypeError):
                    pass

        for (num_ronda, fecha_ronda) in rondas_pasadas:
            existing_event = rondas_procesadas.get(num_ronda)

            if existing_event and not forzar_reproceso:
                eventos_omitidos += 1
                continue

            # Si forzar_reproceso: eliminar el evento anterior
            if existing_event and forzar_reproceso:
                try:
                    ev_table.delete_item(
                        Key={"actorId": actor_id, "eventId": existing_event["eventId"]}
                    )
                except ClientError as e:
                    logger.warning(f"No se pudo eliminar evento previo: {e}")

            pago_key = f"{actor_id}_{num_ronda}"
            pago     = pagos_idx.get(pago_key)

            if pago and pago.get("pagado"):
                event_type = _clasificar_tipo_pago(pago.get("fechaPago", ""), fecha_ronda)
            else:
                event_type = "PAYMENT_MISSED"

            fecha_pago_str = ""
            if pago and pago.get("pagado"):
                raw = pago.get("fechaPago", "")
                fecha_pago_str = str(raw).split("T")[0] if raw else ""

            ev_table.put_item(Item={
                "actorId":     actor_id,
                "eventId":     str(uuid.uuid4()),
                "eventType":   event_type,
                "actorType":   "participante",
                "tandaId":     tanda_id,
                "points":      Decimal(str(POINTS_CONFIG[event_type])),
                "metadata":    {
                    "ronda":      num_ronda,
                    "fechaRonda": fecha_ronda.isoformat(),
                    "fechaPago":  fecha_pago_str,
                },
                "adminUserId": admin_id,
                "createdAt":   now_iso,
            })

            actores_afectados.add(actor_id)
            eventos_creados += 1
            logger.info(f"Score: actor={actor_id} tanda={tanda_id} ronda={num_ronda} tipo={event_type}")

    # Disparar recálculo de score para cada actor afectado
    for actor_id in actores_afectados:
        lambda_cl.invoke(
            FunctionName=CALCULATE_SCORE_ARN,
            InvocationType="Event",
            Payload=json.dumps({"actorId": actor_id, "actorType": "participante", "tandaId": tanda_id}),
        )

    logger.info(f"Tanda {tanda_id}: {eventos_creados} eventos creados, "
                f"{eventos_omitidos} omitidos, {len(actores_afectados)} actores afectados")

    return {
        "status":           "procesada",
        "rondas_evaluadas": len(rondas_pasadas),
        "eventos_creados":  eventos_creados,
        "eventos_omitidos": eventos_omitidos,
        "actores":          len(actores_afectados),
    }
