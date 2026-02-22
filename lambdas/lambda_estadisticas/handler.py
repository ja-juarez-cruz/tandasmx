# ========================================
# LAMBDA: estadisticas_handler.py
# Maneja estadísticas y reportes de tandas
# ========================================

import json
import boto3
import os
import jwt
from datetime import datetime, timedelta, timezone
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
# HANDLER: OBTENER ESTADÍSTICAS
# ========================================
def obtener_estadisticas(event, context):
    try:
        user_id = extract_user_id(event)
        if not user_id:
            return response(401, {
                'success': False,
                'error': {'code': 'UNAUTHORIZED', 'message': 'Token inválido'}
            })
        
        tanda_id = event['pathParameters']['tandaId']
        print(f'tanda_id: {tanda_id}')
        
        # Verificar permisos
        tiene_permisos, tanda = verificar_permisos_tanda(tanda_id, user_id)
        if not tiene_permisos:
            return response(403, {
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'Sin permisos'}
            })
        
        # 🆕 DETECTAR SI ES TANDA CUMPLEAÑERA
        es_cumpleañera = tanda.get('frecuencia') == 'cumpleaños'
        print(f'Es tanda cumpleañera: {es_cumpleañera}')
        
        # Obtener participantes
        participantes_result = participantes_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={':tandaId': tanda_id}
        )
        participantes = participantes_result.get('Items', [])
        print(f'Total participantes: {len(participantes)}')
        
        # 🆕 ORDENAR PARTICIPANTES SEGÚN TIPO DE TANDA
        if es_cumpleañera:
            # Ordenar por fecha de cumpleaños
            def ordenar_cumpleañera(p):
                if p.get('fechaCumpleaños'):
                    try:
                        fecha = datetime.fromisoformat(p['fechaCumpleaños'])
                        fecha_registro = datetime.fromisoformat(p.get('fechaRegistro', p.get('createdAt')))
                        return (fecha.month, fecha.day, fecha_registro.timestamp())
                    except:
                        return (13, 32, 0)
                return (13, 32, 0)
            
            participantes.sort(key=ordenar_cumpleañera)
        else:
            # Ordenar por número asignado
            participantes.sort(key=lambda p: p.get('numeroAsignado', 999))
        
        # Obtener pagos
        pagos_result = pagos_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={':tandaId': tanda_id}
        )
        pagos = pagos_result.get('Items', [])
        print(f'Total pagos: {len(pagos)}')
        
        # Calcular estadísticas
        total_participantes = len(participantes)
        ronda_actual = int(tanda['rondaActual'])
        total_rondas = int(tanda['totalRondas'])
        monto_por_ronda = float(tanda['montoPorRonda'])
        
        # Calcular estado de cada participante
        participantes_al_corriente = 0
        participantes_atrasados = 0
        participantes_adelantados = 0
        
        for participante in participantes:
            pagos_participante = [
                p for p in pagos 
                if p['participanteId'] == participante['participanteId'] and p.get('pagado', False)
            ]
            pagos_realizados = len(pagos_participante)
            pagos_esperados = ronda_actual - 1
            
            if pagos_realizados >= pagos_esperados:
                participantes_al_corriente += 1
            elif pagos_realizados < pagos_esperados:
                participantes_atrasados += 1
            
            if pagos_realizados > pagos_esperados:
                participantes_adelantados += 1
        
        # Total recaudado
        pagos_realizados = [p for p in pagos if p.get('pagado', False)]
        total_recaudado = sum(float(p.get('monto', monto_por_ronda)) for p in pagos_realizados)
        
        # 🆕 TOTAL ESPERADO SEGÚN TIPO DE TANDA
        if es_cumpleañera:
            # En tanda cumpleañera: cada participante da a todos los demás
            # Total esperado = monto × (total_participantes - 1) × participantes que ya cumplieron
            total_esperado = monto_por_ronda * total_participantes * (ronda_actual - 1)
        else:
            # Tanda normal
            total_esperado = monto_por_ronda * total_participantes * (ronda_actual - 1)
        
        # Porcentaje de recaudación
        porcentaje_recaudacion = (total_recaudado / total_esperado * 100) if total_esperado > 0 else 0
        
        # Progreso de la tanda
        progreso_tanda = round((ronda_actual / total_rondas) * 100)
        
        # 🆕 ENCONTRAR PRÓXIMO NÚMERO SEGÚN TIPO DE TANDA
        print('Encontrando próximo número...')
        proximo_numero = None
        
        if es_cumpleañera:
            # Para tanda cumpleañera: buscar el próximo cumpleaños
            hoy = datetime.now(timezone.utc)
            
            # Crear lista de próximos cumpleaños
            proximos_cumpleaños = []
            
            for participante in participantes:
                if participante.get('fechaCumpleaños'):
                    try:
                        fecha_cumple = datetime.fromisoformat(participante['fechaCumpleaños'])
                        
                        # Calcular próximo cumpleaños este año
                        cumple_este_año = fecha_cumple.replace(year=hoy.year)
                        
                        # Si ya pasó este año, usar el del año siguiente
                        if cumple_este_año < hoy:
                            cumple_este_año = cumple_este_año.replace(year=hoy.year + 1)
                        
                        dias_faltantes = (cumple_este_año - hoy).days
                        
                        proximos_cumpleaños.append({
                            'participante': participante,
                            'fechaCumpleaños': cumple_este_año,
                            'diasFaltantes': dias_faltantes
                        })
                    except Exception as e:
                        print(f"Error procesando cumpleaños de {participante.get('nombre')}: {e}")
            
            # Ordenar por días faltantes y tomar el más próximo
            if proximos_cumpleaños:
                proximos_cumpleaños.sort(key=lambda x: x['diasFaltantes'])
                proximo = proximos_cumpleaños[0]
                
                proximo_numero = {
                    'participanteId': proximo['participante']['participanteId'],
                    'nombre': proximo['participante']['nombre'],
                    'numeroAsignado': proximo['participante']['numeroAsignado'],
                    'fechaEstimada': proximo['fechaCumpleaños'].strftime('%Y-%m-%d'),
                    'diasFaltantes': proximo['diasFaltantes'],
                    'esCumpleaños': True  # 🆕 Flag para identificar
                }
        else:
            # Para tanda normal: buscar por número de ronda actual
            if tanda.get('fechaInicio'):
                try:
                    for participante in participantes:
                        if participante['numeroAsignado'] == ronda_actual:
                            # Calcular fecha estimada según frecuencia
                            fecha_inicio = datetime.fromisoformat(tanda['fechaInicio'])
                            
                            frecuencia = tanda.get('frecuencia', 'semanal')
                            if frecuencia == 'semanal':
                                fecha_estimada = fecha_inicio + timedelta(weeks=ronda_actual - 1)
                            elif frecuencia == 'quincenal':
                                fecha_estimada = fecha_inicio + timedelta(weeks=(ronda_actual - 1) * 2)
                            elif frecuencia == 'mensual':
                                # Aproximación de 30 días por mes
                                fecha_estimada = fecha_inicio + timedelta(days=(ronda_actual - 1) * 30)
                            else:
                                fecha_estimada = fecha_inicio + timedelta(weeks=ronda_actual - 1)
                            
                            proximo_numero = {
                                'participanteId': participante['participanteId'],
                                'nombre': participante['nombre'],
                                'numeroAsignado': participante['numeroAsignado'],
                                'fechaEstimada': fecha_estimada.strftime('%Y-%m-%d'),
                                'esCumpleaños': False
                            }
                            break
                except Exception as e:
                    print(f"Error calculando fecha estimada: {e}")
        
        # Pagos último mes (UTC aware)
        hace_un_mes = datetime.now(timezone.utc) - timedelta(days=30)

        print('Procesando pagos del último mes...')
        def parse_fecha_pago(fecha_str):
            if not fecha_str:
                return None
            try:
                # Convierte ISO con Z a UTC aware
                if fecha_str.endswith('Z'):
                    fecha_str = fecha_str.replace('Z', '+00:00')
                fecha = datetime.fromisoformat(fecha_str)
                # Asegurar que sea aware
                if fecha.tzinfo is None:
                    fecha = fecha.replace(tzinfo=timezone.utc)
                return fecha
            except Exception as e:
                print(f"Error parseando fecha: {fecha_str}, error: {e}")
                return None

        pagos_ultimo_mes = sum(
            float(p.get('monto', 0))
            for p in pagos_realizados
            if (
                parse_fecha_pago(p.get('fechaPago')) is not None
                and parse_fecha_pago(p.get('fechaPago')) > hace_un_mes
            )
        )
        
        # Promedio por ronda
        pagos_promedio_por_ronda = total_recaudado / max(ronda_actual - 1, 1)
        print(f'Pagos promedio por ronda: {pagos_promedio_por_ronda}')
        
        # Respuesta
        return response(200, {
            'success': True,
            'data': {
                'id': tanda_id,
                'tandaId': tanda_id,
                'nombre': tanda['nombre'],
                'esCumpleañera': es_cumpleañera,  # 🆕 Informar tipo de tanda
                'estadisticas': {
                    'totalParticipantes': total_participantes,
                    'participantesAlCorriente': participantes_al_corriente,
                    'participantesAtrasados': participantes_atrasados,
                    'rondaActual': ronda_actual,
                    'totalRondas': total_rondas,
                    'progresoTanda': progreso_tanda,
                    'totalRecaudado': round(total_recaudado, 2),
                    'totalEsperado': round(total_esperado, 2),
                    'porcentajeRecaudacion': round(porcentaje_recaudacion, 2),
                    'proximoNumero': proximo_numero,
                    'pagosUltimoMes': round(pagos_ultimo_mes, 2),
                    'pagosPromedioPorRonda': round(pagos_promedio_por_ronda, 2)
                },
                'distribucionPagos': {
                    'al_corriente': participantes_al_corriente,
                    'atrasados': participantes_atrasados,
                    'adelantados': participantes_adelantados
                }
            }
        })
        
    except Exception as e:
        print(f"Error en obtener estadísticas: {str(e)}")
        import traceback
        traceback.print_exc()
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al obtener estadísticas'}
        })

