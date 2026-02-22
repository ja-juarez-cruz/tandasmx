# ========================================
# LAMBDA: pagos_handler.py
# Maneja registro y consulta de pagos
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
tandas_table = dynamodb.Table(os.environ['TANDAS_TABLE'])
participantes_table = dynamodb.Table(os.environ['PARTICIPANTES_TABLE'])
pagos_table = dynamodb.Table(os.environ['PAGOS_TABLE'])

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

def verificar_permisos_tanda(tanda_id, user_id):
    result = tandas_table.get_item(Key={'id': tanda_id})
    if not result.get('Item'):
        return False, None
    if result['Item']['adminId'] != user_id:
        return False, None
    return True, result['Item']

# ========================================
# HANDLER: REGISTRAR PAGO
# ========================================
def registrar(event, context):
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
        
        # Validar campos
        if not body.get('participanteId') or 'ronda' not in body or 'pagado' not in body:
            return response(400, {
                'success': False,
                'error': {'code': 'MISSING_FIELDS', 'message': 'Campos requeridos faltantes'}
            })
        
        # Verificar que el participante existe
        print(f'tanda_id: {tanda_id}')
        print(f'participante_id: {body['participanteId']}')
        participante = participantes_table.get_item(
            Key={'id': tanda_id, 'participanteId': body['participanteId']}
        )
        print(f'participante: {participante}')
        
        if not participante.get('Item'):
            return response(404, {
                'success': False,
                'error': {'code': 'PARTICIPANTE_NOT_FOUND', 'message': 'Participante no encontrado'}
            })
        
        # Crear o actualizar pago
        pago_id = f"{body['participanteId']}_{body['ronda']}"
        timestamp = datetime.utcnow().isoformat()
        
        monto = body.get('monto', tanda['montoPorRonda'])
        
        pago = {
            'id': tanda_id,
            'pagoId': pago_id,
            'participanteId': body['participanteId'],
            'ronda': int(body['ronda']),
            'pagado': body['pagado'],
            'monto': Decimal(str(monto)),
            'fechaPago': body.get('fechaPago', timestamp),
            'metodoPago': body.get('metodoPago', tanda['configuracion'].get('metodoPago', '')),
            'comprobante': body.get('comprobante', ''),
            'notas': body.get('notas', ''),
            'createdAt': timestamp,
            'updatedAt': timestamp,
            'exentoPago': body.get('exentoPago', False)
        }
        
        pagos_table.put_item(Item=pago)
        pago['tandaId']=tanda_id
        
        return response(201, {
            'success': True,
            'data': pago
        })
        
    except Exception as e:
        print(f"Error en registrar pago: {str(e)}")
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al registrar pago'}
        })

# ========================================
# HANDLER: ACTUALIZAR PAGO
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
        pago_id = event['pathParameters']['pagoId']
        body = json.loads(event['body'])
        
        # Verificar permisos
        tiene_permisos, _ = verificar_permisos_tanda(tanda_id, user_id)
        if not tiene_permisos:
            return response(403, {
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'Sin permisos'}
            })
        
        # Verificar que el pago existe
        pago = pagos_table.get_item(
            Key={'id': tanda_id, 'pagoId': pago_id}
        )
        
        if not pago.get('Item'):
            return response(404, {
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Pago no encontrado'}
            })
        
        # Construir expresión de actualización
        update_expression = "SET updatedAt = :now"
        expression_values = {':now': datetime.utcnow().isoformat()}
        
        if 'pagado' in body:
            update_expression += ", pagado = :pagado"
            expression_values[':pagado'] = body['pagado']
        
        if 'fechaPago' in body:
            update_expression += ", fechaPago = :fechaPago"
            expression_values[':fechaPago'] = body['fechaPago']
        
        if 'notas' in body:
            update_expression += ", notas = :notas"
            expression_values[':notas'] = body['notas']
        
        if 'comprobante' in body:
            update_expression += ", comprobante = :comprobante"
            expression_values[':comprobante'] = body['comprobante']

        if 'exentoPago' in body:
            update_expression += ", exentoPago = :exentoPago"
            expression_values[':exentoPago'] = body['exentoPago']
        
        # Actualizar
        pagos_table.update_item(
            Key={'id': tanda_id, 'pagoId': pago_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values
        )
        
        return response(200, {
            'success': True,
            'data': {
                'pagoId': pago_id,
                'updatedAt': expression_values[':now']
            }
        })
        
    except Exception as e:
        print(f"Error en actualizar pago: {str(e)}")
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al actualizar'}
        })

