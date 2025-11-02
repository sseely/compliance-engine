# GitHub-Style Webhook Diagnostics for API Calls

## Webhook-Style Request Inspection System

### 1. Request Capture and Replay System

```python
from datetime import datetime, timedelta
import json
import uuid
from typing import Dict, List, Optional
import boto3
from aws_xray_sdk.core import xray_recorder

class WebhookStyleDiagnostics:
    """GitHub-style webhook diagnostics for API debugging"""
    
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb')
        self.requests_table = self.dynamodb.Table('api-request-captures')
        self.sessions_table = self.dynamodb.Table('debug-sessions')
        self.s3 = boto3.client('s3')
        self.bucket_name = 'compliance-debug-data'
    
    async def create_debug_session(
        self, 
        customer_id: str,
        session_name: str = None,
        capture_duration_hours: int = 24,
        max_requests: int = 100
    ) -> Dict:
        """Create a new debug session like GitHub webhook debugging"""
        
        session_id = str(uuid.uuid4())
        session_name = session_name or f"Debug Session {datetime.now().strftime('%Y-%m-%d %H:%M')}"
        
        session_data = {
            'session_id': session_id,
            'customer_id': customer_id,
            'session_name': session_name,
            'created_at': datetime.utcnow().isoformat(),
            'expires_at': (datetime.utcnow() + timedelta(hours=capture_duration_hours)).isoformat(),
            'max_requests': max_requests,
            'captured_requests': 0,
            'status': 'active'
        }
        
        # Store session
        self.sessions_table.put_item(Item=session_data)
        
        return {
            'session_id': session_id,
            'session_name': session_name,
            'capture_url_pattern': f'/api/**',  # Capture all API calls
            'expires_at': session_data['expires_at'],
            'max_requests': max_requests,
            'webhook_style_url': f'/debug/sessions/{session_id}/requests'
        }
    
    async def capture_api_request(
        self,
        request: Request,
        response: Response,
        customer_id: str,
        processing_time: float,
        internal_details: Dict = None
    ) -> Optional[str]:
        """Capture API request in webhook-style format"""
        
        # Check for active debug sessions
        active_sessions = await self._get_active_sessions(customer_id)
        if not active_sessions:
            return None
        
        # Create unique request ID
        request_id = str(uuid.uuid4())
        capture_timestamp = datetime.utcnow()
        
        # Capture comprehensive request data
        capture_data = await self._build_webhook_payload(
            request, response, customer_id, processing_time, internal_details
        )
        
        # Store request capture for each active session
        for session in active_sessions:
            await self._store_request_capture(
                session['session_id'],
                request_id,
                capture_data,
                capture_timestamp
            )
        
        return request_id
    
    async def _build_webhook_payload(
        self,
        request: Request,
        response: Response,
        customer_id: str,
        processing_time: float,
        internal_details: Dict = None
    ) -> Dict:
        """Build GitHub-style webhook payload"""
        
        # Get X-Ray trace ID for correlation
        trace_id = xray_recorder.get_trace_id()
        
        # Capture request details
        request_body = await self._safe_capture_body(request)
        response_body = await self._safe_capture_response(response)
        
        webhook_payload = {
            'id': str(uuid.uuid4()),
            'created_at': datetime.utcnow().isoformat(),
            'event': 'api_request',
            'delivery': {
                'id': str(uuid.uuid4()),
                'guid': trace_id,
                'delivered_at': datetime.utcnow().isoformat(),
                'duration': round(processing_time * 1000, 2),  # ms
                'status': 'delivered',
                'status_code': response.status_code
            },
            'request': {
                'method': request.method,
                'url': str(request.url),
                'headers': self._sanitize_headers(dict(request.headers)),
                'query_string': str(request.url.query) if request.url.query else None,
                'body': request_body,
                'content_type': request.headers.get('content-type'),
                'user_agent': request.headers.get('user-agent'),
                'remote_addr': request.client.host if request.client else None
            },
            'response': {
                'status_code': response.status_code,
                'headers': dict(response.headers),
                'body': response_body,
                'content_type': response.headers.get('content-type')
            },
            'customer': {
                'id': customer_id,
                'ip_address': request.client.host if request.client else None
            },
            'internal': internal_details or {}
        }
        
        # Add performance breakdown if available
        if internal_details:
            webhook_payload['performance'] = {
                'total_time_ms': round(processing_time * 1000, 2),
                'database_time_ms': internal_details.get('db_time', 0) * 1000,
                'external_api_time_ms': internal_details.get('external_api_time', 0) * 1000,
                'processing_time_ms': internal_details.get('processing_time', 0) * 1000
            }
        
        return webhook_payload
    
    async def get_session_requests(
        self,
        session_id: str,
        customer_id: str,
        limit: int = 50,
        status_filter: Optional[str] = None
    ) -> Dict:
        """Get requests for a debug session (GitHub webhook deliveries style)"""
        
        # Verify session ownership
        session = await self._get_session(session_id)
        if not session or session['customer_id'] != customer_id:
            raise ValueError("Session not found or access denied")
        
        # Query captured requests
        response = self.requests_table.query(
            IndexName='session-timestamp-index',
            KeyConditionExpression='session_id = :session_id',
            ExpressionAttributeValues={':session_id': session_id},
            ScanIndexForward=False,  # Most recent first
            Limit=limit
        )
        
        requests = response.get('Items', [])
        
        # Filter by status if specified
        if status_filter:
            requests = [r for r in requests if r.get('response', {}).get('status_code', 0) == int(status_filter)]
        
        # Format like GitHub webhook deliveries
        formatted_requests = []
        for req in requests:
            formatted_requests.append({
                'id': req['request_id'],
                'guid': req.get('trace_id'),
                'delivered_at': req['captured_at'],
                'duration': req.get('duration_ms', 0),
                'status': 'delivered',
                'status_code': req.get('response', {}).get('status_code'),
                'event': 'api_request',
                'action': req.get('request', {}).get('method'),
                'redelivery': False,
                'url': req.get('request', {}).get('url')
            })
        
        return {
            'session_id': session_id,
            'session_name': session['session_name'],
            'total_deliveries': len(formatted_requests),
            'deliveries': formatted_requests,
            'has_more': len(requests) == limit
        }
    
    async def get_request_details(
        self,
        session_id: str,
        request_id: str,
        customer_id: str
    ) -> Dict:
        """Get detailed request information (GitHub webhook delivery details style)"""
        
        # Verify session ownership
        session = await self._get_session(session_id)
        if not session or session['customer_id'] != customer_id:
            raise ValueError("Session not found or access denied")
        
        # Get request details
        response = self.requests_table.get_item(
            Key={
                'session_id': session_id,
                'request_id': request_id
            }
        )
        
        if 'Item' not in response:
            raise ValueError("Request not found")
        
        request_data = response['Item']
        
        # Format like GitHub webhook delivery details
        return {
            'delivery': {
                'id': request_id,
                'guid': request_data.get('trace_id'),
                'delivered_at': request_data['captured_at'],
                'duration': request_data.get('duration_ms', 0),
                'status': 'delivered',
                'status_code': request_data.get('response', {}).get('status_code'),
                'event': 'api_request',
                'action': request_data.get('request', {}).get('method'),
                'installation_id': customer_id,
                'repository_id': session_id
            },
            'request': request_data.get('request', {}),
            'response': request_data.get('response', {}),
            'performance': request_data.get('performance', {}),
            'internal': request_data.get('internal', {})
        }
    
    async def redeliver_request(
        self,
        session_id: str,
        request_id: str,
        customer_id: str
    ) -> Dict:
        """Generate curl command to redeliver/replay the request"""
        
        request_details = await self.get_request_details(session_id, request_id, customer_id)
        request_data = request_details['request']
        
        # Generate curl command
        curl_command = self._generate_curl_command(request_data)
        
        # Generate different language examples
        code_examples = {
            'curl': curl_command,
            'python': self._generate_python_code(request_data),
            'javascript': self._generate_javascript_code(request_data),
            'node': self._generate_node_code(request_data)
        }
        
        return {
            'request_id': request_id,
            'original_request': request_data,
            'redelivery_examples': code_examples,
            'notes': [
                "Replace YOUR_API_KEY with your actual API key",
                "Modify the request body as needed for testing",
                "Check the response carefully for any changes"
            ]
        }
    
    def _generate_curl_command(self, request_data: Dict) -> str:
        """Generate curl command like GitHub webhook redelivery"""
        
        method = request_data.get('method', 'GET')
        url = request_data.get('url', '')
        headers = request_data.get('headers', {})
        body = request_data.get('body')
        
        curl_parts = [f"curl -X {method}"]
        
        # Add headers
        for key, value in headers.items():
            if key.lower() not in ['host', 'content-length']:
                if '[REDACTED]' in str(value):
                    curl_parts.append(f'-H "{key}: YOUR_API_KEY"')
                else:
                    curl_parts.append(f'-H "{key}: {value}"')
        
        # Add body for POST/PUT/PATCH
        if body and method in ['POST', 'PUT', 'PATCH']:
            if isinstance(body, dict):
                curl_parts.append(f"-d '{json.dumps(body, indent=2)}'")
            else:
                curl_parts.append(f"-d '{body}'")
        
        # Add URL
        curl_parts.append(f'"{url}"')
        
        return " \\\n  ".join(curl_parts)
    
    def _generate_python_code(self, request_data: Dict) -> str:
        """Generate Python requests code"""
        
        method = request_data.get('method', 'GET').lower()
        url = request_data.get('url', '')
        headers = {k: v for k, v in request_data.get('headers', {}).items() 
                  if k.lower() not in ['host', 'content-length']}
        body = request_data.get('body')
        
        # Replace sensitive headers
        for key, value in headers.items():
            if '[REDACTED]' in str(value):
                headers[key] = 'YOUR_API_KEY'
        
        code = f"""import requests
import json

url = "{url}"
headers = {json.dumps(headers, indent=2)}
"""
        
        if body:
            code += f"""
data = {json.dumps(body, indent=2)}
response = requests.{method}(url, headers=headers, json=data)
"""
        else:
            code += f"""
response = requests.{method}(url, headers=headers)
"""
        
        code += """
print(f"Status: {response.status_code}")
print(f"Response: {response.json()}")
"""
        
        return code
    
    def _generate_javascript_code(self, request_data: Dict) -> str:
        """Generate JavaScript fetch code"""
        
        method = request_data.get('method', 'GET')
        url = request_data.get('url', '')
        headers = {k: v for k, v in request_data.get('headers', {}).items() 
                  if k.lower() not in ['host', 'content-length']}
        body = request_data.get('body')
        
        # Replace sensitive headers
        for key, value in headers.items():
            if '[REDACTED]' in str(value):
                headers[key] = 'YOUR_API_KEY'
        
        options = {
            'method': method,
            'headers': headers
        }
        
        if body:
            options['body'] = json.dumps(body) if isinstance(body, dict) else body
        
        return f"""fetch('{url}', {json.dumps(options, indent=2)})
  .then(response => response.json())
  .then(data => console.log(data))
  .catch(error => console.error('Error:', error));
"""
```

