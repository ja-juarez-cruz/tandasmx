# ========================================
# LAMBDA: participantes_handler.py
# Maneja CRUD de participantes
# ========================================

import json
import boto3
import os
import jwt
from datetime import datetime
from decimal import Decimal
import uuid

#custom error
from exception.custom_http_exception import CustomError
from exception.custom_http_exception import CustomClientError

dynamodb = boto3.resource('dynamodb')
tandas_table = dynamodb.Table(os.environ['TANDAS_TABLE'])
participantes_table = dynamodb.Table(os.environ['PARTICIPANTES_TABLE'])
LINKS_TABLE = 'links_registro'
pagos_table = 'pagos'

JWT_SECRET = os.environ['JWT_SECRET']

# Utilidades (mismas que en tandas_handler.py)
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

def extract_user_id(event):
    try:
        auth_header = event['headers'].get('Authorization') or event['headers'].get('authorization')
        if not auth_header:
            return None
        token = auth_header.replace('Bearer ', '')
        payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
        print(f'payload token: {payload}')
        return payload['id']
    except:
        return None

def generate_short_id():
    import random
    import string
    return ''.join(random.choices(string.ascii_lowercase + string.digits, k=8))

def verificar_permisos_tanda(tanda_id, user_id):
    """Verifica que el usuario sea dueño de la tanda"""
    result = tandas_table.get_item(Key={'id': tanda_id})
    if not result.get('Item'):
        return False, 'Tanda no encontrada'
    if result['Item']['adminId'] != user_id:
        return False, 'Sin permisos'
    return True, result['Item']

# ========================================
# HANDLER: AGREGAR PARTICIPANTE
# ========================================
def agregar(event, context):
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
        tiene_permisos, result = verificar_permisos_tanda(tanda_id, user_id)
        print(f'tiene permisos: {tiene_permisos}')
        print(f'result: {result}')
        if not tiene_permisos:
            return response(403 if result != 'Tanda no encontrada' else 404, {
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': result}
            })
        
        # 🆕 OBTENER INFORMACIÓN DE LA TANDA PARA VERIFICAR SI ES CUMPLEAÑERA
        tanda = tandas_table.get_item(Key={'id': tanda_id}).get('Item')
        if not tanda:
            return response(404, {
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Tanda no encontrada'}
            })
        
        es_cumpleañera = tanda.get('frecuencia') == 'cumpleaños'
        
        # Validar campos requeridos básicos
        if not body.get('nombre') or not body.get('telefono'):
            return response(400, {
                'success': False,
                'error': {
                    'code': 'MISSING_FIELDS',
                    'message': 'Nombre y teléfono son requeridos'
                }
            })
        
        # 🆕 VALIDACIÓN ESPECÍFICA PARA TANDA CUMPLEAÑERA
        if es_cumpleañera:
            if not body.get('fechaCumpleaños'):
                return response(400, {
                    'success': False,
                    'error': {
                        'code': 'MISSING_BIRTHDAY',
                        'message': 'La fecha de cumpleaños es obligatoria para tandas cumpleañeras'
                    }
                })
        else:
            # Para tandas normales, el número asignado es obligatorio
            if not body.get('numeroAsignado'):
                return response(400, {
                    'success': False,
                    'error': {
                        'code': 'MISSING_FIELDS',
                        'message': 'El número asignado es requerido'
                    }
                })
        
        # Obtener participantes existentes
        participantes_result = participantes_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={':tandaId': tanda_id}
        )
        print(f'participantes_result: {participantes_result}')
        
        participantes_existentes = participantes_result.get('Items', [])
        
        # 🆕 CALCULAR NÚMERO ASIGNADO
        if es_cumpleañera:
            # Para tanda cumpleañera: calcular automáticamente
            numero_asignado = calcular_numero_automatico_cumpleañera(
                body['fechaCumpleaños'],
                participantes_existentes
            )
        else:
            # Para tanda normal: usar el número proporcionado y verificar duplicados
            numero_asignado = int(body['numeroAsignado'])
            
            for p in participantes_existentes:
                if p['numeroAsignado'] == numero_asignado:
                    return response(400, {
                        'success': False,
                        'error': {
                            'code': 'NUMERO_DUPLICADO',
                            'message': f"El número {numero_asignado} ya está asignado"
                        }
                    })
        
        # Crear participante
        participante_id = f"part_{generate_short_id()}"
        timestamp = datetime.utcnow().isoformat()
        
        participante = {
            'id': tanda_id,
            'participanteId': participante_id,
            'nombre': body['nombre'],
            'telefono': body['telefono'],
            'email': body.get('email', ''),
            'numeroAsignado': numero_asignado,
            'createdAt': timestamp,
            'updatedAt': timestamp,
            'fechaRegistro': timestamp  # 🆕 Para desempate en cumpleañeras
        }
        
        # 🆕 Agregar fecha de cumpleaños si existe
        if body.get('fechaCumpleaños'):
            participante['fechaCumpleaños'] = body['fechaCumpleaños']
        
        participantes_table.put_item(Item=participante)
        
        # 🆕 SI ES CUMPLEAÑERA, RECALCULAR NÚMEROS DE TODOS LOS PARTICIPANTES
        if es_cumpleañera:
            recalcular_numeros_cumpleañera(tanda_id, participantes_existentes + [participante])
        
        participante['tandaId'] = tanda_id
        
        return response(201, {
            'success': True,
            'data': participante
        })
        
    except Exception as e:
        print(f"Error en agregar participante: {str(e)}")
        import traceback
        traceback.print_exc()
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al agregar participante'}
        })


