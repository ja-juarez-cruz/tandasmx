# ========================================
# LAMBDA: authorizer.py
# Authorizer personalizado para API Gateway
# Valida tokens JWT
# ========================================

import json
import jwt
import os

JWT_SECRET = os.environ['JWT_SECRET']

def handler(event, context):
    """
    Lambda Authorizer para API Gateway
    Valida el token JWT y retorna una política de acceso
    """
    try:
        # Extraer token
        print(f'event: {event}')
        token = event.get('headers',{}).get('authorization',None)
        print(f'token: {token}')
        
        if not token:
            print('No authorization header found')
            return {
                'isAuthorized': False
            }
        
        # Remover "Bearer " si existe
        token = token.replace('Bearer ', '')
        
        # Verificar token
        try:
            payload = jwt.decode(token, JWT_SECRET, algorithms=['HS256'])
            user_id = payload.get('id')
            email = payload.get('email')
            
            print(f"Token válido para user: {user_id}")
            
            # Respuesta simple para HTTP API v2
            # Con enable_simple_responses = true en Terraform
            return {
                'isAuthorized': True,
                'context': {
                    'userId': user_id,
                    'email': email
                }
            }
            
        except jwt.ExpiredSignatureError:
            print('Token expirado')
            return {
                'isAuthorized': False
            }
        except jwt.InvalidTokenError as e:
            print(f'Token inválido: {str(e)}')
            return {
                'isAuthorized': False
            }
        except Exception as e:
            print(f'Error validando token: {str(e)}')
            return {
                'isAuthorized': False
            }
        
    except Exception as e:
        print(f"Error en authorizer: {str(e)}")
        return {
            'isAuthorized': False
        }

def generate_policy(principal_id, effect, resource):
    """Genera la política de acceso IAM"""
    auth_response = {
        'principalId': principal_id
    }
    
    if effect and resource:
        policy_document = {
            'Version': '2012-10-17',
            'Statement': [
                {
                    'Action': 'execute-api:Invoke',
                    'Effect': effect,
                    'Resource': resource
                }
            ]
        }
        auth_response['policyDocument'] = policy_document
    
    return auth_response
