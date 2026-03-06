import os, json, boto3, logging

logger   = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource("dynamodb")

USUARIOS_TABLE      = os.environ["USUARIOS_TABLE"]
PARTICIPANTES_TABLE = os.environ["PARTICIPANTES_TABLE"]
ACCESS_RULES_TABLE  = os.environ["ACCESS_RULES_TABLE"]

LEVELS = ["nuevo","confiable","destacado","elite"]

def handler(event, _context):
    params   = event.get("pathParameters") or {}
    actor_id = params.get("actorId")
    tanda_id = params.get("tandaId")
    if not actor_id or not tanda_id:
        return err(400, "actorId y tandaId son requeridos")

    query_params = event.get("queryStringParameters") or {}
    actor_type   = query_params.get("actorType", "admin")

    if actor_type not in ("admin", "participante"):
        return err(400, "actorType debe ser 'admin' o 'participante'")

    if actor_type == "participante":
        subject = dynamodb.Table(PARTICIPANTES_TABLE).get_item(
            Key={"id": tanda_id, "participanteId": actor_id}
        ).get("Item")
    else:
        subject = dynamodb.Table(USUARIOS_TABLE).get_item(
            Key={"id": actor_id}
        ).get("Item")

    if not subject:
        return err(404, "Usuario no encontrado")

    score = int(subject.get("scoreGlobal", 20))
    level = subject.get("scoreLevel", "nuevo")

    rules     = dynamodb.Table(ACCESS_RULES_TABLE).get_item(Key={"tandaId": tanda_id}).get("Item", {})
    min_score = int(rules.get("minScore", 40))
    req_level = rules.get("requiredLevel")

    allowed = True
    reasons = []

    if score < min_score:
        allowed = False
        reasons.append(f"Score insuficiente: tienes {score}, mínimo requerido {min_score}")

    if req_level and req_level in LEVELS:
        if LEVELS.index(level if level in LEVELS else "nuevo") < LEVELS.index(req_level):
            allowed = False
            reasons.append(f"Nivel insuficiente: tienes '{level}', se requiere '{req_level}'")

    if score < 25:
        allowed = False
        reasons.append("Cuenta restringida por score bajo. Requiere invitación manual del admin.")

    return {"statusCode":200,"body":json.dumps({
        "actorId":    actor_id,
        "actorType":  actor_type,
        "tandaId":    tanda_id,
        "allowed":    allowed,
        "reasons":    reasons,
        "userScore":  score,
        "userLevel":  level,
        "tandaRules": {"minScore": min_score, "requiredLevel": req_level},
    })}

def err(s, m):
    return {"statusCode":s,"body":json.dumps({"error":m})}
