# AWS Lambda Local Development Guide

## AWS vs Azure Functions Comparison

**Azure Functions Core Tools**: Microsoft provides excellent local development experience with `func start`, hot reload, and local debugging.

**AWS Lambda**: No official equivalent, but several good options:

1. **AWS SAM CLI** - Most complete, AWS-supported
2. **LocalStack** - Great for integrated AWS services  
3. **Lambda Runtime Interface Emulator** - Lightweight, runtime-focused
4. **Serverless Framework** - Third-party with good local support

## Recommended Approach: LocalStack + SAM

### Why This Combination?
- **LocalStack**: Provides full AWS ecosystem (S3, SQS, CloudWatch Events)
- **SAM**: AWS-supported local Lambda runtime with debugging
- **Both**: Work together seamlessly with Docker Compose

## Lambda Function Architecture

### Project Structure
```
lambda-functions/
├── document_extractor/
│   ├── __init__.py
│   ├── handler.py              # Lambda entry point
│   ├── extractor_service.py    # Business logic (testable)
│   ├── models.py               # Data models
│   └── tests/
│       ├── test_handler.py     # Integration tests
│       └── test_service.py     # Unit tests
├── data_scraper/
│   ├── __init__.py
│   ├── handler.py
│   ├── scraper_service.py
│   └── tests/
├── shared/
│   ├── __init__.py
│   ├── aws_utils.py           # AWS SDK helpers
│   ├── claude_client.py       # Claude API client
│   └── exceptions.py          # Custom exceptions
└── events/                    # Test event payloads
    ├── s3-document-upload.json
    ├── sqs-extraction-job.json
    └── cloudwatch-schedule.json
```

### Example Lambda Handler (Testable)

```python
# lambda-functions/document_extractor/handler.py
import json
import logging
from typing import Dict, Any

from .extractor_service import DocumentExtractorService
from ..shared.aws_utils import get_s3_client, get_parameter
from ..shared.exceptions import ExtractionError

logger = logging.getLogger(__name__)

def main(event: Dict[str, Any], context: Any) -> Dict[str, Any]:
    """
    Lambda entry point for document extraction.
    Keeps handler thin, business logic in service.
    """
    try:
        # Initialize service with dependencies
        s3_client = get_s3_client()
        claude_api_key = get_parameter("/compliance/claude-api-key")
        
        service = DocumentExtractorService(
            s3_client=s3_client,
            claude_api_key=claude_api_key
        )
        
        # Extract S3 event information
        s3_event = event['Records'][0]['s3']
        bucket = s3_event['bucket']['name']
        key = s3_event['object']['key']
        
        logger.info(f"Processing document: s3://{bucket}/{key}")
        
        # Process document
        result = service.extract_document(bucket, key)
        
        return {
            'statusCode': 200,
            'body': json.dumps({
                'message': 'Document processed successfully',
                'document_key': key,
                'extracted_fields': result.field_count,
                'confidence_score': result.confidence_score
            })
        }
        
    except ExtractionError as e:
        logger.error(f"Extraction failed: {e}")
        return {
            'statusCode': 422,
            'body': json.dumps({'error': str(e)})
        }
    except Exception as e:
        logger.error(f"Unexpected error: {e}")
        return {
            'statusCode': 500,
            'body': json.dumps({'error': 'Internal server error'})
        }
```

### Business Logic Service (Fully Testable)

```python
# lambda-functions/document_extractor/extractor_service.py
from dataclasses import dataclass
from typing import Dict, Any
import boto3
from anthropic import Anthropic

from ..shared.exceptions import ExtractionError
from .models import ExtractionResult

@dataclass
class DocumentExtractorService:
    """
    Business logic for document extraction.
    Dependency injection makes this fully testable.
    """
    s3_client: boto3.client
    claude_api_key: str
    
    def __post_init__(self):
        self.claude = Anthropic(api_key=self.claude_api_key)
    
    def extract_document(self, bucket: str, key: str) -> ExtractionResult:
        """Extract structured data from document in S3."""
        try:
            # Download document
            response = self.s3_client.get_object(Bucket=bucket, Key=key)
            document_content = response['Body'].read()
            
            # Extract with Claude
            extraction_result = self._extract_with_claude(document_content)
            
            # Save results to database (via shared service)
            # self.save_extraction_result(extraction_result)
            
            return extraction_result
            
        except Exception as e:
            raise ExtractionError(f"Failed to extract document {key}: {e}")
    
    def _extract_with_claude(self, content: bytes) -> ExtractionResult:
        """Extract structured data using Claude API."""
        # Implementation details...
        pass
```

## Local Development Workflow

### 1. Standard Development
```bash
# Start full development environment
make dev

# Develop and test business logic (fast unit tests)
make test-unit

# Test Lambda functions locally
make lambda-test
```

### 2. Lambda-Specific Testing
```bash
# Test Lambda handler with mock events
docker-compose exec lambda-dev python -m pytest lambda-functions/tests/ -v

# Deploy to LocalStack and test integration
make lambda-deploy-local

# Invoke Lambda with test event
awslocal lambda invoke \
  --function-name document-extractor \
  --payload file://lambda-functions/events/s3-document-upload.json \
  response.json

# View logs
make lambda-logs
```

