# Customer Request/Response Debugging Tools

## GitHub-Style Webhook Diagnostics for APIs

### 1. AWS X-Ray Integration for Request Debugging

```python
from aws_xray_sdk.core import xray_recorder
from aws_xray_sdk.core import patch_all
import json
import uuid
from datetime import datetime, timedelta

# Patch AWS SDK calls for automatic tracing
patch_all()

class CustomerRequestTracer:
    """GitHub-style request debugging using AWS X-Ray"""
    
    def __init__(self):
        self.dynamodb = boto3.resource('dynamodb')
        self.debug_table = self.dynamodb.Table('customer-debug-requests')
    
    async def start_debug_session(
        self, 
        customer_id: str, 
        debug_duration_minutes: int = 60
    ) -> str:
        """Start a debugging session for customer - like GitHub webhook debugging"""
        
        debug_session_id = str(uuid.uuid4())
        expiry_time = datetime.utcnow() + timedelta(minutes=debug_duration_minutes)
        
        # Store debug session
        await self._store_debug_session(
            debug_session_id,
            customer_id,
            expiry_time
        )
        
        return debug_session_id
    
    async def capture_request_for_debugging(
        self,
        request: Request,
        response: Response,
        customer_id: str,
        processing_time: float
    ) -> Optional[str]:
        """Capture request/response if customer has active debug session"""
        
        # Check if customer has active debug session
        debug_session = await self._get_active_debug_session(customer_id)
        if not debug_session:
            return None
        
        # Create X-Ray trace for this request
        trace_id = xray_recorder.get_trace_id()
        
        # Capture detailed request/response data
        debug_data = await self._capture_debug_data(
            request, 
            response, 
            customer_id, 
            processing_time,
            trace_id
        )
        
        # Store for customer access
        await self._store_debug_request(debug_session['id'], debug_data)
        
        return trace_id
    
    async def _capture_debug_data(
        self,
        request: Request,
        response: Response,
        customer_id: str,
        processing_time: float,
        trace_id: str
    ) -> Dict:
        """Capture comprehensive request/response data for debugging"""
        
        # Safely capture request body
        request_body = await self._safe_get_request_body(request)
        response_body = await self._safe_get_response_body(response)
        
        return {
            'trace_id': trace_id,
            'timestamp': datetime.utcnow().isoformat(),
            'customer_id': customer_id,
            'request': {
                'method': request.method,
                'url': str(request.url),
                'headers': self._sanitize_headers(dict(request.headers)),
                'query_params': dict(request.query_params),
                'body': request_body,
                'content_type': request.headers.get('content-type', 'unknown')
            },
            'response': {
                'status_code': response.status_code,
                'headers': dict(response.headers),
                'body': response_body,
                'content_type': response.headers.get('content-type', 'unknown')
            },
            'performance': {
                'processing_time_ms': round(processing_time * 1000, 2),
                'timestamp': datetime.utcnow().isoformat()
            }
        }
    
    def _sanitize_headers(self, headers: Dict) -> Dict:
        """Remove sensitive headers from debug data"""
        sensitive_headers = ['authorization', 'x-api-key', 'cookie', 'x-forwarded-for']
        sanitized = {}
        
        for key, value in headers.items():
            if key.lower() in sensitive_headers:
                if key.lower() == 'authorization':
                    # Show auth type but not the token
                    sanitized[key] = f"{value.split(' ')[0]} [REDACTED]" if ' ' in value else "[REDACTED]"
                else:
                    sanitized[key] = "[REDACTED]"
            else:
                sanitized[key] = value
                
        return sanitized
    
    async def _safe_get_request_body(self, request: Request) -> Optional[Dict]:
        """Safely capture request body without breaking the request"""
        try:
            content_type = request.headers.get('content-type', '')
            
            if 'application/json' in content_type:
                body = await request.json()
                return self._sanitize_request_body(body)
            elif 'application/x-www-form-urlencoded' in content_type:
                form_data = await request.form()
                return dict(form_data)
            else:
                # For other content types, just capture size
                return {'content_type': content_type, 'size_bytes': 'unknown'}
                
        except Exception:
            return {'error': 'Could not parse request body'}
    
    def _sanitize_request_body(self, body: Dict) -> Dict:
        """Remove sensitive data from request body"""
        sensitive_fields = ['password', 'token', 'api_key', 'secret', 'ssn', 'social_security']
        
        if isinstance(body, dict):
            sanitized = {}
            for key, value in body.items():
                if any(sensitive in key.lower() for sensitive in sensitive_fields):
                    sanitized[key] = "[REDACTED]"
                elif isinstance(value, dict):
                    sanitized[key] = self._sanitize_request_body(value)
                else:
                    sanitized[key] = value
            return sanitized
        
        return body
```

