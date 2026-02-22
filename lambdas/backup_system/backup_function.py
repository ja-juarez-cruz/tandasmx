"""
Lambda Function para Backup Automático de DynamoDB a S3

Este script realiza backups completos de tablas DynamoDB, comprime los datos
y los almacena en S3 con estructura organizada por fecha y ambiente.

Características:
- Backup dinámico de múltiples tablas configurables
- Compresión gzip para reducir costos de almacenamiento
- Validación de integridad con checksums SHA256
- Manejo de tipos Decimal de DynamoDB
- Generación de manifests para auditoría
- Notificaciones SNS de éxito/error

Variables de Entorno Requeridas:
- TABLES_CONFIG: JSON con configuración de tablas
- BACKUP_BUCKET: Nombre del bucket S3 destino
- ENVIRONMENT: Ambiente (production, staging, etc.)
- SNS_TOPIC_ARN: ARN del topic SNS para notificaciones

Autor: Jose - Senior SOA Architect
Versión: 1.0
"""

import boto3
import json
import gzip
import os
from datetime import datetime
from decimal import Decimal
import hashlib
import traceback

# Inicialización de clientes AWS
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')
sns = boto3.client('sns')

# Configuración desde variables de entorno
TABLES_CONFIG = json.loads(os.environ['TABLES_CONFIG'])
S3_BUCKET = os.environ['BACKUP_BUCKET']
ENVIRONMENT = os.environ.get('ENVIRONMENT', 'production')
SNS_TOPIC_ARN = os.environ.get('SNS_TOPIC_ARN')


class DecimalEncoder(json.JSONEncoder):
    """
    Encoder personalizado para convertir tipos Decimal de DynamoDB a JSON.
    
    DynamoDB usa Decimal para números, pero JSON no soporta este tipo.
    Este encoder convierte Decimal a int o float según corresponda.
    """
    def default(self, obj):
        if isinstance(obj, Decimal):
            # Convertir a int si es número entero, sino a float
            if obj % 1 == 0:
                return int(obj)
            return float(obj)
        return super(DecimalEncoder, self).default(obj)


def lambda_handler(event, context):
    """
    Handler principal de la función Lambda.
    
    Args:
        event (dict): Evento que dispara la función. Puede contener:
            - tables (list): Lista específica de tablas a respaldar (opcional)
            - date (str): Fecha del respaldo en formato YYYY-MM-DD (opcional)
        context: Contexto de ejecución de Lambda
    
    Returns:
        dict: Respuesta con statusCode y body conteniendo resultados del backup
    
    Ejemplo de event:
        {
            "date": "2025-01-24",
            "tables": [{"name": "tandas", "pk": "tandaId"}]
        }
    """
    
    # Determinar fecha del backup (usar fecha del evento o fecha actual)
    backup_date = event.get('date', datetime.now().strftime('%Y-%m-%d'))
    
    # Determinar tablas a respaldar (usar del evento o todas las configuradas)
    tables_to_backup = event.get('tables', TABLES_CONFIG)
    
    # Estructura para almacenar resultados
    results = {
        'date': backup_date,
        'environment': ENVIRONMENT,
        'tables': [],
        'errors': [],
        'start_time': datetime.now().isoformat()
    }
    
    try:
        # Procesar cada tabla configurada
        for table_config in tables_to_backup:
            try:
                result = backup_table(table_config, backup_date)
                results['tables'].append(result)
                print(f"✓ Respaldo completado: {table_config['name']}")
            except Exception as e:
                error_msg = f"Error en {table_config['name']}: {str(e)}"
                results['errors'].append(error_msg)
                print(f"✗ {error_msg}")
                # Continuar con las siguientes tablas aunque una falle
        
        results['end_time'] = datetime.now().isoformat()
        
        # Guardar manifest con resumen del backup
        save_manifest(results, backup_date)
        
        # Enviar notificación del resultado
        send_notification(results)
        
        # Determinar código de estado HTTP
        # 200: Todo exitoso
        # 207: Multi-Status (algunas tablas fallaron)
        status_code = 200 if not results['errors'] else 207
        
        return {
            'statusCode': status_code,
            'body': json.dumps(results, cls=DecimalEncoder, indent=2)
        }
        
    except Exception as e:
        # Error crítico que impide completar el backup
        error_details = {
            'error': str(e),
            'traceback': traceback.format_exc()
        }
        results['critical_error'] = error_details
        results['end_time'] = datetime.now().isoformat()
        
        send_notification(results, critical=True)
        
        return {
            'statusCode': 500,
            'body': json.dumps(results, cls=DecimalEncoder, indent=2)
        }


