"""
Lambda Function: Reset Password
Valida token y actualiza contraseña del usuario.

Flujo:
1. Recibe token y nueva contraseña
2. Valida token en DynamoDB
3. Verifica que no haya expirado
4. Valida fortaleza de la contraseña
5. Genera hash bcrypt de la nueva contraseña
6. Actualiza contraseña en tabla de usuarios
7. Elimina token usado

Environment Variables:
- USERS_TABLE_NAME: Tabla DynamoDB de usuarios
- RESET_TOKENS_TABLE_NAME: Tabla DynamoDB de tokens
"""

import os
import json
import re
import time
from typing import Dict, Any, Optional, Tuple

import boto3
import bcrypt
from botocore.exceptions import ClientError

# Inicializar clientes AWS
dynamodb = boto3.resource('dynamodb')

# Variables de entorno
USERS_TABLE_NAME = os.environ['USERS_TABLE_NAME']
RESET_TOKENS_TABLE_NAME = os.environ['RESET_TOKENS_TABLE_NAME']

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
            {
                "body": "{\"token\": \"abc123\", \"newPassword\": \"Pass123!\"}"
            }
        context: Contexto de ejecución de Lambda
        
    Returns:
        Respuesta HTTP con formato API Gateway
    """
    print(f"Event: {json.dumps(event)}")
    
    try:
        # Parsear body del request
        body = json.loads(event.get('body', '{}'))
        token = body.get('token', '').strip()
        new_password = body.get('newPassword', '')
        
        # Validar parámetros
        if not token or not new_password:
            return create_response(400, {
                'success': False,
                'message': 'Token y nueva contraseña son requeridos'
            })
        
        # Validar fortaleza de contraseña
        is_valid, validation_message = validate_password_strength(new_password)
        if not is_valid:
            return create_response(400, {
                'success': False,
                'message': validation_message
            })
        
        # Verificar token
        token_data = get_reset_token(token)
        if not token_data:
            return create_response(400, {
                'success': False,
                'message': 'Token inválido o expirado'
            })
        
        # Verificar expiración
        current_time = int(time.time())
        if current_time > token_data['expiresAt']:
            # Token expirado, eliminarlo
            delete_reset_token(token)
            return create_response(400, {
                'success': False,
                'message': 'El token ha expirado. Solicita un nuevo enlace de recuperación'
            })
        
        # Generar hash de la nueva contraseña
        password_hash = hash_password(new_password)
        
        # Actualizar contraseña del usuario
        update_user_password(token_data['userId'], password_hash)
        
        # Eliminar token usado
        delete_reset_token(token)
        
        print(f"Contraseña actualizada exitosamente para usuario: {token_data['userId']}")
        
        return create_response(200, {
            'success': True,
            'message': 'Contraseña actualizada exitosamente'
        })
        
    except Exception as e:
        print(f"Error en reset_password: {str(e)}")
        return create_response(500, {
            'success': False,
            'message': 'Error al resetear la contraseña'
        })


def validate_password_strength(password: str) -> Tuple[bool, str]:
    """
    Valida la fortaleza de la contraseña según políticas de seguridad.
    
    Requisitos:
    - Mínimo 8 caracteres
    - Máximo 128 caracteres (prevención DoS)
    - Al menos 1 letra mayúscula
    - Al menos 1 letra minúscula
    - Al menos 1 número
    - Al menos 1 carácter especial
    
    Args:
        password: Contraseña a validar
        
    Returns:
        Tupla (es_válida, mensaje)
    """
    # Longitud mínima
    if len(password) < 8:
        return False, 'La contraseña debe tener al menos 8 caracteres'
    
    # Longitud máxima (seguridad contra DoS)
    if len(password) > 128:
        return False, 'La contraseña no puede exceder 128 caracteres'
    
    # Letra mayúscula
    if not re.search(r'[A-Z]', password):
        return False, 'La contraseña debe contener al menos una letra mayúscula'
    
    # Letra minúscula
    if not re.search(r'[a-z]', password):
        return False, 'La contraseña debe contener al menos una letra minúscula'
    
    # Número
    if not re.search(r'[0-9]', password):
        return False, 'La contraseña debe contener al menos un número'
    
    # Carácter especial
    if not re.search(r'[!@#$%^&*()_+\-=\[\]{};\':"\\|,.<>\/?]', password):
        return False, 'La contraseña debe contener al menos un carácter especial'
    
    return True, 'Contraseña válida'


def hash_password(password: str) -> str:
    """
    Genera hash bcrypt de la contraseña.
    
    Args:
        password: Contraseña en texto plano
        
    Returns:
        Hash bcrypt de la contraseña (string)
    """
    # Convertir password a bytes
    password_bytes = password.encode('utf-8')
    
    # Generar salt y hash
    salt = bcrypt.gensalt(rounds=BCRYPT_ROUNDS)
    password_hash = bcrypt.hashpw(password_bytes, salt)
    
    # Convertir hash a string
    return password_hash.decode('utf-8')


def get_reset_token(token: str) -> Optional[Dict[str, Any]]:
    """
    Obtiene los datos del token de reset desde DynamoDB.
    
    Args:
        token: Token a buscar
        
    Returns:
        Diccionario con datos del token o None si no existe
    """
    try:
        response = tokens_table.get_item(Key={'token': token})
        return response.get('Item')
    except ClientError as e:
        print(f"Error obteniendo token: {e}")
        raise


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
            UpdateExpression='SET password = :password, updatedAt = :updated_at',
            ExpressionAttributeValues={
                ':password': password_hash,
                ':updated_at': datetime.utcnow().isoformat()
            }
        )
    except ClientError as e:
        print(f"Error actualizando contraseña: {e}")
        raise


def delete_reset_token(token: str) -> None:
    """
    Elimina el token de reset después de usarlo o si expiró.
    
    Args:
        token: Token a eliminar
    """
    try:
        tokens_table.delete_item(Key={'token': token})
    except ClientError as e:
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
