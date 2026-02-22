# ========================================
# LAMBDA: notificaciones_handler.py
# Maneja envío de recordatorios por SMS/WhatsApp
# ========================================

import json
import boto3
import os
import jwt
from datetime import datetime
from decimal import Decimal

#custom error
from exception.custom_http_exception import CustomError
from exception.custom_http_exception import CustomClientError

dynamodb = boto3.resource('dynamodb')
sns = boto3.client('sns')

tandas_table = dynamodb.Table(os.environ['TANDAS_TABLE'])
participantes_table = dynamodb.Table(os.environ['PARTICIPANTES_TABLE'])
notificaciones_table = dynamodb.Table(os.environ['NOTIFICACIONES_TABLE'])

JWT_SECRET = os.environ['JWT_SECRET']

# Utilidades
def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Content-Type': 'application/json'
    }

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

def extract_user_id(event):
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
    import random
    import string
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

def verificar_permisos_tanda(tanda_id, user_id):
    result = tandas_table.get_item(Key={'id': tanda_id})
    if not result.get('Item'):
        return False, None
    if result['Item']['adminId'] != user_id:
        return False, None
    return True, result['Item']

def enviar_sms(telefono, mensaje):
    """Envía SMS usando AWS SNS"""
    try:
        # Formatear número para México (código de país +52)
        # El número debe estar en formato E.164: +52XXXXXXXXXX
        telefono_limpio = ''.join(filter(str.isdigit, telefono))
        
        # Si no tiene código de país, agregar +52
        if not telefono_limpio.startswith('52'):
            telefono_limpio = '52' + telefono_limpio
        
        numero_e164 = f"+{telefono_limpio}"
        
        response = sns.publish(
            PhoneNumber=numero_e164,
            Message=mensaje,
            MessageAttributes={
                'AWS.SNS.SMS.SMSType': {
                    'DataType': 'String',
                    'StringValue': 'Transactional'
                }
            }
        )
        
        return True, response['MessageId']
        
    except Exception as e:
        print(f"Error enviando SMS: {str(e)}")
        return False, str(e)

def registrar_notificacion(tanda_id, participante_id, mensaje, canal, estado, error=None):
    """Registra la notificación en DynamoDB"""
    notificacion_id = f"notif_{generate_short_id()}"
    timestamp = datetime.utcnow().isoformat()
    
    notificacion = {
        'id': tanda_id,
        'notificacionId': notificacion_id,
        'participanteId': participante_id,
        'tipo': 'recordatorio_pago',
        'mensaje': mensaje,
        'canal': canal,
        'estado': estado,
        'fechaEnvio': timestamp,
        'createdAt': timestamp
    }
    
    if error:
        notificacion['error'] = error
    
    notificaciones_table.put_item(Item=notificacion)
    
    return notificacion_id

# ========================================
# HANDLER: ENVIAR RECORDATORIO INDIVIDUAL
# ========================================
def enviar_recordatorio(event, context):
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
        tiene_permisos, tanda = verificar_permisos_tanda(tanda_id, user_id)
        if not tiene_permisos:
            return response(403, {
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'Sin permisos'}
            })
        
        # Obtener participante
        participante_id = body.get('participanteId')
        if not participante_id:
            return response(400, {
                'success': False,
                'error': {'code': 'MISSING_FIELDS', 'message': 'participanteId requerido'}
            })
        
        participante = participantes_table.get_item(
            Key={'id': tanda_id, 'participanteId': participante_id}
        )
        
        if not participante.get('Item'):
            return response(404, {
                'success': False,
                'error': {'code': 'PARTICIPANTE_NOT_FOUND', 'message': 'Participante no encontrado'}
            })
        
        participante = participante['Item']
        
        # Construir mensaje
        mensaje = body.get('mensaje')
        if not mensaje:
            monto_formatted = f"{int(tanda['montoPorRonda']):,}"
            mensaje = (
                f"Hola {participante['nombre']}, recordatorio de {tanda['nombre']}. "
                f"Ronda {tanda['rondaActual']}. Monto: ${monto_formatted}"
            )
        
        canal = body.get('canal', 'sms')
        
        # Enviar SMS
        exito, resultado = enviar_sms(participante['telefono'], mensaje)
        
        # Registrar notificación
        estado = 'enviado' if exito else 'fallido'
        error = None if exito else resultado
        
        notificacion_id = registrar_notificacion(
            tanda_id, 
            participante_id, 
            mensaje, 
            canal, 
            estado, 
            error
        )
        
        if not exito:
            return response(500, {
                'success': False,
                'error': {
                    'code': 'SMS_SEND_ERROR',
                    'message': 'Error al enviar SMS',
                    'details': resultado
                }
            })
        
        return response(200, {
            'success': True,
            'data': {
                'notificacionId': notificacion_id,
                'participanteId': participante_id,
                'estado': estado,
                'fechaEnvio': datetime.utcnow().isoformat()
            }
        })
        
    except Exception as e:
        print(f"Error en enviar recordatorio: {str(e)}")
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al enviar recordatorio'}
        })

