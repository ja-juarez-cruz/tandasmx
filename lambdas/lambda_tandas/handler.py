# ========================================
# LAMBDA: tandas_handler.py
# Maneja CRUD de tandas
# ========================================

import json
import boto3
import os
import jwt
from datetime import datetime, timedelta, timezone, date
from decimal import Decimal
from boto3.dynamodb.conditions import Key
import uuid
import calendar


#custom error
from exception.custom_http_exception import CustomError
from exception.custom_http_exception import CustomClientError

dynamodb = boto3.resource('dynamodb')
tandas_table = dynamodb.Table(os.environ['TANDAS_TABLE'])
usuarios_table = dynamodb.Table(os.environ['USUARIOS_TABLE'])
participantes_table = dynamodb.Table(os.environ['PARTICIPANTES_TABLE'])
pagos_table = dynamodb.Table(os.environ['PAGOS_TABLE'])
notificaciones_table = dynamodb.Table('notificaciones')
LINKS_TABLE = 'links_registro'

JWT_SECRET = os.environ['JWT_SECRET']

# Utilidades
def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Content-Type': 'application/json'
    }

def decimal_default(obj):
    if isinstance(obj, Decimal):
        return float(obj)
    raise TypeError

def response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': cors_headers(),
        'body': json.dumps(body, cls=DecimalEncoder)
    }

class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return int(obj) if obj % 1 == 0 else float(obj)
        return super(DecimalEncoder, self).default(obj)

def calcular_fecha_inicio(fecha_str: str) -> str:
    """
    Regla:
    - Día 1–15  → día 15 del mismo mes
    - Día > 15 → último día del mes

    fecha_str: 'YYYY-MM-DD'
    return: 'YYYY-MM-DD'
    """
    fecha = datetime.strptime(fecha_str, "%Y-%m-%d").date()
    dia = fecha.day

    if dia <= 15:
        fecha_inicio = date(fecha.year, fecha.month, 15)
    else:
        ultimo_dia = calendar.monthrange(fecha.year, fecha.month)[1]
        fecha_inicio = date(fecha.year, fecha.month, ultimo_dia)

    return fecha_inicio.isoformat()

def extract_user_id(event):
    """Extrae el userId del token JWT"""
    try:
        auth_header = event['headers'].get('Authorization') or event['headers'].get('authorization')
        if not auth_header:
            return None
        
        token = auth_header.replace('Bearer ', '')
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        return payload['id']
    except:
        return None

def generate_short_id():
    """Genera un ID corto único"""
    import random
    import string
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=9))

def eliminar_participantes(tanda_id):
    """Elimina todos los participantes de una tanda"""
    try:
        print(f"🔄 Eliminando participantes de tanda: {tanda_id}")
        
        # Buscar todos los participantes
        resultado = participantes_table.query(
            KeyConditionExpression=Key('id').eq(tanda_id)
        )
        
        participantes = resultado.get('Items', [])
        count = len(participantes)
        
        if count == 0:
            print(f"✓ No hay participantes que eliminar")
            return 0
        
        # Eliminar cada participante
        for participante in participantes:
            participantes_table.delete_item(
                Key={
                    'id': tanda_id,
                    'participanteId': participante['participanteId']
                }
            )
        
        print(f"✓ {count} participantes eliminados")
        return count
        
    except Exception as e:
        print(f"❌ Error eliminando participantes: {str(e)}")
        raise


def eliminar_pagos(tanda_id):
    """Elimina todos los pagos de una tanda"""
    try:
        print(f"🔄 Eliminando pagos de tanda: {tanda_id}")
        
        # Buscar todos los pagos
        resultado = pagos_table.query(
            KeyConditionExpression=Key('id').eq(tanda_id)
        )
        
        pagos = resultado.get('Items', [])
        count = len(pagos)
        
        if count == 0:
            print(f"✓ No hay pagos que eliminar")
            return 0
        
        # Eliminar cada pago
        for pago in pagos:
            pagos_table.delete_item(
                Key={
                    'id': tanda_id,
                    'pagoId': pago['pagoId']
                }
            )
        
        print(f"✓ {count} pagos eliminados")
        return count
        
    except Exception as e:
        print(f"❌ Error eliminando pagos: {str(e)}")
        raise


