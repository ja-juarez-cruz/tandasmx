# ========================================
# LAMBDA: auth_handler.py
# Maneja autenticación: login, register, refresh token
# ========================================

import json
import boto3
import hashlib
import jwt
import os
from datetime import datetime, timedelta
from decimal import Decimal
from boto3.dynamodb.conditions import Key

#custom error
from exception.custom_http_exception import CustomError
from exception.custom_http_exception import CustomClientError

dynamodb = boto3.resource('dynamodb')
usuarios_table = dynamodb.Table(os.environ['USUARIOS_TABLE'])

# Configuración JWT
JWT_SECRET = os.environ['JWT_SECRET']
JWT_REFRESH_SECRET = os.environ['JWT_REFRESH_SECRET']

# Utilidades
def cors_headers():
    return {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type,Authorization',
        'Access-Control-Allow-Methods': 'GET,POST,PUT,DELETE,OPTIONS',
        'Content-Type': 'application/json'
    }

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

def convert_decimals(obj):
    """
    Convierte objetos Decimal de DynamoDB a tipos nativos de Python
    Para evitar errores de serialización JSON
    """
    if isinstance(obj, list):
        return [convert_decimals(i) for i in obj]
    elif isinstance(obj, dict):
        return {k: convert_decimals(v) for k, v in obj.items()}
    elif isinstance(obj, Decimal):
        if obj % 1 == 0:
            return int(obj)
        else:
            return float(obj)
    else:
        return obj

def response(status_code, body):
    return {
        'statusCode': status_code,
        'headers': cors_headers(),
        'body': json.dumps(body, default=str)
    }

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

def generate_token(user_id, email, expires_in_hours=1):
    payload = {
        'id': user_id,
        'email': email,
        'exp': datetime.utcnow() + timedelta(hours=expires_in_hours)
    }
    return jwt.encode(payload, JWT_SECRET, algorithm='HS256')

def generate_refresh_token(user_id):
    payload = {
        'id': user_id,
        'exp': datetime.utcnow() + timedelta(days=30)
    }
    return jwt.encode(payload, JWT_REFRESH_SECRET, algorithm='HS256')

# ========================================
# HANDLER: LOGIN
# ========================================
def login(event, context):
    try:
        body = json.loads(event['body'])
        email = body.get('email')
        password = body.get('password')
        
        if not email or not password:
            return response(400, {
                'success': False,
                'error': {
                    'code': 'MISSING_CREDENTIALS',
                    'message': 'Email y password son requeridos'
                }
            })
        
        # Buscar usuario por email usando GSI
        result = usuarios_table.query(
            IndexName='email-index',
            KeyConditionExpression='email = :email',
            ExpressionAttributeValues={':email': email}
        )
        print(f'result: {result}')
        
        if not result.get('Items'):
            return response(401, {
                'success': False,
                'error': {
                    'code': 'INVALID_CREDENTIALS',
                    'message': 'Email o contraseña incorrectos'
                }
            })
        
        usuario = result['Items'][0]
        
        # Verificar password
        hashed_password = hash_password(password)
        if usuario['passwordHash'] != hashed_password:
            return response(401, {
                'success': False,
                'error': {
                    'code': 'INVALID_CREDENTIALS',
                    'message': 'Email o contraseña incorrectos'
                }
            })
        
        # Generar tokens
        token = generate_token(usuario['id'], usuario['email'])
        refresh_token = generate_refresh_token(usuario['id'])
        print(f'token: {token}')
        print(f'refresh_token: {refresh_token}')
        print(f'usuario: {usuario}')
        
        # Actualizar lastLogin
        usuarios_table.update_item(
            Key={'id': usuario['id']},
            UpdateExpression='SET lastLogin = :now',
            ExpressionAttributeValues={':now': datetime.utcnow().isoformat()}
        )
        
        return response(200, {
            'success': True,
            'data': {
                'id': usuario['id'],
                'email': usuario['email'],
                'nombre': usuario['nombre'],
                'token': token,
                'refreshToken': refresh_token,
                'expiresIn': 3600
            }
        })
        
    except Exception as e:
        print(f"Error en login: {str(e)}")
        return response(500, {
            'success': False,
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': {str(e)}
            }
        })

