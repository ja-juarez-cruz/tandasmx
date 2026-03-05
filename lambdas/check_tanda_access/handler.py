import os, json, boto3, logging

logger   = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource("dynamodb")

USERS_TABLE        = os.environ["USERS_TABLE"]
ACCESS_RULES_TABLE = os.environ["ACCESS_RULES_TABLE"]

CORS   = {"Content-Type":"application/json","Access-Control-Allow-Origin":"*"}
LEVELS = ["nuevo","confiable","destacado","elite"]

def handler(event, context):
    if event.get("httpMethod") == "OPTIONS":
        return {"statusCode":200,"headers":CORS,"body":""}

    params   = event.get("pathParameters") or {}
    user_id  = params.get("userId")
    tanda_id = params.get("tandaId")
    if not user_id or not tanda_id:
        return err(400, "userId y tandaId requeridos")

    user = dynamodb.Table(USERS_TABLE).get_item(Key={"userId":user_id}).get("Item")
    if not user:
        return err(404, "Usuario no encontrado")

    score = int(user.get("scoreGlobal", 20))
    level = user.get("scoreLevel", "nuevo")

    rules     = dynamodb.Table(ACCESS_RULES_TABLE).get_item(Key={"tandaId":tanda_id}).get("Item", {})
    min_score = int(rules.get("minScore", 40))
    req_level = rules.get("requiredLevel")

    allowed = True
    reasons = []

    if score < min_score:
        allowed = False
        reasons.append(f"Score insuficiente: tienes {score}, minimo requerido {min_score}")

    if req_level and req_level in LEVELS:
        if LEVELS.index(level if level in LEVELS else "nuevo") < LEVELS.index(req_level):
            allowed = False
            reasons.append(f"Nivel insuficiente: tienes '{level}', se requiere '{req_level}'")

    if score < 25:
        allowed = False
        reasons.append("Cuenta restringida por score bajo. Requiere invitacion manual del admin.")

    return {"statusCode":200,"headers":CORS,"body":json.dumps({
        "userId":user_id,"tandaId":tanda_id,
        "allowed":allowed,"reasons":reasons,
        "userScore":score,"userLevel":level,
        "tandaRules":{"minScore":min_score,"requiredLevel":req_level},
    })}

def err(s, m):
    return {"statusCode":s,"headers":CORS,"body":json.dumps({"error":m})}