def eliminar_notificaciones(tanda_id):
    """Elimina todas las notificaciones de una tanda"""
    try:
        print(f"🔄 Eliminando notificaciones de tanda: {tanda_id}")
        
        # Buscar todas las notificaciones
        resultado = notificaciones_table.query(
            KeyConditionExpression=Key('id').eq(tanda_id)
        )
        
        notificaciones = resultado.get('Items', [])
        count = len(notificaciones)
        
        if count == 0:
            print(f"✓ No hay notificaciones que eliminar")
            return 0
        
        # Eliminar cada notificación
        for notificacion in notificaciones:
            notificaciones_table.delete_item(
                Key={
                    'id': tanda_id
                }
            )
        
        print(f"✓ {count} notificaciones eliminadas")
        return count
        
    except Exception as e:
        print(f"❌ Error eliminando notificaciones: {str(e)}")
        raise


def actualizar_usuario_admin(user_id, tanda_id):
    """Elimina la referencia de la tanda del array de tandas del usuario"""
    try:
        print(f"🔄 Actualizando usuario: {user_id}")
        
        # Obtener usuario actual
        resultado = usuarios_table.get_item(
            Key={'id': user_id}
        )
        
        if 'Item' not in resultado:
            print(f"⚠️ Usuario no encontrado: {user_id}")
            return False
        
        usuario = resultado['Item']
        tandas = usuario.get('tandas', [])
        
        # Remover tanda del array
        if tanda_id in tandas:
            tandas.remove(tanda_id)
            
            # Actualizar usuario
            usuarios_table.update_item(
                Key={'id': user_id},
                UpdateExpression='SET tandas = :tandas, updatedAt = :updated',
                ExpressionAttributeValues={
                    ':tandas': tandas,
                    ':updated': datetime.utcnow().isoformat()
                }
            )
            
            print(f"✓ Usuario actualizado. Tandas restantes: {len(tandas)}")
            return True
        else:
            print(f"⚠️ Tanda no encontrada en el array del usuario")
            return False
            
    except Exception as e:
        print(f"❌ Error actualizando usuario: {str(e)}")
        raise


def eliminar_tanda(tanda_id):
    """Elimina la tanda de la tabla principal"""
    try:
        print(f"🔄 Eliminando tanda: {tanda_id}")
        
        # Primero verificar que existe
        resultado = tandas_table.get_item(
            Key={'id': tanda_id}
        )
        
        if 'Item' not in resultado:
            print(f"⚠️ Tanda no encontrada: {tanda_id}")
            return False
        
        # Eliminar tanda
        tandas_table.delete_item(
            Key={'id': tanda_id}
        )
        
        print(f"✓ Tanda eliminada")
        return True
        
    except Exception as e:
        print(f"❌ Error eliminando tanda: {str(e)}")
        raise

# ========================================
# HANDLER: CREAR TANDA
# ========================================
def crear(event, context):
    try:
        user_id = extract_user_id(event)
        if not user_id:
            return response(401, {
                'success': False,
                'error': {
                    'code': 'UNAUTHORIZED',
                    'message': 'Token inválido o expirado'
                }
            })
        
        body = json.loads(event['body'])
        
        # Validar campos requeridos
        if not body.get('nombre') or not body.get('montoPorRonda') or not body.get('totalRondas'):
            return response(400, {
                'success': False,
                'error': {
                    'code': 'MISSING_REQUIRED_FIELDS',
                    'message': 'Faltan campos requeridos'
                }
            })
        
        # Generar ID único
        tanda_id = generate_short_id()
        timestamp = datetime.utcnow().isoformat()
        
        # Crear tanda
        if body['frecuencia']== 'quincenal':
            fechaInico = calcular_fecha_inicio(body.get('fechaInicio', timestamp.split('T')[0]))
        else:
            fechaInico = body.get('fechaInicio', timestamp.split('T')[0])
        tanda = {
            'id': tanda_id,
            'nombre': body['nombre'],
            'montoPorRonda': Decimal(str(body['montoPorRonda'])),
            'totalRondas': int(body['totalRondas']),
            'rondaActual': 1,
            'fechaInicio': fechaInico,
            'adminId': user_id,
            'configuracion': body.get('configuracion', {
                'recordatoriosDias': 3,
                'metodoPago': 'Transferencia / Efectivo'
            }),
            'status': 'active',
            'createdAt': timestamp,
            'updatedAt': timestamp,
            'frecuencia': body['frecuencia'],
            'diasRecordatorio': body['diasRecordatorio'],
            'metodoPago': body['metodoPago']
        }
        print(f'tanda a crear: {tanda}')
        
        # Guardar en DynamoDB
        tandas_table.put_item(Item=tanda)
        
        # Actualizar lista de tandas del usuario
        usuarios_table.update_item(
            Key={'id': user_id},
            UpdateExpression='SET tandas = list_append(if_not_exists(tandas, :empty_list), :tanda_id)',
            ExpressionAttributeValues={
                ':tanda_id': [tanda_id],
                ':empty_list': []
            }
        )
        
        app_url = os.environ.get('APP_URL', 'http://localhost:3000')
        tanda['tandaId'] = tanda_id
        
        return response(201, {
            'success': True,
            'data': {
                **tanda,
                'urlPublica': f"{app_url}?tanda={tanda_id}"
            }
        })
        
    except Exception as e:
        print(f"Error en crear tanda: {str(e)}")
        return response(500, {
            'success': False,
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': 'Error al crear la tanda'
            }
        })