### 2. Debug Session Management API

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

router = APIRouter(prefix="/debug/sessions", tags=["webhook-diagnostics"])

@router.post("")
async def create_debug_session(
    session_name: Optional[str] = None,
    capture_duration_hours: int = 24,
    max_requests: int = 100,
    customer: Customer = Depends(get_current_customer)
):
    """Create a new debug session like GitHub webhook debugging"""
    
    diagnostics = WebhookStyleDiagnostics()
    session = await diagnostics.create_debug_session(
        customer.id,
        session_name,
        capture_duration_hours,
        max_requests
    )
    
    return {
        **session,
        "instructions": {
            "message": "Debug session created. All your API requests will be captured.",
            "note": "Make API calls normally and view them in this debug session.",
            "expires_in_hours": capture_duration_hours
        }
    }

@router.get("")
async def list_debug_sessions(
    customer: Customer = Depends(get_current_customer),
    limit: int = Query(10, le=50)
):
    """List customer's debug sessions"""
    
    diagnostics = WebhookStyleDiagnostics()
    sessions = await diagnostics.get_customer_sessions(customer.id, limit)
    
    return {
        "sessions": sessions,
        "total": len(sessions)
    }

@router.get("/{session_id}/requests")
async def get_session_requests(
    session_id: str,
    customer: Customer = Depends(get_current_customer),
    limit: int = Query(50, le=100),
    status: Optional[str] = Query(None, regex="^[0-9]{3}$")
):
    """Get webhook-style request deliveries for a session"""
    
    diagnostics = WebhookStyleDiagnostics()
    
    try:
        requests = await diagnostics.get_session_requests(
            session_id, customer.id, limit, status
        )
        return requests
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.get("/{session_id}/requests/{request_id}")
async def get_request_details(
    session_id: str,
    request_id: str,
    customer: Customer = Depends(get_current_customer)
):
    """Get detailed webhook-style request information"""
    
    diagnostics = WebhookStyleDiagnostics()
    
    try:
        details = await diagnostics.get_request_details(
            session_id, request_id, customer.id
        )
        return details
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.post("/{session_id}/requests/{request_id}/redeliver")
async def redeliver_request(
    session_id: str,
    request_id: str,
    customer: Customer = Depends(get_current_customer)
):
    """Generate code to redeliver/replay the request"""
    
    diagnostics = WebhookStyleDiagnostics()
    
    try:
        redelivery_info = await diagnostics.redeliver_request(
            session_id, request_id, customer.id
        )
        return redelivery_info
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))