### 3. SAM Local Testing (Optional)
```bash
# Build SAM application
make sam-build

# Start local API Gateway
make sam-local-api

# Invoke specific function
make sam-invoke
```

## Testing Strategy for Lambda Functions

### Unit Tests (Fast, Isolated)
```python
# lambda-functions/document_extractor/tests/test_service.py
import pytest
from unittest.mock import Mock, MagicMock
from ..extractor_service import DocumentExtractorService
from ..models import ExtractionResult

def test_extract_document_success():
    """Test business logic without AWS dependencies."""
    # Mock dependencies
    mock_s3_client = Mock()
    mock_s3_client.get_object.return_value = {
        'Body': MagicMock(read=lambda: b'test document content')
    }
    
    service = DocumentExtractorService(
        s3_client=mock_s3_client,
        claude_api_key="test-key"
    )
    
    # Mock Claude API response
    service.claude = Mock()
    service.claude.messages.create.return_value = Mock(
        content=[Mock(text='{"field1": "value1"}')]
    )
    
    # Test extraction
    result = service.extract_document("test-bucket", "test-key")
    
    # Verify
    assert isinstance(result, ExtractionResult)
    mock_s3_client.get_object.assert_called_once_with(
        Bucket="test-bucket", 
        Key="test-key"
    )
```

### Integration Tests (LocalStack)
```python
# lambda-functions/document_extractor/tests/test_handler_integration.py
import json
import pytest
import boto3
from moto import mock_s3

@pytest.mark.integration
@mock_s3
def test_lambda_handler_with_s3():
    """Test Lambda handler with real S3 operations."""
    # Setup S3 bucket and object
    s3_client = boto3.client('s3', region_name='us-east-1')
    s3_client.create_bucket(Bucket='test-bucket')
    s3_client.put_object(
        Bucket='test-bucket',
        Key='test-document.pdf',
        Body=b'test document content'
    )
    
    # Create S3 event
    event = {
        'Records': [{
            's3': {
                'bucket': {'name': 'test-bucket'},
                'object': {'key': 'test-document.pdf'}
            }
        }]
    }
    
    # Import and test handler
    from ..handler import main
    response = main(event, {})
    
    # Verify response
    assert response['statusCode'] == 200
    body = json.loads(response['body'])
    assert body['document_key'] == 'test-document.pdf'
```

### End-to-End Tests (Full Stack)
```python
# tests/e2e/test_document_processing_flow.py
import pytest
import requests
import boto3

@pytest.mark.e2e
def test_complete_document_processing():
    """Test complete flow: Upload → Lambda → Database → API"""
    # Upload document to S3 (triggers Lambda)
    s3_client = boto3.client(
        's3',
        endpoint_url='http://localhost:4566',
        aws_access_key_id='test',
        aws_secret_access_key='test'
    )
    
    s3_client.put_object(
        Bucket='compliance-documents',
        Key='permit-application.pdf',
        Body=open('fixtures/sample-permit.pdf', 'rb')
    )
    
    # Wait for Lambda processing
    import time
    time.sleep(2)
    
    # Verify results via API
    response = requests.get(
        'http://localhost:8000/api/v1/documents/permit-application.pdf'
    )
    
    assert response.status_code == 200
    data = response.json()
    assert data['processing_status'] == 'completed'
    assert 'extracted_fields' in data
```

## Debugging Lambda Functions

### LocalStack Debugging
```bash
# View Lambda function logs
awslocal logs describe-log-groups
awslocal logs get-log-events \
  --log-group-name /aws/lambda/document-extractor \
  --log-stream-name latest

# Debug with additional logging
export DEBUG=1
make lambda-deploy-local
```

### SAM Local Debugging
```bash
# Start with debugger support
sam local start-api --debug-port 5858

# Attach Python debugger
# In VS Code: Add breakpoints, F5 to attach to process
```

### VS Code Integration
```json
// .vscode/launch.json
{
    "version": "0.2.0",
    "configurations": [
        {
            "name": "SAM CLI Lambda",
            "type": "python",
            "request": "attach",
            "port": 5858,
            "host": "localhost",
            "pathMappings": [
                {
                    "localRoot": "${workspaceFolder}/lambda-functions",
                    "remoteRoot": "/var/task"
                }
            ]
        }
    ]
}
```

## Best Practices

### 1. Separate Handler from Business Logic
- Keep Lambda handlers thin (just AWS event handling)
- Put business logic in testable service classes
- Use dependency injection for AWS clients

### 2. Share Code Between API and Lambda
- Common models in `src/models/`
- Shared utilities in `src/shared/`
- Database models accessible from both

### 3. Environment Parity
- Same Python version in Lambda and API containers
- Same dependencies (shared requirements.txt)
- Same environment variables and configuration

### 4. Monitoring and Observability
- Structured logging with correlation IDs
- Custom CloudWatch metrics for business events
- Error tracking and alerting

This approach gives you excellent local development experience that closely mirrors AWS Lambda behavior, while maintaining fast test feedback cycles and code quality.