# ========================================
# HANDLER: OBTENER TANDA (Público/Privado)
# ========================================
def obtener(event, context):
    try:
        tanda_id = event['pathParameters']['tandaId']
        
        # Obtener tanda
        result = tandas_table.get_item(Key={'id': tanda_id})
        print(f'result: {result}')
        
        if not result.get('Item'):
            return response(404, {
                'success': False,
                'error': {
                    'code': 'TANDA_NOT_FOUND',
                    'message': 'Tanda no encontrada'
                }
            })
        
        tanda = result['Item']
        
        # Obtener participantes
        participantes_result = participantes_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={':tandaId': tanda_id}
        )
        
        participantes = participantes_result.get('Items', [])
        
        # 3. Para cada participante, obtener sus pagos
        for participante in participantes:
            participante_id = participante['participanteId']
            
            # Consultar pagos del participante
            pagos_response = pagos_table.query(
                            KeyConditionExpression=
                                Key('id').eq(tanda_id) &
                                Key('pagoId').begins_with(participante_id)
                        )
            
            # Estructurar pagos por ronda
            pagos_por_ronda = {}
            for pago in pagos_response.get('Items', []):
                ronda = str(pago['ronda'])  # Convertir a string
                pagos_por_ronda[ronda] = {
                    'pagado': pago.get('pagado', False),
                    'fechaPago': pago.get('fechaPago', ''),
                    'monto': float(pago.get('monto', 0)),
                    'exentoPago': pago.get('exentoPago',False),
                    'metodoPago': pago.get('metodoPago'),
                    'notas': pago.get('notas')
                }
            
            # Agregar pagos al participante
            participante['pagos'] = pagos_por_ronda
        
        # 4. Agregar participantes a tanda
        tanda['participantes'] = participantes
        tanda['tandaId']=tanda_id
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'success': True,
                'data': tanda
            }, cls=DecimalEncoder)
        }
        
    except Exception as e:
        print(f"Error en obtener tanda: {str(e)}")
        return response(500, {
            'success': False,
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': 'Error al obtener la tanda'
            }
        })

# ========================================
# HANDLER: ACTUALIZAR TANDA
# ========================================
def actualizar(event, context):
    try:
        user_id = extract_user_id(event)
        if not user_id:
            return response(401, {
                'success': False,
                'error': {'code': 'UNAUTHORIZED', 'message': 'Token inválido'}
            })
        
        tanda_id = event['pathParameters']['tandaId']
        body = json.loads(event['body'])
        
        # Verificar permisos
        tanda = tandas_table.get_item(Key={'id': tanda_id})
        if not tanda.get('Item') or tanda['Item']['adminId'] != user_id:
            return response(403, {
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'Sin permisos'}
            })
        
        # Construir expresión de actualización
        update_expression = "SET updatedAt = :now"
        expression_values = {':now': datetime.utcnow().isoformat()}
        
        if 'nombre' in body:
            update_expression += ", nombre = :nombre"
            expression_values[':nombre'] = body['nombre']
        
        if 'rondaActual' in body:
            update_expression += ", rondaActual = :rondaActual"
            expression_values[':rondaActual'] = int(body['rondaActual'])

        if 'totalRondas' in body:
            update_expression += ", totalRondas = :totalRondas"
            expression_values[':totalRondas'] = int(body['totalRondas'])
        
        if 'montoPorRonda' in body:
            update_expression += ", montoPorRonda = :montoPorRonda"
            expression_values[':montoPorRonda'] = int(body['montoPorRonda'])
            
        if 'fechaInicio' in body:
            update_expression += ", fechaInicio = :fechaInicio"
            expression_values[':fechaInicio'] = body['fechaInicio']
        
        if 'configuracion' in body:
            update_expression += ", configuracion = :config"
            expression_values[':config'] = body['configuracion']
        
        # Actualizar
        tandas_table.update_item(
            Key={'id': tanda_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values
        )
        
        return response(200, {
            'success': True,
            'data': {
                'id': tanda_id,
                'tandaId': tanda_id,
                'updatedAt': expression_values[':now']
            }
        })
        
    except Exception as e:
        print(f"Error en actualizar tanda: {str(e)}")
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al actualizar'}
        })