# 🆕 FUNCIÓN AUXILIAR: Calcular número automático para tanda cumpleañera
def calcular_numero_automatico_cumpleañera(nueva_fecha_cumpleaños, participantes_existentes):
    """
    Calcula el número automático basado en la fecha de cumpleaños.
    Ordena por mes/día de cumpleaños, y en caso de empate, por fecha de registro.
    
    Args:
        nueva_fecha_cumpleaños: String con formato ISO (YYYY-MM-DD)
        participantes_existentes: Lista de participantes actuales
    
    Returns:
        int: Número asignado (1-N)
    """
    from datetime import datetime
    
    # Si no hay participantes, es el número 1
    if not participantes_existentes:
        return 1
    
    # Crear lista con info de cumpleaños
    lista_cumpleaños = []
    
    # Agregar participantes existentes
    for p in participantes_existentes:
        if p.get('fechaCumpleaños'):
            try:
                fecha_cumple = datetime.fromisoformat(p['fechaCumpleaños'])
                fecha_registro = datetime.fromisoformat(p.get('fechaRegistro', p.get('createdAt')))
                
                lista_cumpleaños.append({
                    'mes': fecha_cumple.month,
                    'dia': fecha_cumple.day,
                    'fechaRegistro': fecha_registro,
                    'participanteId': p['participanteId']
                })
            except Exception as e:
                print(f"Error procesando fecha de participante {p.get('participanteId')}: {e}")
                continue
    
    # Agregar el nuevo participante
    try:
        nueva_fecha = datetime.fromisoformat(nueva_fecha_cumpleaños)
        lista_cumpleaños.append({
            'mes': nueva_fecha.month,
            'dia': nueva_fecha.day,
            'fechaRegistro': datetime.utcnow(),
            'esNuevo': True
        })
    except Exception as e:
        print(f"Error procesando nueva fecha de cumpleaños: {e}")
        return 1
    
    # Ordenar por mes, día y fecha de registro
    lista_cumpleaños.sort(key=lambda x: (x['mes'], x['dia'], x['fechaRegistro']))
    
    # Encontrar la posición del nuevo participante
    for i, item in enumerate(lista_cumpleaños):
        if item.get('esNuevo'):
            return i + 1
    
    # Fallback (no debería llegar aquí)
    return len(lista_cumpleaños)