# ========================================
# HANDLER: REGISTER
# ========================================
def register(event, context):
    try:
        body = json.loads(event['body'])
        email = body.get('email')
        password = body.get('password')
        nombre = body.get('nombre')
        telefono = body.get('telefono', '')
        
        if not email or not password or not nombre:
            return response(400, {
                'success': False,
                'error': {
                    'code': 'MISSING_FIELDS',
                    'message': 'Email, password y nombre son requeridos'
                }
            })
        
        # Verificar si el email ya existe
        result = usuarios_table.query(
            IndexName='email-index',
            KeyConditionExpression='email = :email',
            ExpressionAttributeValues={':email': email}
        )
        
        if result.get('Items'):
            return response(400, {
                'success': False,
                'error': {
                    'code': 'EMAIL_EXISTS',
                    'message': 'El email ya está registrado'
                }
            })
        
        # Crear usuario
        import uuid
        user_id = f"user_{uuid.uuid4().hex[:8]}"
        timestamp = datetime.utcnow().isoformat()
        
        usuario = {
            'id': user_id,
            'email': email,
            'nombre': nombre,
            'telefono': telefono,
            'passwordHash': hash_password(password),
            'role': 'admin',
            'tandas': [],
            'createdAt': timestamp,
            'updatedAt': timestamp,
            'lastLogin': timestamp
        }
        print(f'usuario a crear: {usuario}')
        
        usuarios_table.put_item(Item=usuario)
        
        # Generar tokens
        token = generate_token(user_id, email)
        refresh_token = generate_refresh_token(user_id)
        
        return response(201, {
            'success': True,
            'data': {
                'id': user_id,
                'email': email,
                'nombre': nombre,
                'token': token,
                'refreshToken': refresh_token,
                'expiresIn': 3600
            }
        })
        
    except Exception as e:
        print(f"Error en register: {str(e)}")
        return response(500, {
            'success': False,
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': 'Error al registrar usuario'
            }
        })

# ========================================
# HANDLER: REFRESH TOKEN
# ========================================
def refresh_token_handler(event, context):
    try:
        body = json.loads(event['body'])
        refresh_token = body.get('refreshToken')
        
        if not refresh_token:
            return response(400, {
                'success': False,
                'error': {
                    'code': 'MISSING_TOKEN',
                    'message': 'Refresh token es requerido'
                }
            })
        
        # Verificar refresh token
        try:
            payload = jwt.decode(refresh_token, JWT_REFRESH_SECRET, algorithms=['HS256'])
            print(f'payload: {payload}')
            user_id = payload['id']
            
        except jwt.ExpiredSignatureError:
            return response(401, {
                'success': False,
                'error': {
                    'code': 'TOKEN_EXPIRED',
                    'message': 'Refresh token expirado'
                }
            })
        except jwt.InvalidTokenError:
            return response(401, {
                'success': False,
                'error': {
                    'code': 'INVALID_TOKEN',
                    'message': 'Refresh token inválido'
                }
            })
        
        # Obtener usuario
        result = usuarios_table.get_item(Key={'id': user_id})
        
        if not result.get('Item'):
            return response(404, {
                'success': False,
                'error': {
                    'code': 'USER_NOT_FOUND',
                    'message': 'Usuario no encontrado'
                }
            })
        
        usuario = result['Item']
        
        # Generar nuevo access token y rotar el refresh token (sliding expiration)
        new_token = generate_token(user_id, usuario['email'])
        new_refresh_token = generate_refresh_token(user_id)

        return response(200, {
            'success': True,
            'data': {
                'token': new_token,
                'refreshToken': new_refresh_token,
                'expiresIn': 3600
            }
        })
        
    except Exception as e:
        print(f"Error en refresh token: {str(e)}")
        return response(500, {
            'success': False,
            'error': {
                'code': 'INTERNAL_SERVER_ERROR',
                'message': 'Error al refrescar token'
            }
        })