# ========================================
# HANDLER: OBTENER HISTORIAL DE PAGOS
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
        ronda = query_params.get('ronda')
        
        # Obtener pagos
        pagos_result = pagos_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={':tandaId': tanda_id}
        )
        
        pagos = pagos_result.get('Items', [])
        #for pago in pagos:
        #    pago['tandaId'] = tanda_id
        
        # Aplicar filtros
        if participante_id:
            pagos = [p for p in pagos if p['participanteId'] == participante_id]
        
        if ronda:
            pagos = [p for p in pagos if p['ronda'] == int(ronda)]
        
        # Calcular total
        total_monto = sum(p['monto'] for p in pagos if p.get('pagado', False))
        
        return response(200, {
            'success': True,
            'data': {
                'pagos': pagos,
                'total': len(pagos),
                'totalMonto': total_monto,
                'tandaId': tanda_id
            }
        })
        
    except Exception as e:
        print(f"Error en obtener pagos: {str(e)}")
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al obtener pagos'}
        })

# ========================================
# HANDLER: OBTENER MATRIZ DE PAGOS
# ========================================
def obtener_matriz(event, context):
    try:
        user_id = extract_user_id(event)
        if not user_id:
            return response(401, {
                'success': False,
                'error': {'code': 'UNAUTHORIZED', 'message': 'Token inválido'}
            })
        
        tanda_id = event['pathParameters']['tandaId']
        
        # Verificar permisos
        tiene_permisos, tanda = verificar_permisos_tanda(tanda_id, user_id)
        if not tiene_permisos:
            return response(403, {
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'Sin permisos'}
            })
        
        # Obtener participantes
        participantes_result = participantes_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={':tandaId': tanda_id}
        )
        
        # Obtener pagos
        pagos_result = pagos_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={':tandaId': tanda_id}
        )
        
        # Diccionario de pagos: participante_ronda
        pagos_dict = {}
        for pago in pagos_result.get('Items', []):
            key = f"{pago['participanteId']}_{int(pago['ronda'])}"
            pagos_dict[key] = {
                'pagado': pago.get('pagado', False),
                'fechaPago': pago.get('fechaPago'),
                'exentoPago': pago.get('exentoPago',False),
                'metodoPago': pago.get('metodoPago'),
                'monto': pago.get('monto'),
                'notas': pago.get('notas')
            }
        
        ronda_actual = int(tanda['rondaActual'])
        total_rondas = int(tanda['totalRondas'])
        
        matriz = []
        
        for participante in sorted(
            participantes_result.get('Items', []),
            key=lambda x: x['numeroAsignado']
        ):
            pagos_participante = {}
            pagos_realizados = 0
            pagos_adelantados = 0
            
            for ronda in range(1, total_rondas + 1):
                key = f"{participante['participanteId']}_{ronda}"
                pago_info = pagos_dict.get(
                    key,
                    {'pagado': False, 'fechaPago': None}
                )
                
                pagos_participante[str(ronda)] = {
                    'pagado': pago_info['pagado'],
                    'fechaPago': pago_info['fechaPago'],
                    'esFuturo': ronda > ronda_actual,
                    'exentoPago': pago_info.get('exentoPago',False),
                    'metodoPago': pago_info.get('metodoPago'),
                    'monto': pago_info.get('monto'),
                    'notas': pago_info.get('notas')
                }
                
                if pago_info['pagado']:
                    if ronda <= ronda_actual:
                        pagos_realizados += 1
                    else:
                        pagos_adelantados += 1
            
            # Pagos esperados hasta la ronda pasada
            pagos_esperados = max(0, ronda_actual - 1)
            
            # Estado general
            if pagos_realizados >= pagos_esperados:
                estado_general = 'al_corriente'
            else:
                estado_general = 'atrasado'
            
            matriz.append({
                'participanteId': participante['participanteId'],
                'nombre': participante['nombre'],
                'numeroAsignado': participante['numeroAsignado'],
                'pagos': pagos_participante,
                'estadoGeneral': estado_general,
                'pagosAdelantados': pagos_adelantados
            })
        
        return response(200, {
            'success': True,
            'data': {
                'rondaActual': ronda_actual,
                'totalRondas': total_rondas,
                'tandaId': tanda_id,
                'matriz': matriz
            }
        })
        
    except Exception as e:
        print(f"Error en obtener matriz: {str(e)}")
        return response(500, {
            'success': False,
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': 'Error al obtener matriz'
            }
        })




def lambda_handler(event, context):
    print(f"event: {event}")
    path = event.get("path")
    routeKey = event.get('routeKey')
    
    try:
        status_code = 200
        if routeKey == 'POST /tandas/{tandaId}/pagos':
            print('Crear Pago')
            return registrar(event,context)
        
        elif routeKey == 'PUT /tandas/{tandaId}/pagos/{pagoId}':
            print('Actualizar pago')
            return actualizar(event,context)
        
        elif routeKey == 'GET /tandas/{tandaId}/pagos':
            print('Consultar pagos')
            return obtener(event,context)    
        
        elif routeKey == 'GET /tandas/{tandaId}/pagos/matriz':
            print('Consultar matriz pagos')
            return obtener_matriz(event,context)
            
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