# 🆕 FUNCIÓN AUXILIAR: Recalcular números de todos los participantes en tanda cumpleañera
def recalcular_numeros_cumpleañera(tanda_id, todos_participantes):
    """
    Recalcula y actualiza los números de TODOS los participantes en una tanda cumpleañera.
    Se ejecuta cada vez que se agrega, modifica o elimina un participante.
    
    Args:
        tanda_id: ID de la tanda
        todos_participantes: Lista con TODOS los participantes (incluyendo el recién agregado)
    """
    from datetime import datetime
    
    if not todos_participantes:
        return
    
    # Filtrar solo participantes con fecha de cumpleaños
    participantes_con_cumple = []
    
    for p in todos_participantes:
        if p.get('fechaCumpleaños'):
            try:
                fecha_cumple = datetime.fromisoformat(p['fechaCumpleaños'])
                fecha_registro = datetime.fromisoformat(p.get('fechaRegistro', p.get('createdAt')))
                
                participantes_con_cumple.append({
                    'participanteId': p['participanteId'],
                    'mes': fecha_cumple.month,
                    'dia': fecha_cumple.day,
                    'fechaRegistro': fecha_registro
                })
            except Exception as e:
                print(f"Error procesando participante {p.get('participanteId')}: {e}")
                continue
    
    # Ordenar por mes, día y fecha de registro
    participantes_con_cumple.sort(key=lambda x: (x['mes'], x['dia'], x['fechaRegistro']))
    
    # Actualizar números en DynamoDB
    timestamp = datetime.utcnow().isoformat()
    
    for i, p in enumerate(participantes_con_cumple):
        numero_nuevo = i + 1
        
        try:
            participantes_table.update_item(
                Key={
                    'id': tanda_id,
                    'participanteId': p['participanteId']
                },
                UpdateExpression='SET numeroAsignado = :num, updatedAt = :timestamp',
                ExpressionAttributeValues={
                    ':num': numero_nuevo,
                    ':timestamp': timestamp
                }
            )
            print(f"✅ Actualizado participante {p['participanteId']} a número {numero_nuevo}")
        except Exception as e:
            print(f"❌ Error actualizando participante {p['participanteId']}: {e}")

# ========================================
# HANDLER: LISTAR PARTICIPANTES
# ========================================
def listar(event, context):
    try:
        tanda_id = event['pathParameters']['tandaId']
        
        # Obtener participantes
        result = participantes_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={':tandaId': tanda_id}
        )
        
        participantes = result.get('Items', [])
        
        # Ordenar por número asignado
        participantes.sort(key=lambda x: x['numeroAsignado'])
        
        return response(200, {
            'success': True,
            'data': {
                'participantes': participantes,
                'total': len(participantes)
            }
        })
        
    except Exception as e:
        print(f"Error en listar participantes: {str(e)}")
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al listar'}
        })