### 2. Customer Debug Dashboard

```python
from fastapi import APIRouter, Depends, HTTPException, Query
from typing import List, Optional

router = APIRouter(prefix="/debug", tags=["customer-debugging"])

@router.post("/sessions")
async def start_debug_session(
    duration_minutes: int = 60,
    customer: Customer = Depends(get_current_customer)
):
    """Start a new debugging session - like GitHub webhook debugging"""
    
    tracer = CustomerRequestTracer()
    session_id = await tracer.start_debug_session(
        customer.id, 
        duration_minutes
    )
    
    return {
        "debug_session_id": session_id,
        "duration_minutes": duration_minutes,
        "expires_at": (datetime.utcnow() + timedelta(minutes=duration_minutes)).isoformat(),
        "instructions": {
            "message": "Debug session started. Make API calls and they will be captured for analysis.",
            "note": "All request/response data will be available in your debug dashboard."
        }
    }

@router.get("/sessions/{session_id}/requests")
async def get_debug_requests(
    session_id: str,
    customer: Customer = Depends(get_current_customer),
    limit: int = Query(50, le=100)
):
    """Get captured requests for a debug session"""
    
    tracer = CustomerRequestTracer()
    
    # Verify session belongs to customer
    session = await tracer.get_debug_session(session_id)
    if not session or session['customer_id'] != customer.id:
        raise HTTPException(status_code=404, detail="Debug session not found")
    
    # Get captured requests
    requests = await tracer.get_debug_requests(session_id, limit)
    
    return {
        "session_id": session_id,
        "total_requests": len(requests),
        "requests": requests
    }

@router.get("/requests/{trace_id}")
async def get_request_details(
    trace_id: str,
    customer: Customer = Depends(get_current_customer)
):
    """Get detailed request information including X-Ray trace"""
    
    tracer = CustomerRequestTracer()
    
    # Get request details
    request_data = await tracer.get_request_by_trace_id(trace_id, customer.id)
    if not request_data:
        raise HTTPException(status_code=404, detail="Request not found")
    
    # Get X-Ray trace details
    xray_data = await tracer.get_xray_trace_details(trace_id)
    
    return {
        "request_data": request_data,
        "trace_data": xray_data,
        "debugging_tips": await generate_debugging_tips(request_data)
    }

@router.post("/requests/{trace_id}/replay")
async def replay_request(
    trace_id: str,
    customer: Customer = Depends(get_current_customer)
):
    """Generate a cURL command to replay the request"""
    
    tracer = CustomerRequestTracer()
    request_data = await tracer.get_request_by_trace_id(trace_id, customer.id)
    
    if not request_data:
        raise HTTPException(status_code=404, detail="Request not found")
    
    curl_command = generate_curl_command(request_data)
    
    return {
        "trace_id": trace_id,
        "curl_command": curl_command,
        "instructions": "Copy this command to replay your request exactly as it was sent"
    }
```

### 3. X-Ray Trace Enhancement

