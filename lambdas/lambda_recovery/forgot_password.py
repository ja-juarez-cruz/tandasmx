"""
Lambda Function: Forgot Password
Genera token de reset y envía email de recuperación.

Flujo:
1. Recibe email del usuario
2. Valida formato de email
3. Busca usuario en DynamoDB
4. Genera token seguro
5. Guarda token en DynamoDB con TTL
6. Envía email vía SES con link de reset

Environment Variables:
- USERS_TABLE_NAME: Tabla DynamoDB de usuarios
- RESET_TOKENS_TABLE_NAME: Tabla DynamoDB de tokens
- SUPPORT_EMAIL: Email remitente (verificado en SES)
- FRONTEND_URL: URL del frontend para generar link
- TOKEN_EXPIRATION_HOURS: Horas de validez del token
"""

import os
import json
import re
import secrets
import time
from datetime import datetime, timedelta
from typing import Dict, Any, Optional

import boto3
from botocore.exceptions import ClientError

# Inicializar clientes AWS
dynamodb = boto3.resource('dynamodb')
ses_client = boto3.client('ses')

# Variables de entorno
USERS_TABLE_NAME = os.environ['USERS_TABLE_NAME']
RESET_TOKENS_TABLE_NAME = os.environ['RESET_TOKENS_TABLE_NAME']
SUPPORT_EMAIL = os.environ['SUPPORT_EMAIL']
FRONTEND_URL = os.environ['FRONTEND_URL']
TOKEN_EXPIRATION_HOURS = int(os.environ.get('TOKEN_EXPIRATION_HOURS', '24'))

# Tablas DynamoDB
users_table = dynamodb.Table(USERS_TABLE_NAME)
tokens_table = dynamodb.Table(RESET_TOKENS_TABLE_NAME)


