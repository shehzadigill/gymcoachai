import json

def lambda_handler(event, context):
    try:
        import jwt
        return {
            'statusCode': 200,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'message': 'JWT import successful!',
                'version': jwt.__version__
            })
        }
    except ImportError as e:
        return {
            'statusCode': 500,
            'headers': {
                'Content-Type': 'application/json',
                'Access-Control-Allow-Origin': '*'
            },
            'body': json.dumps({
                'error': 'Import failed',
                'message': str(e)
            })
        }
