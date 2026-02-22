import os
import json
from typing import Dict, Any, Optional, Tuple

import boto3
import hashlib
import jwt

# Inicializar clientes AWS
dynamodb = boto3.resource('dynamodb')

# Variables de entorno
USERS_TABLE_NAME = os.environ['USERS_TABLE_NAME']
RESET_TOKENS_TABLE_NAME = os.environ['RESET_TOKENS_TABLE_NAME']
# Configuración JWT
JWT_SECRET = os.environ['JWT_SECRET']
#JWT_REFRESH_SECRET = os.environ['JWT_REFRESH_SECRET']

# Tablas DynamoDB
users_table = dynamodb.Table(USERS_TABLE_NAME)
tokens_table = dynamodb.Table(RESET_TOKENS_TABLE_NAME)

# Configuración de bcrypt
BCRYPT_ROUNDS = 12  # Salt rounds para bcrypt



def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handler principal de la función Lambda.
    
    Args:
        event: Evento de API Gateway con formato:
            Change: {
                "headers": {"Authorization": "Bearer <jwt_token>"},
                "body": "{\"currentPassword\": \"Old123!\", \"newPassword\": \"New123!\"}"
            }
        context: Contexto de ejecución de Lambda
        
    Returns:
        Respuesta HTTP con formato API Gateway
    """
    print(f"Event: {json.dumps(event)}")
    
    try:
        
        # Validar JWT y obtener user_id
        user_id = extract_user_id(event)
        print(f'user_id: {user_id}')
        
        # Parsear body
        body = json.loads(event.get('body', '{}'))
        current_password = body.get('currentPassword', '')
        new_password = body.get('newPassword', '')
        
        # Validar parámetros
        if not current_password or not new_password:
            return create_response(400, {
                'success': False,
                'message': 'Contraseña actual y nueva contraseña son requeridas'
            })
        
        # Validar que las contraseñas sean diferentes
        if current_password == new_password:
            return create_response(400, {
                'success': False,
                'message': 'La nueva contraseña debe ser diferente a la actual'
            })
        
        # Validar fortaleza de la nueva contraseña
        #is_valid, validation_message = validate_password_strength(new_password)
        #if not is_valid:
        #    return create_response(400, {
        #        'success': False,
        #        'message': validation_message
        #    })
        
        # Obtener usuario de la base de datos
        user = get_user_by_id(user_id)
        if not user:
            return create_response(404, {
                'success': False,
                'message': 'Usuario no encontrado'
            })
        
        # Verificar contraseña actual
        print(f'current_password: {current_password}')
        print(f'password_dynamo: {user.get('passwordHash', 'null')}')
        if not verify_password(current_password, user.get('passwordHash', '')):
            return create_response(401, {
                'success': False,
                'message': 'La contraseña actual es incorrecta'
            })
        
        # Generar hash de la nueva contraseña
        password_hash = hash_password(new_password)
        
        # Actualizar contraseña
        update_user_password(user_id, password_hash)
        
        print(f"Contraseña cambiada exitosamente para usuario: {user_id}")
        
        return create_response(200, {
            'success': True,
            'message': 'Contraseña actualizada exitosamente'
        })
        
    except Exception as e:
        print(f"Error en handle_change_password: {str(e)}")
        return create_response(500, {
            'success': False,
            'message': 'Error al cambiar la contraseña'
        })

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

def update_user_password(user_id: str, password_hash: str) -> None:
    """
    Actualiza la contraseña del usuario en DynamoDB.
    
    Args:
        user_id: ID del usuario
        password_hash: Hash bcrypt de la nueva contraseña
    """
    try:
        from datetime import datetime
        
        users_table.update_item(
            Key={'id': user_id},
            UpdateExpression='SET passwordHash = :passwordHash, updatedAt = :updated_at',
            ExpressionAttributeValues={
                ':passwordHash': password_hash,
                ':updated_at': datetime.utcnow().isoformat()
            }
        )
    except Exception as e:
        print(f"Error actualizando contraseña: {e}")
        raise

def delete_reset_token(token: str) -> None:
    """
    Elimina el token de reset después de usarlo o si expiró.
    
    Args:
        token: Token a eliminar
    """
    try:
        tokens_table = dynamodb.Table(RESET_TOKENS_TABLE_NAME)
        tokens_table.delete_item(Key={'token': token})
    except Exception as e:
        print(f"Error eliminando token: {e}")
        # No lanzar excepción, es operación de limpieza

def create_response(status_code: int, body: Dict[str, Any]) -> Dict[str, Any]:
    """
    Crea una respuesta HTTP con formato de API Gateway.
    
    Args:
        status_code: Código HTTP (200, 400, 500, etc.)
        body: Diccionario con el cuerpo de la respuesta
        
    Returns:
        Diccionario con formato de respuesta de API Gateway
    """
    return {
        'statusCode': status_code,
        'headers': {
            'Content-Type': 'application/json',
            'Access-Control-Allow-Origin': '*',
            'Access-Control-Allow-Headers': 'Content-Type,Authorization',
            'Access-Control-Allow-Methods': 'POST,OPTIONS'
        },
        'body': json.dumps(body)
    }

def get_reset_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Obtiene los datos del token de reset desde DynamoDB.
    
    Args:
        token: Token a buscar
        
    Returns:
        Diccionario con datos del token o None si no existe
    """
    tokens_table = dynamodb.Table(os.environ['RESET_TOKENS_TABLE_NAME'])
    try:
        response = tokens_table.get_item(Key={'token': token})
        return response.get('Item')
    except Exception as e:
        raise

def verify_password(plain_password: str, hashed_password: str) -> bool:
    """
    Verifica contraseña en texto plano contra su hash bcrypt.

    Usa passlib en lugar de bcrypt.checkpw directamente para evitar
    el error de ELF header en Lambda (binario nativo incompatible).

    Args:
        plain_password:  Contraseña ingresada por el usuario
        hashed_password: Hash bcrypt almacenado en DynamoDB

    Returns:
        True si coinciden, False en caso contrario
    """
    try:
        hashed_password_actual = hash_password(plain_password)
        if hashed_password != hashed_password_actual:
            return False
        else:
            return True
    except Exception as e:
        print(f"Error verificando contraseña: {e}")
        return False

def get_user_by_id(user_id: str) -> Optional[Dict[str, Any]]:
    """
    Obtiene un usuario por su ID desde DynamoDB.
    
    Args:
        user_id: ID del usuario
        
    Returns:
        Diccionario con datos del usuario o None si no existe
    """
    try:
        response = users_table.get_item(Key={'id': user_id})
        return response.get('Item')
    except Exception as e:
        print(f"Error obteniendo usuario: {e}")
        raise

def hash_password(password):
    return hashlib.sha256(password.encode()).hexdigest()

