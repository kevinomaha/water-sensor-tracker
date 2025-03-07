import os
import json
import boto3
import time
from datetime import datetime
from decimal import Decimal

# Initialize AWS clients
dynamodb = boto3.resource('dynamodb')
s3 = boto3.client('s3')

# Get environment variables
table_name = os.environ['TABLE_NAME']
bucket_name = os.environ['BUCKET_NAME']

# Get DynamoDB table
table = dynamodb.Table(table_name)

# Custom JSON encoder to handle Decimal
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return str(obj)
        return super(DecimalEncoder, self).default(obj)

def handler(event, context):
    """
    Handle sensor data processing:
    - POST /sensors: Store new sensor reading
    - GET /sensors/{sensorId}: Retrieve sensor readings
    """
    
    http_method = event['httpMethod']
    
    try:
        if http_method == 'POST':
            return process_sensor_data(event)
        elif http_method == 'GET':
            return get_sensor_data(event)
        else:
            return {
                'statusCode': 400,
                'headers': {'Content-Type': 'application/json'},
                'body': json.dumps({'error': 'Unsupported HTTP method'})
            }
    except Exception as e:
        return {
            'statusCode': 500,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': str(e)})
        }

def process_sensor_data(event):
    """Process and store new sensor reading"""
    
    body = json.loads(event['body'], parse_float=Decimal)
    
    # Validate required fields
    required_fields = ['sensorId', 'temperature', 'humidity', 'waterLevel']
    if not all(field in body for field in required_fields):
        return {
            'statusCode': 400,
            'headers': {'Content-Type': 'application/json'},
            'body': json.dumps({'error': 'Missing required fields'})
        }
    
    # Add timestamp
    timestamp = datetime.utcnow().isoformat()
    
    # Store in DynamoDB
    item = {
        'sensorId': body['sensorId'],
        'timestamp': timestamp,
        'temperature': body['temperature'],
        'humidity': body['humidity'],
        'waterLevel': body['waterLevel'],
        'ttl': int(time.time()) + (90 * 24 * 60 * 60)  # 90 days TTL
    }
    
    table.put_item(Item=item)
    
    # Archive to S3
    s3.put_object(
        Bucket=bucket_name,
        Key=f"sensors/{body['sensorId']}/{timestamp}.json",
        Body=json.dumps(item, cls=DecimalEncoder)
    )
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'message': 'Data processed successfully'})
    }

def get_sensor_data(event):
    """Retrieve sensor readings for a specific sensor"""
    
    sensor_id = event['pathParameters']['sensorId']
    
    # Query DynamoDB
    response = table.query(
        KeyConditionExpression='sensorId = :sid',
        ExpressionAttributeValues={
            ':sid': sensor_id
        },
        ScanIndexForward=False,  # Sort in descending order (newest first)
        Limit=10
    )
    
    return {
        'statusCode': 200,
        'headers': {'Content-Type': 'application/json'},
        'body': json.dumps({'items': response.get('Items', [])}, cls=DecimalEncoder)
    }
