import os, json, boto3, logging
from boto3.dynamodb.conditions import Key

logger   = logging.getLogger()
logger.setLevel(logging.INFO)
dynamodb = boto3.resource("dynamodb")

PARTICIPANTES_TABLE = os.environ["PARTICIPANTES_TABLE"]

LEVELS = ["nuevo", "confiable", "destacado", "elite"]
LEVEL_META = {
    "nuevo":     {"label": "Nuevo",     "badge": "bronze",  "minScore": 0,  "maxScore": 30},
    "confiable": {"label": "Confiable", "badge": "silver",  "minScore": 31, "maxScore": 60},
    "destacado": {"label": "Destacado", "badge": "gold",    "minScore": 61, "maxScore": 80},
    "elite":     {"label": "Elite",     "badge": "diamond", "minScore": 81, "maxScore": 100},
}


def handler(event, _context):
    tanda_id = (event.get("pathParameters") or {}).get("tandaId")
    if not tanda_id:
        return err(400, "tandaId requerido")

    part_table = dynamodb.Table(PARTICIPANTES_TABLE)

    resp          = part_table.query(KeyConditionExpression=Key("id").eq(tanda_id))
    participantes = resp.get("Items", [])
    while "LastEvaluatedKey" in resp:
        resp = part_table.query(
            KeyConditionExpression=Key("id").eq(tanda_id),
            ExclusiveStartKey=resp["LastEvaluatedKey"],
        )
        participantes.extend(resp.get("Items", []))

    resultado = []
    for p in participantes:
        score = int(p.get("scoreGlobal", 20))
        level = p.get("scoreLevel", "nuevo")
        if level not in LEVELS:
            level = "nuevo"

        idx = LEVELS.index(level)
        next_level = None
        if idx < len(LEVELS) - 1:
            nxt = LEVELS[idx + 1]
            next_level = {
                **LEVEL_META[nxt],
                "level":      nxt,
                "pointsLeft": max(0, LEVEL_META[nxt]["minScore"] - score),
            }

        resultado.append({
            "participanteId": p["participanteId"],
            "nombre":         p.get("nombre", ""),
            "telefono":       p.get("telefono", ""),
            "turno":          int(p.get("turno", 0)) if p.get("turno") is not None else None,
            "scoreGlobal":    score,
            "scoreLevel":     level,
            "levelInfo":      LEVEL_META[level],
            "nextLevel":      next_level,
            "scoreUpdatedAt": p.get("scoreUpdatedAt"),
        })

    # Ordenar por puntaje descendente
    resultado.sort(key=lambda x: x["scoreGlobal"], reverse=True)

    logger.info(f"get_tanda_scores: tanda={tanda_id} participantes={len(resultado)}")

    return {
        "statusCode": 200,
        "body": json.dumps({
            "tandaId":       tanda_id,
            "total":         len(resultado),
            "participantes": resultado,
        }),
    }


def err(s, m):
    return {"statusCode": s, "body": json.dumps({"error": m})}
