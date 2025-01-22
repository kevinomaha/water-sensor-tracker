import os
import json
import pytest
from unittest.mock import MagicMock, patch
import boto3
from moto import mock_dynamodb, mock_s3

# Import the Lambda handler
import sys
sys.path.append('lambda')
from sensor_processor import handler

# Test event templates
POST_EVENT = {
    'httpMethod': 'POST',
    'body': json.dumps({
        'sensorId': 'test-sensor-1',
        'temperature': 25.5,
        'humidity': 60,
        'waterLevel': 10.2
    })
}

GET_EVENT = {
    'httpMethod': 'GET',
    'pathParameters': {
        'sensorId': 'test-sensor-1'
    }
}

@pytest.fixture
def aws_credentials():
    """Mocked AWS Credentials for moto."""
    os.environ['AWS_ACCESS_KEY_ID'] = 'testing'
    os.environ['AWS_SECRET_ACCESS_KEY'] = 'testing'
    os.environ['AWS_SECURITY_TOKEN'] = 'testing'
    os.environ['AWS_SESSION_TOKEN'] = 'testing'
    os.environ['AWS_DEFAULT_REGION'] = 'us-east-1'

@pytest.fixture
def dynamodb_table(aws_credentials):
    """Create a mock DynamoDB table."""
    with mock_dynamodb():
        dynamodb = boto3.resource('dynamodb')
        table = dynamodb.create_table(
            TableName='test-table',
            KeySchema=[
                {'AttributeName': 'sensorId', 'KeyType': 'HASH'},
                {'AttributeName': 'timestamp', 'KeyType': 'RANGE'}
            ],
            AttributeDefinitions=[
                {'AttributeName': 'sensorId', 'AttributeType': 'S'},
                {'AttributeName': 'timestamp', 'AttributeType': 'S'}
            ],
            BillingMode='PAY_PER_REQUEST'
        )
        os.environ['TABLE_NAME'] = 'test-table'
        yield table

@pytest.fixture
def s3_bucket(aws_credentials):
    """Create a mock S3 bucket."""
    with mock_s3():
        s3 = boto3.client('s3')
        bucket_name = 'test-bucket'
        s3.create_bucket(Bucket=bucket_name)
        os.environ['BUCKET_NAME'] = bucket_name
        yield bucket_name

def test_post_sensor_data(dynamodb_table, s3_bucket):
    """Test POST request to store sensor data."""
    # Set environment
    os.environ['ENVIRONMENT'] = 'test'
    
    # Call the handler
    response = handler(POST_EVENT, {})
    
    # Verify response
    assert response['statusCode'] == 200
    assert 'Data processed successfully' in response['body']
    
    # Verify DynamoDB entry
    items = list(dynamodb_table.scan()['Items'])
    assert len(items) == 1
    assert items[0]['sensorId'] == 'test-sensor-1'
    assert float(items[0]['temperature']) == 25.5

def test_get_sensor_data(dynamodb_table):
    """Test GET request to retrieve sensor data."""
    # Set environment
    os.environ['ENVIRONMENT'] = 'test'
    
    # Add test data
    dynamodb_table.put_item(Item={
        'sensorId': 'test-sensor-1',
        'timestamp': '2025-01-01T00:00:00',
        'temperature': '25.5',
        'humidity': '60',
        'waterLevel': '10.2'
    })
    
    # Call the handler
    response = handler(GET_EVENT, {})
    
    # Verify response
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert len(body) == 1
    assert body[0]['sensorId'] == 'test-sensor-1'

def test_invalid_request():
    """Test invalid HTTP method."""
    event = {'httpMethod': 'PUT'}
    response = handler(event, {})
    assert response['statusCode'] == 400
    assert 'Unsupported HTTP method' in response['body']

def test_missing_required_fields(dynamodb_table, s3_bucket):
    """Test POST request with missing fields."""
    event = {
        'httpMethod': 'POST',
        'body': json.dumps({
            'sensorId': 'test-sensor-1'
            # Missing required fields
        })
    }
    response = handler(event, {})
    assert response['statusCode'] == 400
    assert 'Missing required fields' in response['body']