# ========================================
# HANDLER: LISTAR TANDAS
# ========================================
def listar(event, context):
    try:
        user_id = extract_user_id(event)
        if not user_id:
            return response(401, {
                'success': False,
                'error': {
                    'code': 'UNAUTHORIZED',
                    'message': 'Token inválido'
                }
            })
        
        # 1️⃣ Obtener tandas del admin
        result = tandas_table.query(
            IndexName='adminId-index',
            KeyConditionExpression='adminId = :adminId',
            ExpressionAttributeValues={':adminId': user_id}
        )
        
        tandas_items = result.get('Items', [])
        tandas_response = []
        
        # 2️⃣ Para cada tanda, obtener participantes
        for tanda in tandas_items:
            tanda_id = tanda['id']
            
            participantes_result = participantes_table.query(
                KeyConditionExpression='id = :tandaId',
                ExpressionAttributeValues={':tandaId': tanda_id}
            )
            
            participantes = []
            for p in participantes_result.get('Items', []):
                participantes.append({
                    'participanteId': p['participanteId'],
                    'nombre': p['nombre'],
                    'telefono': p.get('telefono'),
                    'email': p.get('email'),
                    'numeroAsignado': p['numeroAsignado'],
                    'fechaCumpleaños': p.get('fechaCumpleaños',''),
                    'fechaRegistro': p.get('fechaRegistro','')
                })
            
            tandas_response.append({
                'tandaId': tanda_id,
                'nombre': tanda['nombre'],
                'montoPorRonda': tanda['montoPorRonda'],
                'totalRondas': tanda['totalRondas'],
                'rondaActual': tanda['rondaActual'],
                'fechaInicio': tanda['fechaInicio'],
                #'fechaLimitePago': tanda.get('fechaLimitePago',None),
                'frecuencia': tanda.get('frecuencia',None),
                'diasRecordatorio': tanda.get('diasRecordatorio',None),
                'metodoPago': tanda.get('metodoPago',None),
                'status': tanda['status'],
                'participantes': sorted(
                    participantes,
                    key=lambda x: x['numeroAsignado']
                )
            })
        
        return response(200, {
            'success': True,
            'data': {
                'tandas': tandas_response
            }
        })
        
    except Exception as e:
        print(f"Error en listar tandas: {str(e)}")
        return response(500, {
            'success': False,
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': 'Error al listar tandas'
            }
        })



# ========================================
# HANDLER: ELIMINAR TANDA
# ========================================
def eliminar(event, context):
    try:
        user_id = extract_user_id(event)
        if not user_id:
            return response(401, {
                'success': False,
                'error': {'code': 'UNAUTHORIZED', 'message': 'Token inválido'}
            })
        
        tanda_id = event['pathParameters']['tandaId']
        
        # Verificar permisos
        tanda = tandas_table.get_item(Key={'id': tanda_id})
        if not tanda.get('Item') or tanda['Item']['adminId'] != user_id:
            return response(403, {
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'Sin permisos'}
            })
        
        # Eliminar tanda
        tandas_table.delete_item(Key={'id': tanda_id})
        
        return response(200, {
            'success': True,
            'message': 'Tanda eliminada exitosamente'
        })
        
    except Exception as e:
        print(f"Error en eliminar tanda: {str(e)}")
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al eliminar'}
        })