# ========================================
# HANDLER: ACTUALIZAR PARTICIPANTE
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
        participante_id = event['pathParameters']['participanteId']
        body = json.loads(event['body'])
        
        # Verificar permisos
        tiene_permisos, _ = verificar_permisos_tanda(tanda_id, user_id)
        if not tiene_permisos:
            return response(403, {
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'Sin permisos'}
            })
        
        # 🆕 OBTENER INFORMACIÓN DE LA TANDA
        tanda = tandas_table.get_item(Key={'id': tanda_id}).get('Item')
        if not tanda:
            return response(404, {
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Tanda no encontrada'}
            })
        
        es_cumpleañera = tanda.get('frecuencia') == 'cumpleaños'
        
        # Verificar que el participante existe
        participante_result = participantes_table.get_item(
            Key={'id': tanda_id, 'participanteId': participante_id}
        )
        
        if not participante_result.get('Item'):
            return response(404, {
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Participante no encontrado'}
            })
        
        participante_actual = participante_result['Item']
        
        # 🆕 VALIDACIÓN PARA TANDAS CUMPLEAÑERAS
        if es_cumpleañera:
            # En tandas cumpleañeras NO se puede cambiar manualmente el número
            # EXCEPTO si viene del recálculo automático por cambio de fecha
            if 'numeroAsignado' in body and 'fechaCumpleaños' not in body:
                return response(400, {
                    'success': False,
                    'error': {
                        'code': 'NUMERO_NO_EDITABLE',
                        'message': 'En tandas cumpleañeras el número se asigna automáticamente por fecha de cumpleaños'
                    }
                })
        else:
            # Para tandas normales, validar número duplicado si se está cambiando
            if 'numeroAsignado' in body:
                participantes_result = participantes_table.query(
                    KeyConditionExpression='id = :tandaId',
                    ExpressionAttributeValues={':tandaId': tanda_id}
                )
                
                for p in participantes_result.get('Items', []):
                    if (p['participanteId'] != participante_id and 
                        p['numeroAsignado'] == int(body['numeroAsignado'])):
                        return response(400, {
                            'success': False,
                            'error': {
                                'code': 'NUMERO_DUPLICADO',
                                'message': f"El número {body['numeroAsignado']} ya está asignado"
                            }
                        })
        
        # 🆕 DETECTAR SI CAMBIÓ LA FECHA DE CUMPLEAÑOS EN TANDA CUMPLEAÑERA
        fecha_cumpleaños_cambio = False
        numero_nuevo_calculado = None
        numero_anterior = participante_actual.get('numeroAsignado')
        
        if es_cumpleañera and 'fechaCumpleaños' in body:
            fecha_actual = participante_actual.get('fechaCumpleaños')
            fecha_nueva = body['fechaCumpleaños']
            
            if fecha_actual != fecha_nueva:
                fecha_cumpleaños_cambio = True
                
                # 🆕 CALCULAR EL NUEVO NÚMERO BASADO EN LA FECHA DE CUMPLEAÑOS
                
                participantes_result = participantes_table.query(
                        KeyConditionExpression='id = :tandaId',
                        ExpressionAttributeValues={':tandaId': tanda_id}
                    )
                    
                todos_participantes = participantes_result.get('Items', [])
                    
                # Crear lista temporal con la nueva fecha
                participantes_temp = []
                for p in todos_participantes:
                    if p['participanteId'] == participante_id:
                        # Usar la nueva fecha para este participante
                        p_temp = p.copy()
                        p_temp['fechaCumpleaños'] = fecha_nueva
                        participantes_temp.append(p_temp)
                    else:
                        participantes_temp.append(p)
                    
                # Ordenar por fecha de cumpleaños
                participantes_ordenados = sorted(
                    participantes_temp,
                    key=lambda x: datetime.strptime(x['fechaCumpleaños'], '%Y-%m-%d')
                )
                    
                # Encontrar el nuevo número
                for idx, p in enumerate(participantes_ordenados, 1):
                    if p['participanteId'] == participante_id:
                        numero_nuevo_calculado = idx
                        break
        
        # 🆕 Construir expresión de actualización con ExpressionAttributeNames
        update_expression = "SET updatedAt = :now"
        expression_values = {':now': datetime.utcnow().isoformat()}
        expression_names = {}  # Para atributos con caracteres especiales
        
        if 'nombre' in body:
            update_expression += ", nombre = :nombre"
            expression_values[':nombre'] = body['nombre']
        
        if 'telefono' in body:
            update_expression += ", telefono = :telefono"
            expression_values[':telefono'] = body['telefono']
        
        if 'email' in body:
            update_expression += ", email = :email"
            expression_values[':email'] = body['email']
        
        # 🆕 Actualizar número si cambió la fecha de cumpleaños en tanda cumpleañera
        if es_cumpleañera and fecha_cumpleaños_cambio and numero_nuevo_calculado:
            update_expression += ", numeroAsignado = :numeroAsignado"
            expression_values[':numeroAsignado'] = numero_nuevo_calculado
        elif not es_cumpleañera and 'numeroAsignado' in body:
            # Solo permitir cambio de número manual en tandas normales
            update_expression += ", numeroAsignado = :numeroAsignado"
            expression_values[':numeroAsignado'] = int(body['numeroAsignado'])
        
        if 'comentarios' in body:
            update_expression += ", comentarios = :comentarios"
            expression_values[':comentarios'] = body['comentarios']
        
        # 🆕 Actualizar fecha de cumpleaños usando ExpressionAttributeNames
        if 'fechaCumpleaños' in body:
            update_expression += ", #fechaCumple = :fechaCumple"
            expression_names['#fechaCumple'] = 'fechaCumpleaños'
            expression_values[':fechaCumple'] = body['fechaCumpleaños']
        
        # 🆕 Actualizar participante con ExpressionAttributeNames si es necesario
        update_params = {
            'Key': {'id': tanda_id, 'participanteId': participante_id},
            'UpdateExpression': update_expression,
            'ExpressionAttributeValues': expression_values
        }
        
        # Solo agregar ExpressionAttributeNames si hay atributos con caracteres especiales
        if expression_names:
            update_params['ExpressionAttributeNames'] = expression_names
        
        participantes_table.update_item(**update_params)
        
        # 🆕 SI CAMBIÓ EL NÚMERO, RECALCULAR TODOS LOS NÚMEROS DE LOS DEMÁS PARTICIPANTES
        numeros_recalculados = False
        if fecha_cumpleaños_cambio and numero_nuevo_calculado != numero_anterior:
            print(f"📅 Número cambió de {numero_anterior} a {numero_nuevo_calculado}, recalculando todos los números...")
            numeros_recalculados = True
            
            # Obtener todos los participantes actualizados (incluye el que acabamos de actualizar)
            participantes_result = participantes_table.query(
                KeyConditionExpression='id = :tandaId',
                ExpressionAttributeValues={':tandaId': tanda_id}
            )
            
            todos_participantes = participantes_result.get('Items', [])
            recalcular_numeros_cumpleañera(tanda_id, todos_participantes)
        elif fecha_cumpleaños_cambio and numero_nuevo_calculado == numero_anterior:
            print(f"📅 Fecha de cumpleaños cambió pero el número se mantiene en {numero_anterior}")
        
        return response(200, {
            'success': True,
            'data': {
                'participanteId': participante_id,
                'updatedAt': expression_values[':now'],
                'numeroAnterior': numero_anterior,
                'numeroNuevo': numero_nuevo_calculado if fecha_cumpleaños_cambio else numero_anterior,
                'numerosRecalculados': numeros_recalculados
            }
        })
        
    except Exception as e:
        print(f"Error en actualizar participante: {str(e)}")
        import traceback
        traceback.print_exc()
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al actualizar'}
        })