```python
class EnhancedXRayTracing:
    """Enhanced X-Ray tracing with customer context"""
    
    @staticmethod
    async def trace_license_verification(
        license_number: str, 
        state: str, 
        customer_id: str
    ):
        """Trace license verification with business context"""
        
        subsegment = xray_recorder.begin_subsegment('license_verification')
        
        try:
            # Add business context to trace
            subsegment.put_metadata('business_context', {
                'license_number': license_number[:4] + '****',  # Partial for privacy
                'state': state,
                'customer_id': customer_id,
                'operation_type': 'license_verification'
            })
            
            # Trace external API calls
            with xray_recorder.in_subsegment('state_api_call'):
                result = await call_state_api(license_number, state)
                
                # Add result context
                xray_recorder.current_subsegment().put_metadata('api_result', {
                    'success': result.success,
                    'confidence': result.confidence,
                    'data_source': result.source
                })
            
            # Trace Claude processing if needed
            if result.needs_claude_processing:
                with xray_recorder.in_subsegment('claude_processing'):
                    enhanced_result = await process_with_claude(result.raw_data)
                    
                    xray_recorder.current_subsegment().put_metadata('claude_result', {
                        'tokens_used': enhanced_result.tokens,
                        'confidence_improvement': enhanced_result.confidence - result.confidence
                    })
            
            return result
            
        except Exception as e:
            # Add error context to trace
            subsegment.add_exception(e)
            subsegment.put_metadata('error_context', {
                'error_type': type(e).__name__,
                'recoverable': isinstance(e, RecoverableError)
            })
            raise
            
        finally:
            xray_recorder.end_subsegment()
```

### 4. Debugging Middleware Integration

```python
class CustomerDebugMiddleware(BaseHTTPMiddleware):
    """Middleware to capture requests for customer debugging"""
    
    def __init__(self, app):
        super().__init__(app)
        self.tracer = CustomerRequestTracer()
    
    async def dispatch(self, request: Request, call_next):
        # Extract customer info
        customer_id = await extract_customer_id(request)
        
        if not customer_id:
            return await call_next(request)
        
        # Start X-Ray tracing with customer context
        trace_header = request.headers.get('x-amzn-trace-id')
        segment = xray_recorder.begin_segment('api_request', trace_header)
        
        try:
            # Add customer context to trace
            segment.put_metadata('customer', {
                'customer_id': customer_id,
                'endpoint': request.url.path,
                'method': request.method
            })
            
            start_time = time.time()
            
            # Process request
            response = await call_next(request)
            
            processing_time = time.time() - start_time
            
            # Capture for debugging if session active (async, non-blocking)
            asyncio.create_task(
                self.tracer.capture_request_for_debugging(
                    request, response, customer_id, processing_time
                )
            )
            
            # Add performance metrics to trace
            segment.put_metadata('performance', {
                'processing_time_ms': round(processing_time * 1000, 2),
                'status_code': response.status_code
            })
            
            return response
            
        except Exception as e:
            segment.add_exception(e)
            raise
            
        finally:
            xray_recorder.end_segment()
```

### 5. Smart Debugging Tips Generation