# ========================================
# Obtener token activo (para link)
# ========================================
def obtener_link_vigente(event, context):
    """
    Obtiene el link de registro activo y no expirado de una tanda
    """
    try:
        # Obtener tandaId del path
        tanda_id = event['pathParameters']['tandaId']
        
        # Obtener userId del token JWT
        user_id = extract_user_id(event)
        if not user_id:
            return response(401, {
                'success': False,
                'error': {'code': 'UNAUTHORIZED', 'message': 'Token inválido'}
            })
        
        # Tabla
        links_table = dynamodb.Table(LINKS_TABLE)
        
        # Buscar links de esta tanda
        response = links_table.query(
            IndexName='tandaId-index',
            KeyConditionExpression='tandaId = :tandaId',
            FilterExpression='userId = :userId',
            ExpressionAttributeValues={
                ':tandaId': tanda_id,
                ':userId': user_id
            }
        )
        
        print(f'link disponibles: {response}')
        
        links = response.get('Items', [])
        
        if not links:
            return {
                'statusCode': 404,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'success': False,
                    'error': {
                        'message': 'No hay links activos para esta tanda'
                    }
                })
            }
        
        # Verificar si algún link no ha expirado
        ahora = datetime.now(timezone.utc)
        link_vigente = None
        
        for link in links:
            expiracion_raw = link['expiracion']
            if isinstance(expiracion_raw, Decimal):
                # Asumimos epoch (segundos)
                expiracion = datetime.fromtimestamp(float(expiracion_raw), tz=timezone.utc)
            elif isinstance(expiracion_raw, str):
                expiracion = datetime.fromisoformat(
                    expiracion_raw.replace('Z', '+00:00')
                )
            else:
                continue
            
            if expiracion > ahora:
                link_vigente = link
                break
        
        if not link_vigente:
            return {
                'statusCode': 404,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'success': False,
                    'error': {
                        'message': 'No hay links vigentes para esta tanda'
                    }
                })
            }
        
        # Retornar link vigente
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'data': {
                    'token': link_vigente['token'],
                    'expiracion': link_vigente['expiracion'],
                    'duracionHoras': int(link_vigente.get('duracionHoras', 24))
                }
            }, default=decimal_default)
        }
        
    except Exception as e:
        print(f"Error obteniendo link vigente: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': False,
                'error': {
                    'message': 'Error interno del servidor',
                    'details': str(e)
                }
            })
        }



# ========================================
# HANDLER: ELIMINAR TANDA y DEPENDENCIAS
# ========================================
def eliminar_tanda_con_dependencias(event,context):
    """Handler principal de la Lambda"""
    
    print(f"📥 Event: {json.dumps(event)}")
    
    # Manejar preflight CORS
    if event.get('httpMethod') == 'OPTIONS':
        return response(200, {'message': 'OK'})
    
    try:
        user_id = extract_user_id(event)
        if not user_id:
            return response(401, {
                'success': False,
                'error': {'code': 'UNAUTHORIZED', 'message': 'Token inválido'}
            })
        
        tanda_id = event['pathParameters']['tandaId']
        if not tanda_id:
            return response(400, {
                'success': False,
                'error': {'message': 'tandaId es requerido'}
            })
        
        print(f"✓ TandaId a eliminar: {tanda_id}")
        
        # 3. Verificar que la tanda existe y pertenece al usuario
        resultado = tandas_table.get_item(
            Key={'id': tanda_id}
        )
        
        if 'Item' not in resultado:
            return response(404, {
                'success': False,
                'error': {'message': 'Tanda no encontrada'}
            })
        
        tanda = resultado['Item']
        
        # Verificar pertenencia
        if tanda.get('adminId') != user_id:
            return response(403, {
                'success': False,
                'error': {'message': 'No tienes permisos para eliminar esta tanda'}
            })
        
        print(f"✓ Tanda validada. Nombre: {tanda.get('nombre', 'Sin nombre')}")
        
        # 4. PROCESO DE ELIMINACIÓN
        print("\n" + "="*50)
        print("🗑️  INICIANDO PROCESO DE ELIMINACIÓN")
        print("="*50)
        
        estadisticas = {
            'participantes': 0,
            'pagos': 0,
            'notificaciones': 0,
            'tanda': False,
            'usuario': False
        }
        
        # Paso 1: Eliminar participantes
        estadisticas['participantes'] = eliminar_participantes(tanda_id)
        
        # Paso 2: Eliminar pagos
        estadisticas['pagos'] = eliminar_pagos(tanda_id)
        
        # Paso 3: Eliminar notificaciones
        estadisticas['notificaciones'] = eliminar_notificaciones(tanda_id)
        
        # Paso 4: Actualizar usuario_admin
        estadisticas['usuario'] = actualizar_usuario_admin(user_id, tanda_id)
        
        # Paso 5: Eliminar tanda
        estadisticas['tanda'] = eliminar_tanda(tanda_id)
        
        print("\n" + "="*50)
        print("✅ PROCESO COMPLETADO")
        print("="*50)
        print(f"📊 Estadísticas:")
        print(f"   - Participantes eliminados: {estadisticas['participantes']}")
        print(f"   - Pagos eliminados: {estadisticas['pagos']}")
        print(f"   - Notificaciones eliminadas: {estadisticas['notificaciones']}")
        print(f"   - Usuario actualizado: {'✓' if estadisticas['usuario'] else '✗'}")
        print(f"   - Tanda eliminada: {'✓' if estadisticas['tanda'] else '✗'}")
        print("="*50 + "\n")
        
        # 5. Respuesta exitosa
        return response(200, {
            'success': True,
            'message': 'Tanda eliminada exitosamente',
            'data': {
                'tandaId': tanda_id,
                'estadisticas': estadisticas
            }
        })
    
    except ValueError as e:
        print(f"❌ Error de validación: {str(e)}")
        return response(400, {
            'success': False,
            'error': {'message': str(e)}
        })
        
    except Exception as e:
        print(f"❌ Error inesperado: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return response(500, {
            'success': False,
            'error': {'message': f'Error interno del servidor: {str(e)}'}
        })