# ========================================
# HANDLER: ENVIAR RECORDATORIO MASIVO
# ========================================
def enviar_recordatorio_masivo(event, context):
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
        tiene_permisos, tanda = verificar_permisos_tanda(tanda_id, user_id)
        if not tiene_permisos:
            return response(403, {
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'Sin permisos'}
            })
        
        # Obtener participantes seleccionados
        participante_ids = body.get('participanteIds', [])
        if not participante_ids:
            return response(400, {
                'success': False,
                'error': {'code': 'MISSING_FIELDS', 'message': 'participanteIds requerido'}
            })
        
        # Construir mensaje
        mensaje = body.get('mensaje')
        if not mensaje:
            monto_formatted = f"{int(tanda['montoPorRonda']):,}"
            mensaje = (
                f"Recordatorio: La ronda {tanda['rondaActual']} de {tanda['nombre']} está activa. "
                f"Monto: ${monto_formatted}. Método: {tanda['configuracion'].get('metodoPago', 'N/A')}"
            )
        
        canal = body.get('canal', 'sms')
        
        # Enviar a cada participante
        enviados = 0
        fallidos = 0
        detalles = []
        
        for participante_id in participante_ids:
            # Obtener participante
            participante = participantes_table.get_item(
                Key={'id': tanda_id, 'participanteId': participante_id}
            )
            
            if not participante.get('Item'):
                fallidos += 1
                detalles.append({
                    'participanteId': participante_id,
                    'estado': 'fallido',
                    'error': 'Participante no encontrado'
                })
                continue
            
            participante = participante['Item']
            
            # Personalizar mensaje con nombre
            mensaje_personalizado = f"Hola {participante['nombre']}, {mensaje}"
            
            # Enviar SMS
            exito, resultado = enviar_sms(participante['telefono'], mensaje_personalizado)
            
            # Registrar notificación
            estado = 'enviado' if exito else 'fallido'
            error = None if exito else resultado
            
            notificacion_id = registrar_notificacion(
                tanda_id,
                participante_id,
                mensaje_personalizado,
                canal,
                estado,
                error
            )
            
            if exito:
                enviados += 1
            else:
                fallidos += 1
            
            detalles.append({
                'participanteId': participante_id,
                'estado': estado,
                'notificacionId': notificacion_id,
                'error': error
            })
        
        return response(200, {
            'success': True,
            'data': {
                'notificacionesEnviadas': enviados,
                'notificacionesFallidas': fallidos,
                'detalles': detalles
            }
        })
        
    except Exception as e:
        print(f"Error en enviar recordatorio masivo: {str(e)}")
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al enviar recordatorios'}
        })

# ========================================
# HANDLER: OBTENER HISTORIAL DE NOTIFICACIONES
# ========================================
def obtener(event, context):
    try:
        user_id = extract_user_id(event)
        if not user_id:
            return response(401, {
                'success': False,
                'error': {'code': 'UNAUTHORIZED', 'message': 'Token inválido'}
            })
        
        tanda_id = event['pathParameters']['tandaId']
        
        # Verificar permisos
        tiene_permisos, _ = verificar_permisos_tanda(tanda_id, user_id)
        if not tiene_permisos:
            return response(403, {
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'Sin permisos'}
            })
        
        # Obtener parámetros de filtro
        query_params = event.get('queryStringParameters') or {}
        participante_id = query_params.get('participanteId')
        
        # Obtener notificaciones
        notificaciones_result = notificaciones_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={':tandaId': tanda_id}
        )
        
        notificaciones = notificaciones_result.get('Items', [])
        
        # Aplicar filtros
        if participante_id:
            notificaciones = [n for n in notificaciones if n['participanteId'] == participante_id]
        
        # Ordenar por fecha (más recientes primero)
        notificaciones.sort(key=lambda x: x['fechaEnvio'], reverse=True)
        
        return response(200, {
            'success': True,
            'data': {
                'notificaciones': notificaciones,
                'total': len(notificaciones)
            }
        })
        
    except Exception as e:
        print(f"Error en obtener notificaciones: {str(e)}")
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al obtener notificaciones'}
        })


def lambda_handler(event, context):
    print(f"event: {event}")    
    routeKey = event.get('routeKey')
    
    try:
        status_code = 200
        if routeKey == 'POST /tandas/{tandaId}/notificaciones/recordatorio':
            print('Enviar recordatorio')
            return enviar_recordatorio(event,context)
        
        elif routeKey == 'POST /tandas/{tandaId}/notificaciones/recordatorio-masivo':
            print('Enviar recordatorio masivo')
            return enviar_recordatorio_masivo(event,context)
        
        elif routeKey == 'GET /tandas/{tandaId}/notificaciones':
            print('Consultar notificaciones')
            return obtener(event,context)    
            
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