# ========================================
# HANDLER: ELIMINAR PARTICIPANTE
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
        participante_id = event['pathParameters']['participanteId']
        
        # Verificar permisos
        tiene_permisos, _ = verificar_permisos_tanda(tanda_id, user_id)
        if not tiene_permisos:
            return response(403, {
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'Sin permisos'}
            })
        
        # 🆕 OBTENER INFORMACIÓN DE LA TANDA
        tanda = tandas_table.get_item(Key={'id': tanda_id}).get('Item')
        if not tanda:
            return response(404, {
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Tanda no encontrada'}
            })
        
        es_cumpleañera = tanda.get('frecuencia') == 'cumpleaños'
        
        # 🆕 VERIFICAR QUE EL PARTICIPANTE EXISTE
        participante_result = participantes_table.get_item(
            Key={'id': tanda_id, 'participanteId': participante_id}
        )
        
        if not participante_result.get('Item'):
            return response(404, {
                'success': False,
                'error': {'code': 'NOT_FOUND', 'message': 'Participante no encontrado'}
            })
        
        # 🆕 ELIMINAR TODOS LOS PAGOS ASOCIADOS AL PARTICIPANTE
        pagos_eliminados = eliminar_pagos_participante(tanda_id, participante_id)
        print(f"🗑️ Eliminados {pagos_eliminados} pagos del participante {participante_id}")
        
        # Eliminar participante
        participantes_table.delete_item(
            Key={'id': tanda_id, 'participanteId': participante_id}
        )
        print(f"✅ Participante {participante_id} eliminado")
        
        # 🆕 SI ES TANDA CUMPLEAÑERA, RECALCULAR NÚMEROS DE LOS RESTANTES
        if es_cumpleañera:
            print(f"📅 Tanda cumpleañera detectada, recalculando números...")
            
            # Obtener participantes restantes
            participantes_result = participantes_table.query(
                KeyConditionExpression='id = :tandaId',
                ExpressionAttributeValues={':tandaId': tanda_id}
            )
            
            participantes_restantes = participantes_result.get('Items', [])
            
            if participantes_restantes:
                recalcular_numeros_cumpleañera(tanda_id, participantes_restantes)
                print(f"✅ Números recalculados para {len(participantes_restantes)} participantes restantes")
        
        return response(200, {
            'success': True,
            'data': {
                'message': 'Participante eliminado exitosamente',
                'participanteId': participante_id,
                'pagosEliminados': pagos_eliminados,
                'numerosRecalculados': es_cumpleañera  # 🆕 Indica si se recalcularon números
            }
        })
        
    except Exception as e:
        print(f"Error en eliminar participante: {str(e)}")
        import traceback
        traceback.print_exc()
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al eliminar'}
        })


