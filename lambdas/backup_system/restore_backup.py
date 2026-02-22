"""
Script de Restauración de Backups DynamoDB desde S3

Este script permite restaurar backups de DynamoDB almacenados en S3,
con soporte para cross-region y cross-account migrations.

Características:
- Restauración de múltiples tablas desde un backup específico
- Validación de integridad con checksums
- Modo dry-run para validar antes de restaurar
- Soporte para cross-region restore
- Soporte para cross-account restore
- Batch writes optimizados
- Manejo robusto de errores
- Logging detallado del proceso

Uso:
    # Listar backups disponibles
    python restore_dynamodb.py --bucket BUCKET --list-backups --tables CONFIG
    
    # Dry run (validar sin restaurar)
    python restore_dynamodb.py --bucket BUCKET --date 2025-01-24 --tables CONFIG --dry-run
    
    # Restaurar en misma región
    python restore_dynamodb.py --bucket BUCKET --date 2025-01-24 --tables CONFIG
    
    # Restaurar a otra región
    python restore_dynamodb.py --bucket BUCKET --date 2025-01-24 --tables CONFIG \
        --source-region us-east-1 --target-region us-west-2

Autor: Jose - Senior SOA Architect
Versión: 1.0
"""

import boto3
import json
import gzip
import argparse
from datetime import datetime
from decimal import Decimal
import hashlib
from botocore.exceptions import ClientError
import sys
import time


