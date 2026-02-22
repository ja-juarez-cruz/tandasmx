"""
Script de Restauración de DynamoDB desde Archivos Locales
==========================================================
Lee archivos .json.gz descargados manualmente desde S3
y los restaura en las tablas DynamoDB de la cuenta nueva.

Uso:
  # Restaurar todas las tablas desde una carpeta
  python restore_dynamo_local.py --folder ~/backups

  # Restaurar una tabla específica
  python restore_dynamo_local.py --folder ~/backups --table tandas

Requisitos:
  pip install boto3
"""

import boto3
import json
import gzip
import argparse
import os
from decimal import Decimal


# ============================================================================
# CONFIGURACIÓN — ajusta estos valores antes de correr
# ============================================================================

AWS_PROFILE = "tandasmx"
AWS_REGION  = "us-east-1"

TABLES = [
    "tandas",
    "participantes",
    "pagos",
    "notificaciones",
    "usuarios_admin",
    "links_registro",
    "auth-password-reset-tokens",
]

# ============================================================================


session  = boto3.Session(profile_name=AWS_PROFILE, region_name=AWS_REGION)
dynamodb = session.resource("dynamodb")


def find_local_backup(folder, table_name):
    """Busca el archivo de backup de una tabla en la carpeta local."""
    for filename in os.listdir(folder):
        if filename.startswith(table_name) and filename.endswith(".json.gz"):
            filepath = os.path.join(folder, filename)
            print(f"  Archivo encontrado: {filename}")
            return filepath

    print(f"  ✗ No se encontró archivo para tabla '{table_name}' en {folder}")
    return None


def load_local_backup(filepath):
    """Lee y descomprime un archivo de backup local."""
    print(f"  Leyendo {os.path.basename(filepath)}...")
    with open(filepath, "rb") as f:
        compressed = f.read()

    raw_json = gzip.decompress(compressed).decode("utf-8")
    data     = json.loads(raw_json)
    items    = data.get("items", [])
    metadata = data.get("metadata", {})

    print(f"  Items en backup : {metadata.get('item_count', len(items))}")
    print(f"  Fecha del backup: {metadata.get('backup_date', 'desconocida')}")
    return items


def float_to_decimal(obj):
    """Convierte floats a Decimal para compatibilidad con DynamoDB."""
    if isinstance(obj, float):
        return Decimal(str(obj))
    elif isinstance(obj, dict):
        return {k: float_to_decimal(v) for k, v in obj.items()}
    elif isinstance(obj, list):
        return [float_to_decimal(i) for i in obj]
    return obj


def restore_table(table_name, items):
    """Restaura los items en la tabla DynamoDB usando batch_writer."""
    table  = dynamodb.Table(table_name)
    total  = len(items)
    errors = 0

    print(f"  Restaurando {total} items en tabla '{table_name}'...")

    with table.batch_writer() as batch:
        for i, item in enumerate(items):
            try:
                batch.put_item(Item=float_to_decimal(item))
                if (i + 1) % 100 == 0:
                    print(f"    Progreso: {i + 1}/{total}...")
            except Exception as e:
                errors += 1
                print(f"    ✗ Error en item {i}: {str(e)}")

    restored = total - errors
    print(f"  ✓ Restaurados: {restored}/{total}  |  Errores: {errors}")
    return restored, errors


def restore_all(folder, table_filter=None):
    """Orquesta la restauración desde archivos locales."""
    tables  = [table_filter] if table_filter else TABLES
    results = []

    print(f"\n{'='*60}")
    print(f"Restauración DynamoDB desde archivos locales")
    print(f"Carpeta fuente : {folder}")
    print(f"Destino        : cuenta {AWS_PROFILE} ({AWS_REGION})")
    print(f"{'='*60}\n")

    for table_name in tables:
        print(f"\n[{table_name}]")

        filepath = find_local_backup(folder, table_name)
        if not filepath:
            results.append({"table": table_name, "status": "NO_FILE", "restored": 0})
            continue

        try:
            items = load_local_backup(filepath)
        except Exception as e:
            print(f"  ✗ Error leyendo archivo: {str(e)}")
            results.append({"table": table_name, "status": "READ_ERROR", "restored": 0})
            continue

        try:
            restored, errors = restore_table(table_name, items)
            status = "OK" if errors == 0 else "PARTIAL"
            results.append({"table": table_name, "status": status, "restored": restored, "errors": errors})
        except Exception as e:
            print(f"  ✗ Error restaurando tabla: {str(e)}")
            results.append({"table": table_name, "status": "RESTORE_ERROR", "restored": 0})

    # Resumen final
    print(f"\n{'='*60}")
    print(f"RESUMEN")
    print(f"{'='*60}")
    for r in results:
        icon = "✓" if r["status"] == "OK" else "⚠" if r["status"] == "PARTIAL" else "✗"
        print(f"  {icon} {r['table']:<35} {r['status']}  ({r.get('restored', 0)} items)")
    print(f"{'='*60}\n")


if __name__ == "__main__":
    parser = argparse.ArgumentParser(description="Restaurar DynamoDB desde archivos locales")
    parser.add_argument("--folder", required=True, help="Carpeta con los archivos .json.gz")
    parser.add_argument("--table",  help="Nombre de tabla específica a restaurar")
    args = parser.parse_args()

    if not os.path.isdir(args.folder):
        print(f"✗ La carpeta no existe: {args.folder}")
        exit(1)

    restore_all(folder=args.folder, table_filter=args.table)