# 🆕 FUNCIÓN AUXILIAR: Eliminar todos los pagos de un participante
def eliminar_pagos_participante(tanda_id, participante_id):
    """
    Elimina todos los pagos asociados a un participante.
    Los pagos tienen pagoId con formato: <participanteId>_<num_pago>
    
    Args:
        tanda_id: ID de la tanda
        participante_id: ID del participante
    
    Returns:
        int: Cantidad de pagos eliminados
    """
    try:
        # Consultar todos los pagos de la tanda
        pagos_result = pagos_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={':tandaId': tanda_id}
        )
        
        pagos = pagos_result.get('Items', [])
        pagos_eliminados = 0
        
        # Filtrar y eliminar pagos que pertenecen al participante
        for pago in pagos:
            pago_id = pago.get('pagoId', '')
            
            # Verificar si el pagoId comienza con el participanteId
            # Formato esperado: <participanteId>_<num_pago>
            if pago_id.startswith(f"{participante_id}_"):
                try:
                    pagos_table.delete_item(
                        Key={
                            'id': tanda_id,
                            'pagoId': pago_id
                        }
                    )
                    pagos_eliminados += 1
                    print(f"  🗑️ Pago eliminado: {pago_id}")
                except Exception as e:
                    print(f"  ❌ Error eliminando pago {pago_id}: {e}")
        
        return pagos_eliminados
        
    except Exception as e:
        print(f"❌ Error en eliminar_pagos_participante: {e}")
        import traceback
        traceback.print_exc()
        return 0