@router.delete("/{session_id}")
async def delete_debug_session(
    session_id: str,
    customer: Customer = Depends(get_current_customer)
):
    """Delete a debug session and all captured requests"""
    
    diagnostics = WebhookStyleDiagnostics()
    
    try:
        await diagnostics.delete_session(session_id, customer.id)
        return {"message": "Debug session deleted successfully"}
        
    except ValueError as e:
        raise HTTPException(status_code=404, detail=str(e))
```

### 3. Customer Dashboard Integration

```typescript
// Webhook-style diagnostics dashboard component
interface DebugSession {
  session_id: string;
  session_name: string;
  created_at: string;
  expires_at: string;
  captured_requests: number;
  status: 'active' | 'expired';
}

interface WebhookDelivery {
  id: string;
  delivered_at: string;
  duration: number;
  status_code: number;
  method: string;
  url: string;
}

const WebhookDiagnostics: React.FC = () => {
  const [sessions, setSessions] = useState<DebugSession[]>([]);
  const [selectedSession, setSelectedSession] = useState<string | null>(null);
  const [deliveries, setDeliveries] = useState<WebhookDelivery[]>([]);
  const [selectedDelivery, setSelectedDelivery] = useState<string | null>(null);

  const createSession = async (sessionName: string) => {
    const response = await fetch('/api/debug/sessions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({ session_name: sessionName })
    });
    
    const newSession = await response.json();
    setSessions([newSession, ...sessions]);
    setSelectedSession(newSession.session_id);
  };

  const loadDeliveries = async (sessionId: string) => {
    const response = await fetch(`/api/debug/sessions/${sessionId}/requests`);
    const data = await response.json();
    setDeliveries(data.deliveries);
  };

  const viewDeliveryDetails = async (sessionId: string, deliveryId: string) => {
    const response = await fetch(`/api/debug/sessions/${sessionId}/requests/${deliveryId}`);
    const details = await response.json();
    setSelectedDelivery(details);
  };

  const generateRedeliveryCode = async (sessionId: string, deliveryId: string) => {
    const response = await fetch(
      `/api/debug/sessions/${sessionId}/requests/${deliveryId}/redeliver`,
      { method: 'POST' }
    );
    const redeliveryInfo = await response.json();
    return redeliveryInfo.redelivery_examples;
  };

  return (
    <div className="webhook-diagnostics">
      <div className="session-selector">
        <h2>API Request Debugging</h2>
        <button onClick={() => createSession('New Debug Session')}>
          Create Debug Session
        </button>
        
        <div className="sessions-list">
          {sessions.map(session => (
            <div 
              key={session.session_id}
              className={`session-item ${session.status}`}
              onClick={() => {
                setSelectedSession(session.session_id);
                loadDeliveries(session.session_id);
              }}
            >
              <h3>{session.session_name}</h3>
              <p>{session.captured_requests} requests captured</p>
              <p>Expires: {new Date(session.expires_at).toLocaleDateString()}</p>
            </div>
          ))}
        </div>
      </div>

      {selectedSession && (
        <div className="deliveries-panel">
          <h3>Request Deliveries</h3>
          <div className="deliveries-list">
            {deliveries.map(delivery => (
              <div 
                key={delivery.id}
                className={`delivery-item status-${Math.floor(delivery.status_code / 100)}xx`}
                onClick={() => viewDeliveryDetails(selectedSession, delivery.id)}
              >
                <div className="delivery-method">{delivery.method}</div>
                <div className="delivery-url">{delivery.url}</div>
                <div className="delivery-status">{delivery.status_code}</div>
                <div className="delivery-time">{delivery.duration}ms</div>
                <div className="delivery-timestamp">
                  {new Date(delivery.delivered_at).toLocaleString()}
                </div>
              </div>
            ))}
          </div>
        </div>
      )}

      {selectedDelivery && (
        <DeliveryDetailsModal 
          delivery={selectedDelivery}
          onClose={() => setSelectedDelivery(null)}
          onRedeliver={(sessionId, deliveryId) => 
            generateRedeliveryCode(sessionId, deliveryId)
          }
        />
      )}
    </div>
  );
};
```

This creates a complete GitHub-style webhook diagnostics system that allows customers to:

1. **Create debug sessions** to capture their API requests
2. **View request "deliveries"** in a familiar webhook interface
3. **Inspect detailed request/response data** with performance metrics
4. **Generate redelivery code** in multiple languages (curl, Python, JavaScript)
5. **Filter and search** through captured requests
6. **Self-debug integration issues** without contacting support

The system integrates with AWS X-Ray for distributed tracing and provides the same level of debugging insight that GitHub's webhook system offers for developers.