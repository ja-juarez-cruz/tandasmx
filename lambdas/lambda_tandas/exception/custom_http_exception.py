import abc
import logging
import json

_logger = logging.getLogger()
_logger.setLevel(logging.INFO)


class CustomError(Exception):
    def __init__(self, message: str, codigo_error: str, status_code: int = 400):
        super().__init__(message)
        self.message = message
        self.codigo_error = codigo_error
        self.status_code = status_code
    
    def __str__(self):
        return f"[{self.codigo_error}] {self.message}"

class Client(metaclass=abc.ABCMeta):
    @abc.abstractmethod
    def standar_errors_formatting(self, ex: Exception, event) -> dict:
        pass

class CustomClientError(Client):
    def standar_errors_formatting(self, ex: Exception, event) -> dict: 
        header = event["headers"]
        reference_id = header.get('requestid', "")
        
        if isinstance(ex, CustomError):
            # Usar todos los valores del CustomError incluyendo status_code
            status_code = ex.status_code
            message = ex.message
            codeError = ex.codigo_error

            fault_response = {  
                "codeError": codeError,
                "message": message,
            }
        else:    
            exception_str = str(ex)
            status_code = 500
            message = exception_str
            codeError = "500"

            fault_response = {  
                "codeError": codeError,
                "message": message,
            }

        error_body = json.dumps(fault_response)
        headers = {
                'Access-Control-Allow-Origin': '*',
                'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token',
                'Access-Control-Allow-Methods': 'OPTIONS,POST,GET,PUT',
                'Content-Type': 'application/json'
            }
        response = {
            'statusCode': status_code,
            'headers': headers,
            'body': error_body
        }
        return response