# =======================================
# Registro de participante publico
# =======================================
def registro_publico_participante(event, context):
    """
    Registra participante(s) en la tanda
    
    Body esperado para tanda normal:
    {
        "nombre": "Juan Pérez",
        "telefono": "5512345678",
        "email": "juan@example.com",  # opcional
        "numeros": [1, 5, 12]  # máximo 50% del total
    }
    
    Body esperado para tanda cumpleañera:
    {
        "nombre": "Juan Pérez",
        "telefono": "5512345678",
        "email": "juan@example.com",  # opcional
        "fechaCumpleaños": "1990-03-15"  # REQUERIDO para cumpleañeras
    }
    """

    try:
        # Obtener token del path
        token = event['pathParameters']['token']
        
        # Parse body
        body = json.loads(event['body'])
        nombre = body.get('nombre', '').strip()
        telefono = body.get('telefono', '').strip()
        email = body.get('email', '').strip()
        numeros = body.get('numeros', [])
        fecha_cumpleaños = body.get('fechaCumpleaños', '').strip()  # 🆕
        
        # Validaciones básicas
        if not nombre or not telefono:
            return {
                'statusCode': 400,
                'headers': {
                    'Access-Control-Allow-Origin': '*',
                    'Content-Type': 'application/json'
                },
                'body': json.dumps({
                    'success': False,
                    'error': {
                        'message': 'Nombre y teléfono son obligatorios'
                    }
                })
            }
        
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
        total_rondas = int(tanda.get('totalRondas', 0))
        
        # 🆕 DETECTAR SI ES TANDA CUMPLEAÑERA
        es_cumpleañera = tanda.get('frecuencia') == 'cumpleaños'
        
        # 🆕 VALIDACIONES SEGÚN TIPO DE TANDA
        if es_cumpleañera:
            # Para tanda cumpleañera: fecha de cumpleaños es obligatoria
            if not fecha_cumpleaños:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({
                        'success': False,
                        'error': {
                            'message': 'La fecha de cumpleaños es obligatoria para tandas cumpleañeras'
                        }
                    })
                }
            
            # Validar formato de fecha
            try:
                datetime.fromisoformat(fecha_cumpleaños)
            except ValueError:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({
                        'success': False,
                        'error': {
                            'message': 'Formato de fecha inválido. Use YYYY-MM-DD'
                        }
                    })
                }
        else:
            # Para tanda normal: números son obligatorios
            if not numeros or not isinstance(numeros, list):
                return {
                    'statusCode': 400,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({
                        'success': False,
                        'error': {
                            'message': 'Debe seleccionar al menos un número'
                        }
                    })
                }
            
            # Validar cantidad de números (50% máximo)
            max_numeros = total_rondas // 2
            if len(numeros) > max_numeros:
                return {
                    'statusCode': 400,
                    'headers': {
                        'Access-Control-Allow-Origin': '*',
                        'Content-Type': 'application/json'
                    },
                    'body': json.dumps({
                        'success': False,
                        'error': {
                            'message': f'Solo puedes seleccionar hasta {max_numeros} números (50% del total)'
                        }
                    })
                }
        
        # Obtener participantes existentes
        response = participantes_table.query(            
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={
                ':tandaId': link['tandaId']
            }
        )
        
        participantes_existentes = response.get('Items', [])
        
        # 🆕 CALCULAR NÚMERO ASIGNADO PARA TANDA CUMPLEAÑERA
        if es_cumpleañera:
            numero_asignado = calcular_numero_automatico_cumpleañera(
                fecha_cumpleaños,
                participantes_existentes
            )
            numeros = [numero_asignado]  # Solo un número para cumpleañeras
        else:
            # Para tanda normal: validar que los números estén disponibles
            numeros_ocupados = [p.get('numeroAsignado') for p in participantes_existentes]
            
            for numero in numeros:
                if numero in numeros_ocupados:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json'
                        },
                        'body': json.dumps({
                            'success': False,
                            'error': {
                                'message': f'El número {numero} ya está ocupado'
                            }
                        })
                    }
                
                if numero < 1 or numero > total_rondas:
                    return {
                        'statusCode': 400,
                        'headers': {
                            'Access-Control-Allow-Origin': '*',
                            'Content-Type': 'application/json'
                        },
                        'body': json.dumps({
                            'success': False,
                            'error': {
                                'message': f'Número {numero} fuera de rango (1-{total_rondas})'
                            }
                        })
                    }
        
        # Crear participantes en tabla participantes (uno por cada número)
        nuevos_participantes = []
        timestamp = datetime.utcnow().isoformat()
        
        for numero in numeros:
            participante_id = f'part_{uuid.uuid4().hex[:12]}'
            
            participante = {
                'participanteId': participante_id,
                'id': link['tandaId'],
                'tandaId': link['tandaId'],
                'userId': link['userId'],
                'nombre': nombre,
                'telefono': telefono,
                'numeroAsignado': Decimal(str(numero)),
                'createdAt': timestamp,
                'updatedAt': timestamp,
                'fechaRegistro': timestamp,  # 🆕 Para desempate en cumpleañeras
                'registradoPorLink': True
            }
            
            if email:
                participante['email'] = email
            
            # 🆕 Agregar fecha de cumpleaños si existe
            if fecha_cumpleaños:
                participante['fechaCumpleaños'] = fecha_cumpleaños
            
            # Insertar participante en la tabla
            participantes_table.put_item(Item=participante)
            
            nuevos_participantes.append({
                'participanteId': participante_id,
                'nombre': nombre,
                'telefono': telefono,
                'numeroAsignado': int(numero),
                'fechaCumpleaños': fecha_cumpleaños if fecha_cumpleaños else None
            })
        
        # 🆕 SI ES TANDA CUMPLEAÑERA, RECALCULAR NÚMEROS DE TODOS
        if es_cumpleañera:
            # Obtener todos los participantes actualizados (incluyendo los nuevos)
            response = participantes_table.query(            
                KeyConditionExpression='id = :tandaId',
                ExpressionAttributeValues={
                    ':tandaId': link['tandaId']
                }
            )
            
            todos_participantes = response.get('Items', [])
            recalcular_numeros_cumpleañera(link['tandaId'], todos_participantes)
            
            # Obtener el número actualizado del participante recién creado
            # (puede haber cambiado después del recálculo)
            participante_actualizado = participantes_table.get_item(
                Key={
                    'id': link['tandaId'],
                    'participanteId': participante_id
                }
            ).get('Item')
            
            if participante_actualizado:
                numero_final = int(participante_actualizado.get('numeroAsignado', numero_asignado))
                nuevos_participantes[0]['numeroAsignado'] = numero_final
        
        return {
            'statusCode': 200,
            'headers': {
                'Access-Control-Allow-Origin': '*',
                'Content-Type': 'application/json'
            },
            'body': json.dumps({
                'success': True,
                'data': {
                    'participantes': nuevos_participantes,
                    'tandaId': link['tandaId'],
                    'mensaje': f'{len(numeros)} participante(s) registrado(s) exitosamente',
                    'esCumpleañera': es_cumpleañera,  # 🆕 Info útil para el frontend
                    'numeroAsignado': nuevos_participantes[0]['numeroAsignado'] if es_cumpleañera else None
                }
            }, default=decimal_default)
        }
        
    except Exception as e:
        print(f"Error registrando participante: {str(e)}")
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

def lambda_handler(event, context):
    print(f"event: {event}")
    method = event.get("httpMethod")
    path = event.get("path")
    routeKey = event.get('routeKey')
    print(f'routeKey: {routeKey}')
    
    try:
        status_code = 200
        if routeKey == "POST /tandas/{tandaId}/participantes":
            print(routeKey)
            return agregar(event,context)
        
        elif routeKey == 'GET /tandas/{tandaId}/participantes':
            print(routeKey)
            return listar(event,context)
        
        elif routeKey == 'PUT /tandas/{tandaId}/participantes/{participanteId}':
            print(routeKey)
            return actualizar(event, context)    
        
        elif routeKey == 'DELETE /tandas/{tandaId}/participantes/{participanteId}':
            print(routeKey)
            return eliminar(event,context)
        
        elif routeKey == 'POST /registro/{token}':
            print('Registro publico de participante')
            return registro_publico_participante(event,context)
            
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