# ========================================
# HANDLER: GENERAR REPORTE
# ========================================
def generar_reporte(event, context):
    try:
        user_id = extract_user_id(event)
        if not user_id:
            return response(401, {
                'success': False,
                'error': {'code': 'UNAUTHORIZED', 'message': 'Token inválido'}
            })
        
        tanda_id = event['pathParameters']['tandaId']
        
        # Obtener formato
        query_params = event.get('queryStringParameters') or {}
        formato = query_params.get('formato', 'json')
        
        # Verificar permisos
        tiene_permisos, tanda = verificar_permisos_tanda(tanda_id, user_id)
        if not tiene_permisos:
            return response(403, {
                'success': False,
                'error': {'code': 'FORBIDDEN', 'message': 'Sin permisos'}
            })
        
        # Obtener todos los datos
        participantes_result = participantes_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={':tandaId': tanda_id}
        )
        participantes = participantes_result.get('Items', [])
        
        pagos_result = pagos_table.query(
            KeyConditionExpression='id = :tandaId',
            ExpressionAttributeValues={':tandaId': tanda_id}
        )
        pagos = pagos_result.get('Items', [])
        
        # Construir reporte
        reporte = {
            'tanda': {
                'id': tanda_id,
                'nombre': tanda['nombre'],
                'montoPorRonda': float(tanda['montoPorRonda']),
                'totalRondas': int(tanda['totalRondas']),
                'rondaActual': int(tanda['rondaActual']),
                'fechaInicio': tanda['fechaInicio'],
                'status': tanda.get('status', 'active')
            },
            'participantes': [
                {
                    'participanteId': p['participanteId'],
                    'nombre': p['nombre'],
                    'telefono': p['telefono'],
                    'email': p.get('email', ''),
                    'numeroAsignado': int(p['numeroAsignado'])
                }
                for p in sorted(participantes, key=lambda x: x['numeroAsignado'])
            ],
            'pagos': [
                {
                    'pagoId': pg['pagoId'],
                    'participanteId': pg['participanteId'],
                    'ronda': int(pg['ronda']),
                    'pagado': pg.get('pagado', False),
                    'monto': float(pg.get('monto', 0)),
                    'fechaPago': pg.get('fechaPago', ''),
                    'metodoPago': pg.get('metodoPago', '')
                }
                for pg in pagos
            ],
            'fechaGeneracion': datetime.utcnow().isoformat()
        }
        
        if formato == 'json':
            return response(200, {
                'success': True,
                'data': reporte
            })
        
        elif formato in ['pdf', 'excel']:
            # Para PDF y Excel, retornar los datos y el frontend puede procesarlos
            # O implementar generación de PDF/Excel con bibliotecas Python
            return response(200, {
                'success': True,
                'message': f'Generación de {formato} no implementada aún',
                'data': reporte,
                'note': 'Usa formato=json para obtener los datos y procesarlos en el frontend'
            })
        
        else:
            return response(400, {
                'success': False,
                'error': {
                    'code': 'INVALID_FORMAT',
                    'message': 'Formato no soportado. Usa: json, pdf, excel'
                }
            })
        
    except Exception as e:
        print(f"Error en generar reporte: {str(e)}")
        import traceback
        traceback.print_exc()
        return response(500, {
            'success': False,
            'error': {'code': 'INTERNAL_SERVER_ERROR', 'message': 'Error al generar reporte'}
        })


def lambda_handler(event, context):
    print(f"event: {event}")    
    routeKey = event.get('routeKey')
    
    try:
        status_code = 200
        if routeKey == 'GET /tandas/{tandaId}/estadisticas':
            print('Obtener estadistica')
            return obtener_estadisticas(event,context)
        
        elif routeKey == 'GET /tandas/{tandaId}/reporte':
            print('Obtener reporte')
            return generar_reporte(event,context)
            
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