```python
async def generate_debugging_tips(request_data: Dict) -> List[str]:
    """Generate helpful debugging tips based on request/response data"""
    
    tips = []
    
    # Check response status
    status_code = request_data['response']['status_code']
    
    if status_code == 400:
        tips.append("400 Bad Request: Check your request format and required parameters")
        
        # Analyze request body for common issues
        request_body = request_data['request'].get('body', {})
        if isinstance(request_body, dict):
            missing_fields = check_required_fields(request_body, request_data['request']['url'])
            if missing_fields:
                tips.append(f"Missing required fields: {', '.join(missing_fields)}")
    
    elif status_code == 401:
        tips.append("401 Unauthorized: Check your API key or authentication token")
        auth_header = request_data['request']['headers'].get('authorization', '')
        if not auth_header or auth_header == '[REDACTED]':
            tips.append("No authorization header found - make sure to include your API key")
    
    elif status_code == 429:
        tips.append("429 Rate Limited: You're making requests too quickly")
        tips.append("Consider implementing exponential backoff in your client")
        tips.append("Check your current plan limits in the dashboard")
    
    elif status_code >= 500:
        tips.append("500+ Server Error: This is likely a temporary issue on our end")
        tips.append("Try the request again in a few minutes")
        tips.append("If the issue persists, contact support with this trace ID")
    
    # Check performance
    processing_time = request_data['performance']['processing_time_ms']
    if processing_time > 5000:  # 5 seconds
        tips.append("Slow response detected - this endpoint typically responds faster")
        tips.append("Check if you're requesting a large amount of data")
    
    # Check request format
    content_type = request_data['request'].get('content_type', '')
    if 'json' in content_type.lower():
        try:
            body = request_data['request']['body']
            if isinstance(body, str):
                tips.append("Request body appears to be a string - make sure you're sending valid JSON")
        except:
            pass
    
    return tips

def generate_curl_command(request_data: Dict) -> str:
    """Generate cURL command to replay the request"""
    
    method = request_data['request']['method']
    url = request_data['request']['url']
    headers = request_data['request']['headers']
    body = request_data['request'].get('body')
    
    curl_parts = [f"curl -X {method}"]
    
    # Add headers (excluding sensitive ones)
    for key, value in headers.items():
        if '[REDACTED]' not in value:
            curl_parts.append(f'-H "{key}: {value}"')
        else:
            curl_parts.append(f'-H "{key}: YOUR_API_KEY_HERE"')
    
    # Add body if present
    if body and method in ['POST', 'PUT', 'PATCH']:
        if isinstance(body, dict):
            curl_parts.append(f"-d '{json.dumps(body, indent=2)}'")
        else:
            curl_parts.append(f"-d '{body}'")
    
    curl_parts.append(f'"{url}"')
    
    return " \\\n  ".join(curl_parts)
```

### 6. Customer-Facing Debug Dashboard (React Component)

```typescript
// Customer debug dashboard component
interface DebugRequest {
  trace_id: string;
  timestamp: string;
  method: string;
  url: string;
  status_code: number;
  processing_time_ms: number;
}

const CustomerDebugDashboard: React.FC = () => {
  const [debugSession, setDebugSession] = useState<string | null>(null);
  const [requests, setRequests] = useState<DebugRequest[]>([]);
  const [selectedRequest, setSelectedRequest] = useState<string | null>(null);

  const startDebugSession = async () => {
    const response = await fetch('/api/debug/sessions', {
      method: 'POST',
      headers: { 'Authorization': `Bearer ${apiKey}` }
    });
    const data = await response.json();
    setDebugSession(data.debug_session_id);
  };

  const loadRequests = async () => {
    if (!debugSession) return;
    
    const response = await fetch(`/api/debug/sessions/${debugSession}/requests`);
    const data = await response.json();
    setRequests(data.requests);
  };

  return (
    <div className="debug-dashboard">
      <h2>API Request Debugging</h2>
      
      {!debugSession ? (
        <div>
          <p>Start a debug session to capture your API requests for analysis.</p>
          <button onClick={startDebugSession}>Start Debug Session</button>
        </div>
      ) : (
        <div>
          <p>Debug session active. Make API calls and they'll appear below.</p>
          <button onClick={loadRequests}>Refresh Requests</button>
          
          <div className="requests-list">
            {requests.map(req => (
              <div 
                key={req.trace_id} 
                className={`request-item ${req.status_code >= 400 ? 'error' : 'success'}`}
                onClick={() => setSelectedRequest(req.trace_id)}
              >
                <span className="method">{req.method}</span>
                <span className="url">{req.url}</span>
                <span className="status">{req.status_code}</span>
                <span className="time">{req.processing_time_ms}ms</span>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
};
```

This creates a GitHub-style debugging experience where customers can:
1. **Start debug sessions** to capture their requests
2. **View detailed request/response data** with sensitive info redacted
3. **Get automated debugging tips** based on common issues
4. **Generate cURL commands** to replay requests
5. **Access X-Ray traces** for deep performance analysis

The system automatically captures debugging data when customers have active sessions, giving them the self-service debugging capability that reduces support tickets.