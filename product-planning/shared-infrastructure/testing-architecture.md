# Testing Architecture & Development Patterns

## Core Testing Principles

For compliance software, testing is not optional - it's business-critical. A failed license verification or incorrect permit could have legal/financial consequences for customers.

## SOLID Principles Implementation

### Single Responsibility Principle
Each class/module has one reason to change:

```python
# Good: Single responsibility
class LicenseVerifier:
    def verify_license(self, license_number: str, state: str) -> LicenseStatus:
        pass

class LicenseRepository:
    def save_license_data(self, license_data: LicenseData) -> None:
        pass

class EmailNotifier:
    def send_notification(self, recipient: str, message: str) -> None:
        pass

# Bad: Multiple responsibilities
class LicenseManager:
    def verify_license(self, license_number: str) -> bool:
        pass
    def save_to_database(self, data: dict) -> None:
        pass
    def send_email_notification(self, email: str) -> None:
        pass
```

### Open/Closed Principle
Open for extension, closed for modification:

```python
# Abstract base for all data scrapers
class DataScraper(ABC):
    @abstractmethod
    def scrape_data(self, url: str) -> Dict[str, Any]:
        pass
    
    @abstractmethod
    def validate_response(self, data: Dict[str, Any]) -> bool:
        pass

# New scrapers extend without modifying existing code
class WisconsinLicenseScraper(DataScraper):
    def scrape_data(self, url: str) -> Dict[str, Any]:
        # Wisconsin-specific implementation
        pass
    
    def validate_response(self, data: Dict[str, Any]) -> bool:
        # Wisconsin-specific validation
        pass

class CaliforniaLicenseScraper(DataScraper):
    def scrape_data(self, url: str) -> Dict[str, Any]:
        # California-specific implementation
        pass
```

### Dependency Inversion
Depend on abstractions, not concretions:

```python
# Bad: Depends on concrete implementation
class LicenseService:
    def __init__(self):
        self.database = PostgreSQLDatabase()  # Concrete dependency
        self.scraper = WisconsinScraper()     # Concrete dependency

# Good: Depends on abstractions
class LicenseService:
    def __init__(self, 
                 repository: LicenseRepository,
                 scraper: DataScraper,
                 notifier: NotificationService):
        self.repository = repository
        self.scraper = scraper
        self.notifier = notifier
```

## Testing Strategy

### Test Pyramid Structure

```
    /\
   /  \     Unit Tests (70%)
  /____\    - Fast, isolated, deterministic
 /      \   - Mock external dependencies
/__________\ Integration Tests (20%)
           \ - Test component interactions
            \ - Use test database
           \ End-to-End Tests (10%)
            - Test complete user workflows
            - Use staging environment
```

### Unit Testing Patterns

**Repository Pattern for Database Testing**:
```python
# Abstract repository
class LicenseRepository(ABC):
    @abstractmethod
    def find_by_number(self, license_number: str) -> Optional[License]:
        pass
    
    @abstractmethod
    def save(self, license: License) -> None:
        pass

# Production implementation
class PostgreSQLLicenseRepository(LicenseRepository):
    def find_by_number(self, license_number: str) -> Optional[License]:
        # Real database query
        pass

# Test implementation
class InMemoryLicenseRepository(LicenseRepository):
    def __init__(self):
        self.licenses: Dict[str, License] = {}
    
    def find_by_number(self, license_number: str) -> Optional[License]:
        return self.licenses.get(license_number)
    
    def save(self, license: License) -> None:
        self.licenses[license.number] = license

# Test using in-memory repository
def test_license_verification():
    repository = InMemoryLicenseRepository()
    verifier = LicenseVerifier(repository)
    
    # Test is fast, deterministic, isolated
    result = verifier.verify("12345", "WI")
    assert result.status == LicenseStatus.ACTIVE
```

**Factory Pattern for Test Data**:
```python
class LicenseFactory:
    @staticmethod
    def create_active_license(
        number: str = "12345",
        state: str = "WI",
        expiration: Optional[datetime] = None
    ) -> License:
        return License(
            number=number,
            state=state,
            status=LicenseStatus.ACTIVE,
            expiration=expiration or datetime.now() + timedelta(days=365)
        )
    
    @staticmethod
    def create_expired_license(number: str = "67890") -> License:
        return License(
            number=number,
            state="WI",
            status=LicenseStatus.EXPIRED,
            expiration=datetime.now() - timedelta(days=30)
        )

# Clean, readable tests
def test_active_license_verification():
    license_data = LicenseFactory.create_active_license()
    repository = InMemoryLicenseRepository()
    repository.save(license_data)
    
    verifier = LicenseVerifier(repository)
    result = verifier.verify("12345", "WI")
    
    assert result.is_valid()
    assert result.expiration > datetime.now()
```

