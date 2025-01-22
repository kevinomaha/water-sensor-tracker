import json
import os
import boto3
from datetime import datetime, timezone
from boto3.dynamodb.conditions import Key
from decimal import Decimal

dynamodb = boto3.resource('dynamodb')
table = dynamodb.Table(os.environ['TABLE_NAME'])

# Custom JSON encoder to handle Decimal
class DecimalEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, Decimal):
            return float(obj)  # Convert to float for better JavaScript compatibility
        return super(DecimalEncoder, self).default(obj)

def get_sensor_data(sensor_id, last_evaluated_key=None, limit=20):
    try:
        query_params = {
            'KeyConditionExpression': Key('sensorId').eq(sensor_id),
            'Limit': limit,
            'ScanIndexForward': False  # Sort in descending order (newest first)
        }
        
        if last_evaluated_key:
            try:
                query_params['ExclusiveStartKey'] = json.loads(last_evaluated_key)
            except json.JSONDecodeError:
                print(f"Error decoding last_evaluated_key: {last_evaluated_key}")
                return {'error': 'Invalid last_evaluated_key format'}
        
        print(f"Querying DynamoDB with params: {query_params}")
        response = table.query(**query_params)
        print(f"DynamoDB response: {response}")
        
        return {
            'items': response.get('Items', []),
            'lastEvaluatedKey': json.dumps(response.get('LastEvaluatedKey')) if 'LastEvaluatedKey' in response else None
        }
    except Exception as e:
        print(f"Error querying DynamoDB: {str(e)}")
        return {'error': f'Failed to fetch sensor data: {str(e)}'}

def get_html_template():
    return '''
    <!DOCTYPE html>
    <html>
    <head>
        <title>Water Sensor Data</title>
        <style>
            body {
                font-family: Arial, sans-serif;
                max-width: 1200px;
                margin: 0 auto;
                padding: 20px;
                background-color: #f5f5f5;
            }
            .container {
                background-color: white;
                padding: 20px;
                border-radius: 8px;
                box-shadow: 0 2px 4px rgba(0,0,0,0.1);
            }
            table {
                width: 100%;
                border-collapse: collapse;
                margin: 20px 0;
            }
            th, td {
                padding: 12px;
                text-align: left;
                border-bottom: 1px solid #ddd;
            }
            th {
                background-color: #f8f9fa;
            }
            .pagination {
                display: flex;
                justify-content: center;
                gap: 10px;
                margin-top: 20px;
            }
            button {
                padding: 8px 16px;
                background-color: #007bff;
                color: white;
                border: none;
                border-radius: 4px;
                cursor: pointer;
            }
            button:disabled {
                background-color: #ccc;
                cursor: not-allowed;
            }
            button:hover:not(:disabled) {
                background-color: #0056b3;
            }
            .sensor-select {
                margin-bottom: 20px;
            }
            select {
                padding: 8px;
                border-radius: 4px;
                border: 1px solid #ddd;
            }
            .error {
                color: #dc3545;
                padding: 10px;
                margin: 10px 0;
                border: 1px solid #dc3545;
                border-radius: 4px;
                display: none;
            }
        </style>
    </head>
    <body>
        <div class="container">
            <h1>Water Sensor Data</h1>
            <div class="sensor-select">
                <label for="sensorId">Select Sensor: </label>
                <select id="sensorId" onchange="loadData()">
                    <option value="sensor1">Sensor 1</option>
                    <option value="sensor2">Sensor 2</option>
                </select>
            </div>
            <div id="errorMessage" class="error"></div>
            <table>
                <thead>
                    <tr>
                        <th>Timestamp</th>
                        <th>Temperature (°C)</th>
                        <th>Humidity (%)</th>
                        <th>Water Level</th>
                    </tr>
                </thead>
                <tbody id="dataTable">
                </tbody>
            </table>
            <div class="pagination">
                <button onclick="previousPage()" id="prevButton" disabled>Previous</button>
                <button onclick="nextPage()" id="nextButton">Next</button>
            </div>
        </div>
        <script>
            let lastEvaluatedKey = null;
            let previousKeys = [];
            
            async function loadData(useLastKey = null) {
                const sensorId = document.getElementById('sensorId').value;
                const errorDiv = document.getElementById('errorMessage');
                const queryParams = new URLSearchParams({
                    sensor_id: sensorId
                });
                
                if (useLastKey) {
                    queryParams.append('last_evaluated_key', useLastKey);
                }
                
                try {
                    console.log('Fetching data...');
                    const response = await fetch(`sensors/data?${queryParams.toString()}`);
                    if (!response.ok) {
                        const errorText = await response.text();
                        console.error('API Error:', errorText);
                        throw new Error(`Failed to fetch data: ${response.status} ${response.statusText}`);
                    }
                    
                    const data = await response.json();
                    console.log('Received data:', data);
                    
                    if (data.error) {
                        throw new Error(data.error);
                    }
                    
                    const tbody = document.getElementById('dataTable');
                    tbody.innerHTML = '';
                    
                    data.items.forEach(item => {
                        const row = tbody.insertRow();
                        const timestamp = new Date(item.timestamp).toLocaleString();
                        row.insertCell(0).textContent = timestamp;
                        row.insertCell(1).textContent = item.temperature;
                        row.insertCell(2).textContent = item.humidity;
                        row.insertCell(3).textContent = item.waterLevel;
                    });
                    
                    lastEvaluatedKey = data.lastEvaluatedKey;
                    document.getElementById('nextButton').disabled = !lastEvaluatedKey;
                    document.getElementById('prevButton').disabled = previousKeys.length === 0;
                    errorDiv.style.display = 'none';
                } catch (error) {
                    console.error('Error:', error);
                    errorDiv.textContent = error.message;
                    errorDiv.style.display = 'block';
                }
            }
            
            function nextPage() {
                if (lastEvaluatedKey) {
                    previousKeys.push(null);  // Store current page state
                    loadData(lastEvaluatedKey);
                }
            }
            
            function previousPage() {
                if (previousKeys.length > 0) {
                    const previousKey = previousKeys.pop();
                    loadData(previousKey);
                }
            }
            
            // Load initial data
            loadData();
        </script>
    </body>
    </html>
    '''

def handler(event, context):
    print(f"Received event: {json.dumps(event)}")
    path = event.get('path', '')
    query_params = event.get('queryStringParameters', {}) or {}
    
    cors_headers = {
        'Access-Control-Allow-Origin': '*',
        'Access-Control-Allow-Methods': 'GET, OPTIONS',
        'Access-Control-Allow-Headers': 'Content-Type,X-Amz-Date,Authorization,X-Api-Key,X-Amz-Security-Token'
    }
    
    # Handle OPTIONS request
    if event.get('httpMethod') == 'OPTIONS':
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': ''
        }
    
    if path == '/sensors/data':
        sensor_id = query_params.get('sensor_id')
        last_evaluated_key = query_params.get('last_evaluated_key')
        
        if not sensor_id:
            return {
                'statusCode': 400,
                'headers': cors_headers,
                'body': json.dumps({'error': 'sensor_id is required'})
            }
        
        result = get_sensor_data(sensor_id, last_evaluated_key)
        if 'error' in result:
            return {
                'statusCode': 500,
                'headers': cors_headers,
                'body': json.dumps(result)
            }
            
        return {
            'statusCode': 200,
            'headers': cors_headers,
            'body': json.dumps(result, cls=DecimalEncoder)
        }
    else:
        return {
            'statusCode': 200,
            'headers': {**cors_headers, 'Content-Type': 'text/html'},
            'body': get_html_template()
        }