def eliminar_usuario(event, context):
    """
    Elimina completamente la cuenta de un usuario y todos sus datos relacionados:
    - Usuario de la tabla Usuarios
    - Todas las tandas creadas por el usuario
    - Todos los participantes de esas tandas
    - Todos los pagos de esas tandas
    - Todos los links de registro de esas tandas
    """
    
    try:
        # Obtener userId del token JWT (headers de autorización)
        user_id = extract_user_id(event)
        if not user_id:
            return response(401, {
                'success': False,
                'error': {
                    'code': 'UNAUTHORIZED',
                    'message': 'Token inválido o expirado'
                }
            })
        
        print(f"🗑️ Iniciando eliminación de cuenta para usuario: {user_id}")
        
        # Contadores para el reporte
        contadores = {
            'tandas_eliminadas': 0,
            'participantes_eliminados': 0,
            'pagos_eliminados': 0,
            'links_eliminados': 0
        }
        
        # 1. Obtener todas las tandas del usuario
        print(f"📊 Buscando tandas del usuario {user_id}...")
        tandas_table = dynamodb.Table('tandas')
        tandas_response = tandas_table.query(
            IndexName='adminId-index',  # Asegúrate de tener este GSI
            KeyConditionExpression=Key('adminId').eq(user_id)
        )
        
        tandas = tandas_response.get('Items', [])
        print(f"✅ Encontradas {len(tandas)} tandas para eliminar")
        
        # 2. Para cada tanda, eliminar todos los datos relacionados
        participantes_table = dynamodb.Table('participantes')
        pagos_table = dynamodb.Table('pagos')
        links_table = dynamodb.Table('links_registro')
        for tanda in tandas:
            tanda_id = tanda['id']
            print(f"🗑️ Procesando tanda: {tanda_id}")
            
            # 2a. Eliminar participantes de esta tanda
            participantes_response = participantes_table.query(
                KeyConditionExpression=Key('id').eq(tanda_id)
            )
            
            participantes = participantes_response.get('Items', [])
            print(f"  👥 Eliminando {len(participantes)} participantes...")
            
            for participante in participantes:
                participantes_table.delete_item(
                    Key={
                        'id': tanda_id,
                        'participanteId': participante['participanteId']
                    }
                )
                contadores['participantes_eliminados'] += 1
            
            # 2b. Eliminar pagos de esta tanda
            pagos_response = pagos_table.query(
                KeyConditionExpression=Key('id').eq(tanda_id)
            )
            
            pagos = pagos_response.get('Items', [])
            print(f"  💰 Eliminando {len(pagos)} pagos...")
            
            for pago in pagos:
                pagos_table.delete_item(
                    Key={
                        'id': pago['id'],
                        'pagoId': pago['pagoId']
                    }
                )
                contadores['pagos_eliminados'] += 1
            
            # 2c. Eliminar links de registro de esta tanda
            links_response = links_table.query(
                IndexName='tandaId-index',  # Asegúrate de tener este GSI
                KeyConditionExpression=Key('tandaId').eq(tanda_id)
            )
            
            links = links_response.get('Items', [])
            print(f"  🔗 Eliminando {len(links)} links de registro...")
            
            for link in links:
                links_table.delete_item(
                    Key={
                        'token': link['token']
                    }
                )
                contadores['links_eliminados'] += 1
            
            # 2d. Eliminar la tanda
            tandas_table.delete_item(
                Key={
                    'id': tanda_id
                }
            )
            contadores['tandas_eliminadas'] += 1
            print(f"  ✅ Tanda {tanda_id} eliminada completamente")
        
        # 3. Eliminar el usuario
        print(f"🗑️ Eliminando usuario {user_id}...")
        usuarios_table.delete_item(
            Key={
                'id': user_id
            }
        )
        
        print(f"✅ Usuario {user_id} eliminado completamente")
        
        # Preparar respuesta
        response_body = {
            'success': True,
            'message': 'Cuenta eliminada exitosamente',
            'data': {
                'userId': user_id,
                'eliminados': contadores,
                'timestamp': datetime.utcnow().isoformat()
            }
        }
        
        print(f"📊 Resumen de eliminación: {contadores}")
        
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,Authorization',
                'Access-Control-Allow-Methods': 'DELETE,OPTIONS'
            },
            'body': json.dumps(response_body)
        }
        
    except KeyError as e:
        print(f"❌ Error: Falta información de autorización - {str(e)}")
        return {
            'statusCode': 401,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': {
                    'code': 'UNAUTHORIZED',
                    'message': 'No autorizado. Token inválido o expirado.'
                }
            })
        }
    
    except Exception as e:
        print(f"❌ Error eliminando cuenta: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'success': False,
                'error': {
                    'code': 'DELETE_ERROR',
                    'message': f'Error al eliminar la cuenta: {str(e)}'
                }
            })
        }