def backup_table(table_config, backup_date):
    """
    Realiza el backup completo de una tabla DynamoDB.
    
    Args:
        table_config (dict): Configuración de la tabla con estructura:
            {
                "name": "nombre_tabla",
                "pk": "clave_particion",
                "sk": "clave_ordenamiento" (opcional),
                "attributes": ["attr1", "attr2"] (opcional)
            }
        backup_date (str): Fecha del backup en formato YYYY-MM-DD
    
    Returns:
        dict: Metadata del backup incluyendo:
            - table_name: Nombre de la tabla
            - item_count: Cantidad de items respaldados
            - s3_key: Ubicación del archivo en S3
            - checksum: Hash SHA256 para validación
            - tamaños comprimido y sin comprimir
    
    Process Flow:
        1. Scan completo de la tabla con paginación
        2. Construcción de metadata
        3. Serialización a JSON con encoder personalizado
        4. Compresión gzip
        5. Cálculo de checksum
        6. Upload a S3 con metadata
    """
    table_name = table_config['name']
    table = dynamodb.Table(table_name)
    
    # === PASO 1: Scan de la tabla con paginación ===
    items = []
    scan_kwargs = {}
    
    # Si se especifican atributos específicos, crear ProjectionExpression
    if table_config.get('attributes'):
        scan_kwargs['ProjectionExpression'] = ','.join(table_config['attributes'])
    
    # Variables para manejar paginación
    done = False
    start_key = None
    item_count = 0
    
    print(f"Iniciando scan de tabla {table_name}...")
    
    # Loop de paginación (DynamoDB limita a 1MB por scan)
    while not done:
        if start_key:
            scan_kwargs['ExclusiveStartKey'] = start_key
        
        response = table.scan(**scan_kwargs)
        batch_items = response.get('Items', [])
        items.extend(batch_items)
        item_count += len(batch_items)
        
        # Obtener clave para siguiente página
        start_key = response.get('LastEvaluatedKey', None)
        done = start_key is None
        
        print(f"  Scaneados {item_count} items...")
    
    print(f"Scan completo: {item_count} items totales")
    
    # === PASO 2: Construir metadata del backup ===
    metadata = {
        'table_name': table_name,
        'backup_date': backup_date,
        'item_count': item_count,
        'environment': ENVIRONMENT,
        'pk': table_config.get('pk'),
        'sk': table_config.get('sk'),
        'region': os.environ.get('AWS_REGION', 'us-east-1'),
        'timestamp': datetime.now().isoformat(),
        'lambda_request_id': os.environ.get('AWS_REQUEST_ID', 'manual')
    }
    
    # === PASO 3: Preparar estructura de datos completa ===
    backup_data = {
        'metadata': metadata,
        'items': items
    }
    
    # === PASO 4: Serializar a JSON con encoder personalizado ===
    print(f"Serializando datos a JSON...")
    json_data = json.dumps(backup_data, cls=DecimalEncoder, ensure_ascii=False)
    
    # === PASO 5: Comprimir con gzip ===
    print(f"Comprimiendo datos...")
    compressed_data = gzip.compress(json_data.encode('utf-8'))
    
    # === PASO 6: Calcular checksum para validación ===
    checksum = hashlib.sha256(compressed_data).hexdigest()
    metadata['checksum'] = checksum
    metadata['compressed_size'] = len(compressed_data)
    metadata['uncompressed_size'] = len(json_data)
    
    # Calcular ratio de compresión
    compression_ratio = (1 - len(compressed_data) / len(json_data)) * 100
    metadata['compression_ratio'] = round(compression_ratio, 2)
    
    print(f"Compresión: {compression_ratio:.2f}% reducción")
    
    # === PASO 7: Determinar ruta en S3 ===
    # Estructura: environment/year/week-NN/table-date.json.gz
    year = backup_date.split('-')[0]
    week = datetime.strptime(backup_date, '%Y-%m-%d').strftime('%W')
    s3_key = f"{ENVIRONMENT}/{year}/week-{week}/{table_name}-{backup_date}.json.gz"
    
    # === PASO 8: Subir a S3 con metadata ===
    print(f"Subiendo a S3: {s3_key}")
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=s3_key,
        Body=compressed_data,
        ContentType='application/gzip',
        Metadata={
            'table-name': table_name,
            'backup-date': backup_date,
            'item-count': str(item_count),
            'checksum': checksum,
            'compression-ratio': str(compression_ratio)
        },
        StorageClass='STANDARD',
        ServerSideEncryption='AES256'
    )
    
    print(f"✓ Backup completado exitosamente")
    
    # Retornar resumen del backup
    return {
        'table_name': table_name,
        'item_count': item_count,
        's3_key': s3_key,
        's3_bucket': S3_BUCKET,
        'checksum': checksum,
        'size_compressed_mb': round(len(compressed_data) / 1024 / 1024, 2),
        'size_uncompressed_mb': round(len(json_data) / 1024 / 1024, 2),
        'compression_ratio': compression_ratio
    }


