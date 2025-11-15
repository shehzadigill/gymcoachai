import json
import sys
import os
from flask import Flask, request, jsonify
from lambda_function import lambda_handler

app = Flask(__name__)

@app.route('/2015-03-31/functions/function/invocations', methods=['POST'])
def invoke():
    try:
        event = request.get_json()
        context = type('obj', (object,), {
            'function_name': 'ai-service-python',
            'function_version': '1',
            'invoked_function_arn': 'arn:aws:lambda:local',
            'memory_limit_in_mb': 512,
            'aws_request_id': 'local-request-id',
            'log_group_name': '/aws/lambda/ai-service-python',
            'log_stream_name': 'local',
        })()
        
        result = lambda_handler(event, context)
        return jsonify(result)
    except Exception as e:
        import traceback
        return jsonify({
            'statusCode': 500,
            'body': json.dumps({'error': str(e), 'trace': traceback.format_exc()})
        }), 500

@app.route('/health', methods=['GET'])
def health():
    return jsonify({'status': 'OK', 'service': 'ai-service-python'})

if __name__ == '__main__':
    app.run(host='0.0.0.0', port=9001, debug=False)