### Integration Testing Patterns

**Test Database Strategy**:
```python
# pytest fixtures for database testing
@pytest.fixture
def test_db():
    """Create isolated test database for each test"""
    engine = create_engine("postgresql://test:test@localhost/compliance_test")
    Base.metadata.create_all(engine)
    
    yield engine
    
    Base.metadata.drop_all(engine)

@pytest.fixture
def license_repository(test_db):
    return PostgreSQLLicenseRepository(test_db)

def test_license_data_persistence(license_repository):
    license_data = LicenseFactory.create_active_license()
    
    # Save to real database
    license_repository.save(license_data)
    
    # Retrieve from database
    retrieved = license_repository.find_by_number("12345")
    
    assert retrieved is not None
    assert retrieved.status == LicenseStatus.ACTIVE
```

**API Testing with FastAPI**:
```python
from fastapi.testclient import TestClient

@pytest.fixture
def client():
    # Override dependencies with test implementations
    app.dependency_overrides[get_license_repository] = lambda: InMemoryLicenseRepository()
    app.dependency_overrides[get_scraper] = lambda: MockDataScraper()
    
    return TestClient(app)

def test_license_verification_endpoint(client):
    response = client.get("/api/v1/verify/12345?state=WI")
    
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"
    assert "expiration" in data
```

## Development Patterns for Testability

### Configuration Management
```python
# Environment-specific config
class Config:
    DATABASE_URL: str = Field(..., env="DATABASE_URL")
    CLAUDE_API_KEY: str = Field(..., env="CLAUDE_API_KEY")
    DEBUG: bool = Field(False, env="DEBUG")

class TestConfig(Config):
    DATABASE_URL: str = "postgresql://test:test@localhost/compliance_test"
    CLAUDE_API_KEY: str = "test-key"
    DEBUG: bool = True

# Dependency injection for configuration
def get_config() -> Config:
    if os.getenv("TESTING"):
        return TestConfig()
    return Config()
```

### Error Handling Strategy
```python
# Custom exceptions for specific error cases
class LicenseNotFoundError(Exception):
    def __init__(self, license_number: str, state: str):
        self.license_number = license_number
        self.state = state
        super().__init__(f"License {license_number} not found in {state}")

class ScrapingError(Exception):
    def __init__(self, url: str, reason: str):
        self.url = url
        self.reason = reason
        super().__init__(f"Failed to scrape {url}: {reason}")

# Testable error handling
def test_license_not_found_error():
    repository = InMemoryLicenseRepository()
    verifier = LicenseVerifier(repository)
    
    with pytest.raises(LicenseNotFoundError) as exc_info:
        verifier.verify("99999", "WI")
    
    assert exc_info.value.license_number == "99999"
    assert exc_info.value.state == "WI"
```

## Testing Tools & Framework

### Required Dependencies
```python
# pyproject.toml
[tool.poetry.group.test.dependencies]
pytest = "^7.4.0"
pytest-asyncio = "^0.21.0"
pytest-cov = "^4.1.0"
httpx = "^0.24.0"  # For async HTTP testing
factory-boy = "^3.3.0"  # Test data factories
freezegun = "^1.2.0"  # Time mocking
responses = "^0.23.0"  # HTTP mocking
```

### Coverage Requirements & Reporting
- **Minimum 90%** code coverage for business logic
- **100% coverage** for critical paths (license verification, permit generation)
- **Coverage reports** generated after every test run
- **HTML reports** for detailed line-by-line analysis
- **Coverage badges** in README showing current coverage percentage

#### Coverage Commands
```bash
# Run tests with coverage
pytest --cov=src --cov-report=html --cov-report=term --cov-report=xml

# View detailed HTML report
open htmlcov/index.html

# Check coverage thresholds (fail if below 90%)
pytest --cov=src --cov-fail-under=90
```

#### Coverage Configuration in pyproject.toml
```toml
[tool.coverage.run]
source = ["src"]
omit = [
    "*/tests/*",
    "*/migrations/*", 
    "*/venv/*",
    "*/conftest.py"
]

[tool.coverage.report]
exclude_lines = [
    "pragma: no cover",
    "def __repr__",
    "raise AssertionError",
    "raise NotImplementedError",
    "if __name__ == .__main__.:"
]
show_missing = true
fail_under = 90

[tool.coverage.html]
directory = "htmlcov"
```

### Test Organization
```
tests/
├── unit/
│   ├── test_license_verifier.py
│   ├── test_document_extractor.py
│   └── test_jurisdiction_service.py
├── integration/
│   ├── test_database_operations.py
│   ├── test_api_endpoints.py
│   └── test_external_integrations.py
├── e2e/
│   ├── test_license_verification_flow.py
│   └── test_permit_generation_flow.py
├── fixtures/
│   ├── sample_documents/
│   └── mock_responses/
└── conftest.py
```