def update_register(event, context):
    """
    PUT /auth/register
    Marca una cuenta de usuario para eliminación
    """
    
    # CORS headers
    headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Headers': 'Content-Type',
        'Access-Control-Allow-Methods': 'PUT, OPTIONS',
        'Content-Type': 'application/json'
    }
    
    try:
        # Parse request body
        body = json.loads(event.get('body', '{}'))
        
        email = body.get('email', '').strip().lower()
        phone = body.get('phone', '').strip() if body.get('phone') else None
        reason = body.get('reason', '').strip() if body.get('reason') else None
        
        # Validación básica
        if not email:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'message': 'El correo electrónico es requerido'
                })
            }
        
        # Validar formato de email
        if '@' not in email or '.' not in email:
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'message': 'Por favor ingresa un correo electrónico válido'
                })
            }
        
        # Buscar usuario por email
        user = find_user_by_email(email)
        
        if not user:
            return {
                'statusCode': 404,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'message': 'No se encontró una cuenta asociada a este correo electrónico'
                })
            }
        
        # Verificar si ya tiene una solicitud de eliminación activa
        if user.get('solicitudEliminacion', {}).get('estado') == 'PENDIENTE':
            return {
                'statusCode': 400,
                'headers': headers,
                'body': json.dumps({
                    'success': False,
                    'message': 'Ya existe una solicitud de eliminación activa para esta cuenta'
                })
            }
        
        # Calcular fecha de eliminación (30 días desde ahora)
        deletion_date = datetime.now() + timedelta(days=30)
        
        # Actualizar usuario con solicitud de eliminación
        update_user_deletion_request(
            user['id'],
            email,
            phone,
            reason,
            deletion_date.isoformat()
        )
        
        return {
            'statusCode': 200,
            'headers': headers,
            'body': json.dumps({
                'success': True,
                'message': 'Tu solicitud de eliminación ha sido procesada exitosamente. Tu cuenta será eliminada en un plazo máximo de 30 días.',
                'data': {
                    'email': email,
                    'deletionDate': deletion_date.strftime('%Y-%m-%d'),
                    'daysRemaining': 30
                }
            })
        }
        
    except Exception as e:
        print(f"❌ Error processing deletion request: {str(e)}")
        import traceback
        traceback.print_exc()
        
        return {
            'statusCode': 500,
            'headers': headers,
            'body': json.dumps({
                'success': False,
                'message': 'Error interno del servidor. Por favor, intenta nuevamente.'
            })
        }


def find_user_by_email(email):
    """
    Busca un usuario por email en la tabla usuarios_admin
    """
    try:
        
        # Query by index
        response = usuarios_table.query(
            IndexName='email-index',
            KeyConditionExpression='email = :email',
            ExpressionAttributeValues={':email': email}
        )
        
         # Verificar si se encontró el usuario
        if response.get('Items') and len(response['Items']) > 0:
            user = convert_decimals(response['Items'][0])
            print(f"✅ Usuario encontrado: {user.get('id')}")
            return user
        
        return None
        
    except Exception as e:
        print(f"❌ Error finding user: {str(e)}")
        return None


def update_user_deletion_request(user_id, email, phone, reason, deletion_date):
    """
    Actualiza el usuario agregando la solicitud de eliminación
    """
    try:
        
        # Preparar el objeto de solicitud de eliminación
        deletion_request = {
            'estado': 'PENDIENTE',
            'fechaSolicitud': datetime.now().isoformat(),
            'fechaEliminacionProgramada': deletion_date,
            'email': email,
            'motivo': reason if reason else 'No proporcionado'
        }
        
        # Agregar teléfono solo si fue proporcionado
        if phone:
            deletion_request['telefono'] = phone
        
        # Actualizar el registro del usuario
        update_expression = 'SET solicitudEliminacion = :request, estadoCuenta = :status, fechaActualizacion = :updated'
        expression_values = {
            ':request': deletion_request,
            ':status': 'PENDIENTE_ELIMINACION',
            ':updated': datetime.now().isoformat()
        }
        
        usuarios_table.update_item(
            Key={'id': user_id},
            UpdateExpression=update_expression,
            ExpressionAttributeValues=expression_values
        )
        
        print(f"✅ Usuario {user_id} marcado para eliminación")
        
        return True
        
    except Exception as e:
        print(f"❌ Error updating user deletion request: {str(e)}")
        raise e

def lambda_handler(event, context):
    print(f"event: {event}")
    method = event.get("httpMethod")
    path = event.get("path")
    routeKey = event.get('routeKey')
    print(f'routeKey: {routeKey}')
    
    try:
        status_code = 200
        if routeKey == 'POST /auth/login':
            print('/auth/login')
            return login(event,context)
        
        elif routeKey == 'POST /auth/refresh':
            print('/auth/refresh')
            return refresh_token_handler(event,context)
        
        elif routeKey == 'POST /auth/register':
            print('/auth/register')
            return register(event,context)
        
        elif routeKey == 'PUT /auth/register':
            print('/auth/register')
            return update_register(event,context)
        
        elif routeKey == 'DELETE /auth/account':
            print('delete /auth/account')
            return eliminar_usuario(event,context)
            
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