# ===================================
# Obtener datos registro
# ====================================
def obtener_datos_registro(event, context):
    """
    Obtiene información de la tanda usando token temporal
    
    Retorna:
    - Información básica de la tanda
    - Números disponibles
    - Restricciones (máximo 50%)
    """
    try:
        # Obtener token del path
        token = event['pathParameters']['token']
        
        # Buscar el link en la tabla
        links_table = dynamodb.Table(LINKS_TABLE)
        response = links_table.get_item(
            Key={'token': token}
        )
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'success': False,
                    'error': {
                        'message': 'Link de registro no encontrado'
                    }
                })
            }
        
        link = response['Item']
        
        # Verificar si está activo
        if not link.get('activo', True):
            return {
                'statusCode': 403,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'success': False,
                    'error': {
                        'message': 'Link de registro desactivado'
                    }
                })
            }
        
        # Verificar si expiró
        expiracion = link.get('expiracion', 0)
        if datetime.utcnow().timestamp() > expiracion:
            return {
                'statusCode': 403,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'success': False,
                    'error': {
                        'message': 'Link de registro expirado'
                    }
                })
            }
        
        # Obtener datos de la tanda        
        response = tandas_table.get_item(
            Key={
                'id': link['tandaId']
            }
        )
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'success': False,
                    'error': {
                        'message': 'Tanda no encontrada'
                    }
                })
            }
        
        tanda = response['Item']
        
        # Obtener participantes de la tabla participantes
        response = participantes_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={
                ':tandaId': link['tandaId']
            }
        )
        
        participantes = response.get('Items', [])
        
        # Preparar lista simplificada de participantes (solo número asignado)
        participantes_publicos = [
            {
                'numeroAsignado': int(p.get('numeroAsignado', 0)),
                'nombre': p.get('nombre', '')
            }
            for p in participantes
        ]
        
        # Preparar datos para respuesta (sin información sensible)
        datos_publicos = {
            'tandaId': tanda['id'],
            'nombre': tanda.get('nombre', ''),
            'montoPorRonda': float(tanda.get('montoPorRonda', 0)),
            'totalRondas': int(tanda.get('totalRondas', 0)),
            'frecuencia': tanda.get('frecuencia', 'semanal'),
            'fechaInicio': tanda.get('fechaInicio', ''),
            'participantes': tanda.get('participantes', []),
            'participantes': participantes_publicos,
            'expiracion': link.get('expiracion', '') 
        }
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'data': datos_publicos
            }, default=decimal_default)
        }
        
    except Exception as e:
        print(f"Error obteniendo datos: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': False,
                'error': {
                    'message': 'Error interno del servidor',
                    'details': str(e)
                }
            })
        }