## Test Types and Strategy

### Unit Tests (70% of test suite)
```python
# Example: License verification business logic
def test_license_expiration_validation():
    """Unit test: Pure business logic, no external dependencies"""
    license_data = LicenseFactory.create_license(
        expiration=datetime.now() - timedelta(days=1)
    )
    
    validator = LicenseValidator()
    result = validator.validate_expiration(license_data)
    
    assert not result.is_valid
    assert "expired" in result.error_message.lower()

# Fast execution: <1s for entire unit test suite
# Isolated: No database, network, or file system access
# Deterministic: Same input always produces same output
```

### Integration Tests (20% of test suite)
```python
# Example: Database integration
@pytest.mark.integration
def test_license_repository_persistence(db_session):
    """Integration test: Real database operations"""
    repository = PostgreSQLLicenseRepository(db_session)
    license_data = LicenseFactory.create_license()
    
    # Save to real database
    repository.save(license_data)
    
    # Retrieve and verify
    retrieved = repository.find_by_number(license_data.number)
    assert retrieved.number == license_data.number
    assert retrieved.expiration == license_data.expiration

# Medium execution time: 5-10s for integration suite
# Real dependencies: Uses test database
# Verifies: Component interactions work correctly
```

### End-to-End Tests (10% of test suite)
```python
# Example: Complete user workflow
@pytest.mark.e2e
def test_license_verification_complete_flow(client):
    """E2E test: Full API workflow from request to response"""
    # Setup: Create license data in test database
    test_license = LicenseFactory.create_active_license(number="12345")
    
    # Action: Make API request
    response = client.get("/api/v1/verify/12345?state=WI")
    
    # Verification: Complete response validation
    assert response.status_code == 200
    data = response.json()
    assert data["status"] == "active"
    assert data["license_number"] == "12345"
    assert data["state"] == "WI"
    assert "expiration" in data
    assert "confidence_score" in data

# Slower execution: 30-60s for E2E suite
# Full stack: API → Business Logic → Database → Response
# Verifies: Complete user scenarios work end-to-end
```

## Test Execution Commands

### Local Development
```bash
# Run all tests with coverage (recommended for development)
make test

# Run specific test types
make test-unit      # Fast feedback during development
make test-integration  # Verify database/external integrations
make test-e2e       # Full workflow validation

# Generate and view coverage report
make coverage

# Run tests in watch mode during development
docker-compose exec api poetry run pytest-watch tests/unit/
```

### CI/CD Pipeline
```yaml
name: Test Suite
on: [push, pull_request]

jobs:
  unit-tests:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - name: Run unit tests
        run: |
          docker-compose -f docker-compose.test.yml up --build test-runner
          docker cp $(docker-compose -f docker-compose.test.yml ps -q test-runner):/app/htmlcov ./htmlcov
      
      - name: Upload coverage to Codecov
        uses: codecov/codecov-action@v3
        with:
          file: ./coverage.xml
          fail_ci_if_error: true
      
      - name: Check coverage threshold
        run: |
          python -c "
          import xml.etree.ElementTree as ET
          tree = ET.parse('coverage.xml')
          coverage = float(tree.getroot().attrib['line-rate']) * 100
          if coverage < 90:
              raise Exception(f'Coverage {coverage:.1f}% below 90% threshold')
          print(f'✅ Coverage: {coverage:.1f}%')
          "

  integration-tests:
    runs-on: ubuntu-latest
    needs: unit-tests
    steps:
      - uses: actions/checkout@v3
      - name: Run integration tests
        run: docker-compose exec api poetry run pytest tests/integration/ -v

  e2e-tests:
    runs-on: ubuntu-latest
    needs: integration-tests
    steps:
      - uses: actions/checkout@v3
      - name: Run E2E tests
        run: docker-compose exec api poetry run pytest tests/e2e/ -v
```

## Coverage Reporting and Enforcement

### Real-time Coverage Feedback
- **Terminal output**: Shows coverage percentage after each test run
- **HTML reports**: Detailed line-by-line coverage analysis
- **Coverage badges**: GitHub README badges showing current coverage
- **Failure on low coverage**: Tests fail if coverage drops below 90%

### Coverage Analysis Workflow
1. **Write test** → Run `make test-unit` for fast feedback
2. **Check coverage** → Run `make coverage` to see detailed report
3. **Identify gaps** → HTML report shows uncovered lines
4. **Add tests** → Write tests for uncovered code paths
5. **Verify** → Coverage increases, tests pass

This comprehensive testing strategy ensures reliability for compliance software while maintaining fast development velocity through proper test organization and tooling.