def save_manifest(results, backup_date):
    """
    Guarda un manifest JSON con el resumen completo del backup.
    
    El manifest es útil para:
    - Auditoría de backups realizados
    - Recuperación rápida de metadata sin descargar archivos
    - Validación de completitud de backups
    
    Args:
        results (dict): Diccionario con resultados del backup
        backup_date (str): Fecha del backup
    
    La ruta del manifest sigue la estructura:
    environment/metadata/year/week-NN/manifest-date.json
    """
    year = backup_date.split('-')[0]
    week = datetime.strptime(backup_date, '%Y-%m-%d').strftime('%W')
    manifest_key = f"{ENVIRONMENT}/metadata/{year}/week-{week}/manifest-{backup_date}.json"
    
    print(f"Guardando manifest: {manifest_key}")
    
    s3.put_object(
        Bucket=S3_BUCKET,
        Key=manifest_key,
        Body=json.dumps(results, cls=DecimalEncoder, indent=2),
        ContentType='application/json',
        ServerSideEncryption='AES256'
    )


def send_notification(results, critical=False):
    """
    Envía notificación SNS con el resultado del backup.
    
    Args:
        results (dict): Resultados del proceso de backup
        critical (bool): Si True, indica error crítico que requiere atención inmediata
    
    La notificación incluye:
    - Estado general (éxito/parcial/error)
    - Resumen de tablas procesadas
    - Detalles de errores si los hay
    - Enlaces a manifests y logs
    """
    if not SNS_TOPIC_ARN:
        print("SNS_TOPIC_ARN no configurado, omitiendo notificación")
        return
    
    # Determinar estado y asunto del mensaje
    if critical or results.get('critical_error'):
        status = "❌ ERROR CRÍTICO"
        subject = f"[CRÍTICO] Fallo en backup DynamoDB - {ENVIRONMENT}"
    elif results['errors']:
        status = "⚠️ PARCIALMENTE EXITOSO"
        subject = f"[ADVERTENCIA] Backup DynamoDB parcial - {ENVIRONMENT}"
    else:
        status = "✅ EXITOSO"
        subject = f"[OK] Backup DynamoDB completado - {ENVIRONMENT}"
    
    # Construir resumen de tablas
    tables_summary = []
    for table_result in results.get('tables', []):
        tables_summary.append(
            f"  • {table_result['table_name']}: "
            f"{table_result['item_count']} items "
            f"({table_result['size_compressed_mb']} MB comprimido)"
        )
    
    # Construir mensaje
    message_parts = [
        f"Estado: {status}",
        f"Ambiente: {ENVIRONMENT}",
        f"Fecha backup: {results['date']}",
        f"Hora inicio: {results.get('start_time', 'N/A')}",
        f"Hora fin: {results.get('end_time', 'N/A')}",
        "",
        f"Tablas procesadas ({len(results.get('tables', []))}):",
        *tables_summary,
    ]
    
    # Agregar errores si existen
    if results['errors']:
        message_parts.extend([
            "",
            f"Errores ({len(results['errors'])}):",
            *[f"  • {error}" for error in results['errors']]
        ])
    
    # Agregar error crítico si existe
    if results.get('critical_error'):
        message_parts.extend([
            "",
            "ERROR CRÍTICO:",
            f"  {results['critical_error']['error']}",
            "",
            "Ver CloudWatch Logs para detalles completos."
        ])
    
    # Agregar información de ubicación
    if results.get('tables'):
        year = results['date'].split('-')[0]
        week = datetime.strptime(results['date'], '%Y-%m-%d').strftime('%W')
        message_parts.extend([
            "",
            f"Bucket S3: {S3_BUCKET}",
            f"Ruta: {ENVIRONMENT}/{year}/week-{week}/",
        ])
    
    message = "\n".join(message_parts)
    
    # Publicar a SNS
    try:
        sns.publish(
            TopicArn=SNS_TOPIC_ARN,
            Subject=subject,
            Message=message
        )
        print("✓ Notificación SNS enviada")
    except Exception as e:
        print(f"✗ Error enviando notificación SNS: {str(e)}")