class DynamoDBRestore:
    """
    Clase principal para manejar restauración de backups DynamoDB.
    
    Esta clase encapsula toda la lógica necesaria para:
    - Descargar backups desde S3
    - Validar integridad de datos
    - Restaurar datos a DynamoDB
    - Manejar cross-region/cross-account scenarios
    """
    
    def __init__(self, source_bucket, source_region='us-east-1', 
                 target_region='us-east-1', target_account=None):
        """
        Inicializa el objeto de restauración.
        
        Args:
            source_bucket (str): Bucket S3 donde están los backups
            source_region (str): Región AWS del bucket S3
            target_region (str): Región AWS donde restaurar las tablas
            target_account (str): Account ID destino para cross-account restore
        """
        self.source_bucket = source_bucket
        self.source_region = source_region
        self.target_region = target_region
        
        # Cliente S3 para leer backups
        self.s3_client = boto3.client('s3', region_name=source_region)
        
        # Configurar cliente DynamoDB según el escenario
        if target_account:
            # === Escenario Cross-Account ===
            # Requiere IAM role configurado en cuenta destino
            print(f"🔐 Configurando acceso cross-account a cuenta {target_account}")
            
            sts = boto3.client('sts')
            assumed_role = sts.assume_role(
                RoleArn=f"arn:aws:iam::{target_account}:role/DynamoDBRestoreRole",
                RoleSessionName="RestoreSession"
            )
            credentials = assumed_role['Credentials']
            
            self.dynamodb = boto3.resource(
                'dynamodb',
                region_name=target_region,
                aws_access_key_id=credentials['AccessKeyId'],
                aws_secret_access_key=credentials['SecretAccessKey'],
                aws_session_token=credentials['SessionToken']
            )
        else:
            # === Escenario Same-Account ===
            self.dynamodb = boto3.resource('dynamodb', region_name=target_region)
    
    def list_available_backups(self, environment='production', table_name=None):
        """
        Lista todos los backups disponibles en S3.
        
        Args:
            environment (str): Ambiente del cual listar backups
            table_name (str): Filtrar por nombre de tabla (opcional)
        
        Returns:
            list: Lista de backups disponibles con metadata
        """
        prefix = f"{environment}/"
        
        print(f"📋 Buscando backups en {self.source_bucket}/{prefix}")
        
        # Listar objetos en S3
        paginator = self.s3_client.get_paginator('list_objects_v2')
        pages = paginator.paginate(Bucket=self.source_bucket, Prefix=prefix)
        
        backups = []
        for page in pages:
            for obj in page.get('Contents', []):
                key = obj['Key']
                
                # Filtrar solo archivos de backup comprimidos
                if key.endswith('.json.gz'):
                    # Aplicar filtro de tabla si se especificó
                    if table_name is None or table_name in key:
                        backups.append({
                            'key': key,
                            'size': obj['Size'],
                            'size_mb': round(obj['Size'] / 1024 / 1024, 2),
                            'last_modified': obj['LastModified'].isoformat(),
                            'storage_class': obj.get('StorageClass', 'STANDARD')
                        })
        
        # Ordenar por fecha (más recientes primero)
        return sorted(backups, key=lambda x: x['last_modified'], reverse=True)
    
    def download_and_validate_backup(self, s3_key):
        """
        Descarga un backup desde S3 y valida su integridad.
        
        Args:
            s3_key (str): Key del objeto en S3
        
        Returns:
            dict: Datos del backup deserializados
        
        Raises:
            ValueError: Si el checksum no coincide
            
        Process:
            1. Descargar archivo comprimido de S3
            2. Validar checksum SHA256
            3. Descomprimir gzip
            4. Parsear JSON
            5. Retornar datos validados
        """
        print(f"📥 Descargando backup: {s3_key}")
        
        start_time = time.time()
        
        # === PASO 1: Descargar objeto desde S3 ===
        try:
            response = self.s3_client.get_object(
                Bucket=self.source_bucket,
                Key=s3_key
            )
        except ClientError as e:
            if e.response['Error']['Code'] == 'NoSuchKey':
                raise ValueError(f"❌ Backup no encontrado: {s3_key}")
            raise
        
        compressed_data = response['Body'].read()
        download_time = time.time() - start_time
        
        print(f"   ✓ Descargado: {len(compressed_data) / 1024 / 1024:.2f} MB "
              f"en {download_time:.2f}s")
        
        # === PASO 2: Validar checksum si existe ===
        stored_checksum = response.get('Metadata', {}).get('checksum')
        if stored_checksum:
            calculated_checksum = hashlib.sha256(compressed_data).hexdigest()
            
            if stored_checksum != calculated_checksum:
                raise ValueError(
                    f"❌ Checksum inválido.\n"
                    f"   Esperado: {stored_checksum}\n"
                    f"   Calculado: {calculated_checksum}"
                )
            print(f"   ✓ Checksum validado: {calculated_checksum[:16]}...")
        else:
            print("   ⚠️  No hay checksum en metadata, omitiendo validación")
        
        # === PASO 3: Descomprimir ===
        print("   Descomprimiendo...")
        decompress_start = time.time()
        json_data = gzip.decompress(compressed_data).decode('utf-8')
        decompress_time = time.time() - decompress_start
        
        print(f"   ✓ Descomprimido: {len(json_data) / 1024 / 1024:.2f} MB "
              f"en {decompress_time:.2f}s")
        
        # === PASO 4: Parsear JSON ===
        backup_data = json.loads(json_data)
        
        # Mostrar metadata del backup
        metadata = backup_data.get('metadata', {})
        print(f"\n   📊 Metadata del backup:")
        print(f"      Tabla: {metadata.get('table_name')}")
        print(f"      Fecha: {metadata.get('backup_date')}")
        print(f"      Items: {metadata.get('item_count')}")
        print(f"      Región origen: {metadata.get('region')}")
        
        return backup_data
    
    def restore_table(self, backup_data, target_table_name=None, 
                     dry_run=False, batch_size=25):
        """
        Restaura una tabla desde datos de backup.
        
        Args:
            backup_data (dict): Datos deserializados del backup
            target_table_name (str): Nombre destino (None = usar nombre original)
            dry_run (bool): Si True, solo valida sin escribir a DynamoDB
            batch_size (int): Tamaño de batch para batch_write (max 25)
        
        Returns:
            dict: Resultado de la restauración con estadísticas
        
        Process:
            1. Extraer metadata y validar
            2. En dry_run: solo mostrar lo que se haría
            3. En producción: escribir items en batches a DynamoDB
            4. Manejar errores y reintentos
            5. Retornar estadísticas
        """
        metadata = backup_data['metadata']
        items = backup_data['items']
        
        source_table = metadata['table_name']
        table_name = target_table_name or source_table
        
        # === Mostrar información de la restauración ===
        print(f"\n{'=' * 70}")
        print(f"{'🔍 DRY RUN - ' if dry_run else '📝 '}Restaurando tabla: {table_name}")
        print(f"{'=' * 70}")
        print(f"  Tabla origen:     {source_table}")
        print(f"  Items a restaurar: {metadata['item_count']}")
        print(f"  Fecha del backup:  {metadata['backup_date']}")
        print(f"  Región origen:     {metadata.get('region', 'N/A')}")
        print(f"  Región destino:    {self.target_region}")
        
        # === Modo DRY RUN ===
        if dry_run:
            print(f"\n✓ Validación exitosa. {len(items)} items listos para restaurar.")
            print(f"\n  Preview de primeros 3 items:")
            for i, item in enumerate(items[:3], 1):
                item_str = json.dumps(item, default=str, ensure_ascii=False)
                preview = item_str[:100] + '...' if len(item_str) > 100 else item_str
                print(f"    {i}. {preview}")
            
            return {
                'dry_run': True,
                'table_name': table_name,
                'items_to_restore': len(items),
                'validation': 'passed'
            }
        
        # === Modo PRODUCCIÓN ===
        
        # Verificar que la tabla destino existe
        print(f"\n🔍 Verificando tabla destino...")
        try:
            table = self.dynamodb.Table(table_name)
            table.load()
            print(f"   ✓ Tabla {table_name} encontrada")
        except ClientError as e:
            if e.response['Error']['Code'] == 'ResourceNotFoundException':
                raise ValueError(
                    f"❌ Tabla {table_name} no existe en región {self.target_region}\n"
                    f"   Crear la tabla antes de restaurar."
                )
            raise
        
        # === Restaurar items en batches ===
        print(f"\n📝 Iniciando escritura de items (batch size: {batch_size})...")
        
        restored_count = 0
        failed_items = []
        total_batches = (len(items) + batch_size - 1) // batch_size
        
        for batch_num in range(0, len(items), batch_size):
            batch = items[batch_num:batch_num + batch_size]
            batch_index = batch_num // batch_size + 1
            
            try:
                # Usar batch_writer para escritura eficiente
                with table.batch_writer() as writer:
                    for item in batch:
                        # Convertir floats a Decimal (requerido por DynamoDB)
                        converted_item = self._convert_floats_to_decimal(item)
                        writer.put_item(Item=converted_item)
                        restored_count += 1
                
                # Mostrar progreso
                progress = (restored_count / len(items)) * 100
                print(f"   ✓ Batch {batch_index}/{total_batches}: "
                      f"{len(batch)} items | "
                      f"Total: {restored_count}/{len(items)} ({progress:.1f}%)")
                
                # Pequeña pausa para no saturar DynamoDB
                if batch_index % 10 == 0:
                    time.sleep(0.1)
                
            except Exception as e:
                print(f"   ❌ Error en batch {batch_index}: {str(e)}")
                failed_items.extend(batch)
                # Continuar con siguiente batch
        
        # === Generar resultado ===
        result = {
            'table_name': table_name,
            'total_items': len(items),
            'restored_items': restored_count,
            'failed_items': len(failed_items),
            'success_rate': round((restored_count / len(items)) * 100, 2)
        }
        
        # Guardar items fallidos si los hay
        if failed_items:
            failed_file = f'failed_items_{table_name}_{datetime.now().strftime("%Y%m%d_%H%M%S")}.json'
            print(f"\n⚠️  {len(failed_items)} items fallaron.")
            print(f"   Guardando en: {failed_file}")
            
            with open(failed_file, 'w', encoding='utf-8') as f:
                json.dump(failed_items, f, indent=2, default=str, ensure_ascii=False)
        
        return result
    
    def restore_from_date(self, backup_date, tables_config, 
                         environment='production', dry_run=False):
        """
        Restaura todas las tablas configuradas de una fecha específica.
        
        Args:
            backup_date (str): Fecha del backup (YYYY-MM-DD)
            tables_config (list): Lista de configuraciones de tablas
            environment (str): Ambiente del backup
            dry_run (bool): Modo validación sin escritura
        
        Returns:
            dict: Resumen completo de la restauración de todas las tablas
        """
        # Calcular ubicación de los backups
        year = backup_date.split('-')[0]
        week = datetime.strptime(backup_date, '%Y-%m-%d').strftime('%W')
        
        results = {
            'backup_date': backup_date,
            'environment': environment,
            'dry_run': dry_run,
            'tables': [],
            'errors': [],
            'start_time': datetime.now().isoformat()
        }
        
        print(f"\n{'=' * 70}")
        print(f"🚀 Restauración Multi-Tabla")
        print(f"{'=' * 70}")
        print(f"Fecha:      {backup_date}")
        print(f"Ambiente:   {environment}")
        print(f"Tablas:     {len(tables_config)}")
        print(f"Modo:       {'DRY RUN' if dry_run else 'PRODUCCIÓN'}")
        
        # Procesar cada tabla
        for i, table_config in enumerate(tables_config, 1):
            table_name = table_config['name']
            s3_key = f"{environment}/{year}/week-{week}/{table_name}-{backup_date}.json.gz"
            
            try:
                print(f"\n{'=' * 70}")
                print(f"[{i}/{len(tables_config)}] Procesando: {table_name}")
                print(f"{'=' * 70}")
                
                # Descargar y validar backup
                backup_data = self.download_and_validate_backup(s3_key)
                
                # Restaurar tabla
                result = self.restore_table(
                    backup_data,
                    target_table_name=table_config.get('target_name'),
                    dry_run=dry_run
                )
                results['tables'].append(result)
                
            except Exception as e:
                error_msg = f"Error restaurando {table_name}: {str(e)}"
                results['errors'].append(error_msg)
                print(f"\n❌ {error_msg}\n")
                # Continuar con siguiente tabla
        
        results['end_time'] = datetime.now().isoformat()
        
        return results
    
    def _convert_floats_to_decimal(self, obj):
        """
        Convierte floats a Decimal recursivamente.
        
        DynamoDB requiere tipo Decimal para números, no float.
        Esta función recorre estructuras nested y convierte todos los floats.
        
        Args:
            obj: Objeto a convertir (puede ser dict, list, float, etc.)
        
        Returns:
            Objeto con floats convertidos a Decimal
        """
        if isinstance(obj, list):
            return [self._convert_floats_to_decimal(item) for item in obj]
        elif isinstance(obj, dict):
            return {k: self._convert_floats_to_decimal(v) for k, v in obj.items()}
        elif isinstance(obj, float):
            return Decimal(str(obj))
        return obj