# ===================================
# Generar link de registro
# ===================================
def generar_link_registro(event, context):
    """
    Genera un token temporal para registro público
    
    Body esperado:
    {
        "duracionHoras": 24  # 24 o 12
    }
    """
    try:
        # Obtener tandaId y userId del path y authorizer
        tanda_id = event['pathParameters']['tandaId']
        user_id = extract_user_id(event)
        if not user_id:
            return response(401, {
                'success': False,
                'error': {
                    'code': 'UNAUTHORIZED',
                    'message': 'Token inválido o expirado'
                }
            })
        
        # Parse body
        body = json.loads(event['body'])
        duracion_horas = body.get('duracionHoras', 24)
        
        # Validar duración
        if duracion_horas not in [12, 24]:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'success': False,
                    'error': {
                        'message': 'Duración debe ser 12 o 24 horas'
                    }
                })
            }
        
        # Verificar que la tanda existe y pertenece al usuario        
        response = tandas_table.get_item(
            Key={
                'id': tanda_id
            }
        )
        
        if 'Item' not in response:
            return {
                'statusCode': 404,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'success': False,
                    'error': {
                        'message': 'Tanda no encontrada'
                    }
                })
            }
        
        tanda = response['Item']
        # 🆕 Determinar tipo de tanda
        es_cumpleañera = tanda.get('frecuencia') == 'cumpleaños'
        
        # Generar token único
        token = str(uuid.uuid4())
        
        # Calcular fecha de expiración
        expiracion = datetime.utcnow() + timedelta(hours=duracion_horas)
        expiracion_timestamp = int(expiracion.timestamp())
        
        # Guardar en tabla de links de registro
        links_table = dynamodb.Table(LINKS_TABLE)
        links_table.put_item(
            Item={
                'token': token,
                'tandaId': tanda_id,
                'userId': user_id,
                'duracionHoras': duracion_horas,
                'expiracion': expiracion_timestamp,
                'createdAt': datetime.utcnow().isoformat(),
                'activo': True,
                # TTL para auto-eliminación (expira 24h después de expiración)
                'ttl': expiracion_timestamp + (24 * 3600),
                'tipo': 'cumpleañera' if es_cumpleañera else 'normal'  # 🆕 Tipo de link
            }
        )
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'data': {
                    'token': token,
                    'expiracion': expiracion.isoformat(),
                    'duracionHoras': duracion_horas
                }
            })
        }
        
    except Exception as e:
        print(f"Error generando link: {str(e)}")
        return {
            'statusCode': 500,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': False,
                'error': {
                    'message': 'Error interno del servidor',
                    'details': str(e)
                }
            })
        }


def lambda_handler(event, context):
    print(f"event: {event}")    
    routeKey = event.get('routeKey')
    print(f'routeKey: {routeKey}')
    
    try:
        status_code = 200
        if routeKey == 'POST /tandas':
            print('/tandas')
            return crear(event,context)
        
        elif routeKey =="GET /tandas/{tandaId}":
            print('GET /tandas/')
            return obtener(event,context)
        
        elif routeKey.startswith("PUT /tandas/"):
            print(routeKey)
            return actualizar(event,context)    
        
        elif routeKey == 'GET /tandas':
            print(routeKey)
            return listar(event,context)
        
        elif routeKey.startswith("DELETE /tandas/"):
            print(routeKey)
            return eliminar_tanda_con_dependencias(event,context)
        
        elif routeKey == 'GET /registro/{token}':
            print('obnener dato registro')
            return obtener_datos_registro(event,context)
        
        elif routeKey == 'POST /tandas/{tandaId}/registro-link':
            print('Generar link de registro')
            return generar_link_registro(event,context)
        
        elif routeKey == 'GET /tandas/{tandaId}/registro-link/activo':
            print('obtener link vigente')
            return obtener_link_vigente(event,context)
            
        else:  
            status_code = 400
            body_response = {
                "error_code": "0001",
                "error_msg": "Recurso invalido"
            }      
        return {
                "statusCode": status_code,
                "body": json.dumps(body_response,default=str)
            }
    except Exception as e:
        print(f"error main: {str(e)}")
        if isinstance(e,CustomError):
            return CustomClientError().standar_errors_formatting(e,event)
        else:
            return {
                "statusCode": 400,
                "body": {
                    "codeError": '400',
                    "message": str(e)
                }
            }