def handler(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Handler principal de la función Lambda.
    
    Args:
        event: Evento de API Gateway con formato:
            {
                "body": "{\"email\": \"usuario@example.com\"}"
            }
        context: Contexto de ejecución de Lambda
        
    Returns:
        Respuesta HTTP con formato API Gateway:
            {
                "statusCode": 200,
                "body": "{\"success\": true, \"message\": \"...\"}"
            }
    """
    print(f"Event: {json.dumps(event)}")
    
    try:
        # Parsear body del request
        body = json.loads(event.get('body', '{}'))
        email = body.get('email', '').strip().lower()
        
        # Validar email
        if not email or not is_valid_email(email):
            return create_response(400, {
                'success': False,
                'message': 'Email inválido'
            })
        
        # Buscar usuario por email
        user = get_user_by_email(email)
        
        # Por seguridad, siempre devolver el mismo mensaje
        # (previene enumeración de usuarios)
        standard_message = (
            'Si el correo existe en nuestro sistema, '
            'recibirás instrucciones para resetear tu contraseña'
        )
        
        if not user:
            print(f"Usuario no encontrado: {email}")
            return create_response(200, {
                'success': True,
                'message': standard_message
            })
        
        # Generar token seguro
        token = generate_secure_token()
        
        # Calcular timestamp de expiración
        expires_at = int(time.time()) + (TOKEN_EXPIRATION_HOURS * 3600)
        
        # Guardar token en DynamoDB
        save_reset_token(
            token=token,
            email=email,
            user_id=user['id'],
            expires_at=expires_at
        )
        
        # Generar URL de reset
        reset_url = f"{FRONTEND_URL}/reset-password/{token}"
        
        # Enviar email
        send_reset_email(
            to_email=email,
            reset_url=reset_url,
            expiration_hours=TOKEN_EXPIRATION_HOURS
        )
        
        print(f"Token generado exitosamente para: {email}")
        
        return create_response(200, {
            'success': True,
            'message': standard_message
        })
        
    except Exception as e:
        print(f"Error en forgot_password: {str(e)}")
        return create_response(500, {
            'success': False,
            'message': 'Error al procesar la solicitud'
        })


def is_valid_email(email: str) -> bool:
    """
    Valida formato de email usando regex.
    
    Args:
        email: Email a validar
        
    Returns:
        True si el formato es válido, False en caso contrario
    """
    pattern = r'^[a-zA-Z0-9._%+-]+@[a-zA-Z0-9.-]+\.[a-zA-Z]{2,}$'
    return bool(re.match(pattern, email))


def get_user_by_email(email: str) -> Optional[Dict[str, Any]]:
    """
    Busca un usuario por email en la tabla de usuarios.
    
    Nota: Asume que existe un atributo 'email' en la tabla usuarios_admin.
    Si no hay GSI, hace un scan (menos eficiente).
    
    Args:
        email: Email del usuario a buscar
        
    Returns:
        Diccionario con datos del usuario o None si no existe
    """
    try:
        # Intenta usar scan (considera crear GSI en usuarios_admin para mejor rendimiento)
        response = users_table.query(
            IndexName='email-index',
            KeyConditionExpression='email = :email',
            ExpressionAttributeValues={':email': email}
        )
        
        if response.get('Items'):
            return response['Items'][0]
        
        return None
        
    except ClientError as e:
        print(f"Error buscando usuario: {e}")
        raise


def generate_secure_token() -> str:
    """
    Genera un token seguro usando secrets.token_urlsafe.
    
    Returns:
        Token de 64 caracteres URL-safe
    """
    return secrets.token_urlsafe(48)  # 48 bytes = ~64 caracteres


def save_reset_token(
    token: str,
    email: str,
    user_id: str,
    expires_at: int
) -> None:
    """
    Guarda el token de reset en DynamoDB.
    
    Args:
        token: Token generado
        email: Email del usuario
        user_id: ID del usuario
        expires_at: Timestamp Unix de expiración (para TTL)
    """
    try:
        tokens_table.put_item(
            Item={
                'token': token,
                'email': email,
                'userId': user_id,
                'expiresAt': expires_at,
                'createdAt': datetime.utcnow().isoformat()
            }
        )
    except ClientError as e:
        print(f"Error guardando token: {e}")
        raise


def send_reset_email(
    to_email: str,
    reset_url: str,
    expiration_hours: int
) -> None:
    """
    Envía email de recuperación de contraseña vía AWS SES.
    
    Args:
        to_email: Email destinatario
        reset_url: URL completa con token para reset
        expiration_hours: Horas de validez del link
    """
    subject = 'Recuperación de Contraseña - TandasMX'
    
    html_body = generate_email_html(reset_url, expiration_hours)
    text_body = generate_email_text(reset_url, expiration_hours)
    
    try:
        response = ses_client.send_email(
            Source=SUPPORT_EMAIL,
            Destination={'ToAddresses': [to_email]},
            Message={
                'Subject': {'Data': subject, 'Charset': 'UTF-8'},
                'Body': {
                    'Html': {'Data': html_body, 'Charset': 'UTF-8'},
                    'Text': {'Data': text_body, 'Charset': 'UTF-8'}
                }
            }
        )
        print(f"Email enviado exitosamente. MessageId: {response['MessageId']}")
    except ClientError as e:
        print(f"Error enviando email: {e}")
        raise


def generate_email_html(reset_url: str, expiration_hours: int) -> str:
    """
    Genera el contenido HTML del email.
    
    Args:
        reset_url: URL con token para reset
        expiration_hours: Horas de validez
        
    Returns:
        String con HTML del email
    """
    return f"""
<!DOCTYPE html>
<html>
<head>
    <meta charset="UTF-8">
    <title>Recuperación de Contraseña</title>
</head>
<body style="font-family: Arial, sans-serif; line-height: 1.6; color: #333; max-width: 600px; margin: 0 auto; padding: 20px;">
    <div style="background-color: #f8f9fa; padding: 20px; border-radius: 5px;">
        <h2 style="color: #2c3e50; margin-bottom: 20px;">Recuperación de Contraseña</h2>
        
        <p>Hola,</p>
        
        <p>Recibimos una solicitud para restablecer la contraseña de tu cuenta en TandasMX.</p>
        
        <p>Para crear una nueva contraseña, haz clic en el siguiente botón:</p>
        
        <div style="text-align: center; margin: 30px 0;">
            <a href="{reset_url}" 
               style="background-color: #007bff; color: white; padding: 12px 30px; text-decoration: none; border-radius: 5px; display: inline-block; font-weight: bold;">
                Restablecer Contraseña
            </a>
        </div>
        
        <p>O copia y pega este enlace en tu navegador:</p>
        <p style="background-color: #e9ecef; padding: 10px; border-radius: 3px; word-break: break-all;">
            {reset_url}
        </p>
        
        <p><strong>Este enlace expirará en {expiration_hours} horas.</strong></p>
        
        <p style="margin-top: 30px; padding-top: 20px; border-top: 1px solid #ddd; font-size: 14px; color: #666;">
            Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.
        </p>
        
        <p style="font-size: 14px; color: #666;">
            Saludos,<br>
            El equipo de TandasMX
        </p>
    </div>
</body>
</html>
    """


def generate_email_text(reset_url: str, expiration_hours: int) -> str:
    """
    Genera el contenido de texto plano del email.
    
    Args:
        reset_url: URL con token para reset
        expiration_hours: Horas de validez
        
    Returns:
        String con texto plano del email
    """
    return f"""
Recuperación de Contraseña - TandasMX

Hola,

Recibimos una solicitud para restablecer la contraseña de tu cuenta en TandasMX.

Para crear una nueva contraseña, visita el siguiente enlace:
{reset_url}

Este enlace expirará en {expiration_hours} horas.

Si no solicitaste restablecer tu contraseña, puedes ignorar este correo de forma segura.

Saludos,
El equipo de TandasMX
    """


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