def main():
    """
    Punto de entrada del script.
    Maneja argumentos de línea de comandos y ejecuta la restauración.
    """
    parser = argparse.ArgumentParser(
        description='Restaurar backups de DynamoDB desde S3',
        formatter_class=argparse.RawDescriptionHelpFormatter,
        epilog="""
Ejemplos de uso:

  # Listar backups disponibles
  python restore_dynamodb.py --bucket tandas-backups-prod-123 --list-backups --tables config.json

  # Validar sin restaurar (dry run)
  python restore_dynamodb.py --bucket tandas-backups-prod-123 --date 2025-01-24 --tables config.json --dry-run

  # Restaurar en misma región
  python restore_dynamodb.py --bucket tandas-backups-prod-123 --date 2025-01-24 --tables config.json

  # Restaurar a otra región
  python restore_dynamodb.py --bucket tandas-backups-prod-123 --date 2025-01-24 \\
      --source-region us-east-1 --target-region us-west-2 --tables config.json

  # Restaurar a otra cuenta AWS
  python restore_dynamodb.py --bucket tandas-backups-prod-123 --date 2025-01-24 \\
      --target-account 987654321098 --tables config.json
        """
    )
    
    parser.add_argument('--bucket', required=True, 
                       help='Bucket S3 con los backups')
    parser.add_argument('--date', 
                       help='Fecha del backup (YYYY-MM-DD)')
    parser.add_argument('--environment', default='production', 
                       help='Ambiente (production, staging, etc.)')
    parser.add_argument('--source-region', default='us-east-1', 
                       help='Región origen de los backups')
    parser.add_argument('--target-region', default='us-east-1', 
                       help='Región destino para restaurar')
    parser.add_argument('--target-account', 
                       help='Account ID destino (para cross-account)')
    parser.add_argument('--tables', required=True, 
                       help='Archivo JSON con configuración de tablas')
    parser.add_argument('--dry-run', action='store_true', 
                       help='Validar sin restaurar')
    parser.add_argument('--list-backups', action='store_true', 
                       help='Listar backups disponibles')
    
    args = parser.parse_args()
    
    # Cargar configuración de tablas desde archivo
    try:
        with open(args.tables, 'r') as f:
            tables_config = json.load(f)
    except FileNotFoundError:
        # Si no es archivo, intentar parsear como JSON directo
        tables_config = json.loads(args.tables)
    
    # Inicializar objeto de restauración
    restore = DynamoDBRestore(
        source_bucket=args.bucket,
        source_region=args.source_region,
        target_region=args.target_region,
        target_account=args.target_account
    )
    
    # === Modo: Listar Backups ===
    if args.list_backups:
        print(f"\n{'=' * 70}")
        print(f"📋 Backups Disponibles en {args.bucket}")
        print(f"{'=' * 70}\n")
        
        for table_config in tables_config:
            backups = restore.list_available_backups(
                environment=args.environment,
                table_name=table_config['name']
            )
            
            print(f"\n{table_config['name']} ({len(backups)} backups):")
            print("-" * 70)
            
            # Mostrar últimos 5 backups
            for backup in backups[:5]:
                print(f"  📦 {backup['key']}")
                print(f"     Tamaño: {backup['size_mb']} MB | "
                      f"Fecha: {backup['last_modified']}")
                print(f"     Storage: {backup['storage_class']}")
                print()
        
        return
    
    # === Validar que se proporcionó fecha ===
    if not args.date:
        parser.error("--date es requerido para restaurar (excepto con --list-backups)")
    
    # === Modo: Restaurar ===
    print(f"\n{'=' * 70}")
    print(f"🚀 Sistema de Restauración DynamoDB")
    print(f"{'=' * 70}")
    print(f"Bucket:          {args.bucket}")
    print(f"Fecha backup:    {args.date}")
    print(f"Ambiente:        {args.environment}")
    print(f"Región origen:   {args.source_region}")
    print(f"Región destino:  {args.target_region}")
    if args.target_account:
        print(f"Cuenta destino:  {args.target_account}")
    print(f"Modo:            {'DRY RUN ✓' if args.dry_run else 'PRODUCCIÓN ⚠️'}")
    
    # Confirmar en modo producción
    if not args.dry_run:
        print(f"\n⚠️  ADVERTENCIA: Esto escribirá datos a DynamoDB.")
        response = input("¿Continuar? (yes/no): ")
        if response.lower() != 'yes':
            print("Operación cancelada.")
            sys.exit(0)
    
    # Ejecutar restauración
    try:
        results = restore.restore_from_date(
            backup_date=args.date,
            tables_config=tables_config,
            environment=args.environment,
            dry_run=args.dry_run
        )
        
        # === Resumen Final ===
        print(f"\n{'=' * 70}")
        print(f"📊 RESUMEN DE RESTAURACIÓN")
        print(f"{'=' * 70}")
        print(f"Inicio:  {results['start_time']}")
        print(f"Fin:     {results['end_time']}")
        print(f"Tablas procesadas: {len(results['tables'])}")
        print(f"Errores: {len(results['errors'])}")
        
        # Detalles por tabla
        for table_result in results['tables']:
            print(f"\n📋 {table_result['table_name']}:")
            if table_result.get('dry_run'):
                print(f"   ✓ Validación OK - {table_result['items_to_restore']} items")
            else:
                print(f"   Items: {table_result['restored_items']}/{table_result['total_items']}")
                print(f"   Éxito: {table_result['success_rate']}%")
                if table_result['failed_items'] > 0:
                    print(f"   ⚠️  Fallidos: {table_result['failed_items']}")
        
        # Mostrar errores
        if results['errors']:
            print(f"\n❌ Errores encontrados:")
            for error in results['errors']:
                print(f"   • {error}")
            sys.exit(1)
        
        print(f"\n{'=' * 70}")
        print("✅ Proceso completado exitosamente")
        print(f"{'=' * 70}\n")
        
    except Exception as e:
        print(f"\n❌ Error crítico: {str(e)}")
        import traceback
        traceback.print_exc()
        sys.exit(1)


if __name__ == '__main__':
    main()