# Python Backend String Constants System

This system provides centralized string constants for internationalization in the FastAPI backend, similar to the frontend TypeScript implementation.

## Benefits

1. **Avoid Magic Strings**: Use typed constants instead of string literals for translation keys
2. **Track Usage**: See how often each translation is used across the codebase
3. **Consolidation Opportunities**: Identify duplicate translations that can be consolidated  
4. **IDE Support**: Get autocomplete and type checking for translation keys
5. **Refactoring Safety**: Change translation keys in one place
6. **Performance Analytics**: Monitor which strings are used most frequently

## Quick Start

### Basic Usage

```python
from constants.strings import STRINGS
from utils.i18n_helpers import t

# Use string constants with translation function
message = t(STRINGS.COMMON.SUCCESS)
error_msg = t(STRINGS.AUTH.ACCESS_DENIED)
```

### Using Helper Functions

```python
from constants.strings import t_success, t_error, t_healthy
from utils.i18n_helpers import get_translator

# Quick helper functions
success_msg = t_success()
error_msg = t_error()
health_status = t_healthy()

# Context-aware translator
translator = get_translator(request)
message = translator.success()
auth_msg = translator.auth_failed()
```

### Using the TranslationContext

```python
from utils.i18n_helpers import get_translator

async def my_endpoint(request: Request):
    t = get_translator(request)
    
    return {
        "status": t.success(),
        "message": t.record_created(),
        "locale": t.locale
    }
```

## String Categories

### Common Strings (`STRINGS.COMMON`)
Frequently used status indicators and actions:
```python
STRINGS.COMMON.HEALTHY           # "healthy"
STRINGS.COMMON.UNHEALTHY         # "unhealthy" 
STRINGS.COMMON.SUCCESS           # "success"
STRINGS.COMMON.ERROR             # "error"
STRINGS.COMMON.OPERATIONAL       # "operational"
```

### Authentication (`STRINGS.AUTH`)
Authentication and authorization messages:
```python
STRINGS.AUTH.AUTHENTICATION_FAILED    # "Authentication failed"
STRINGS.AUTH.ACCESS_DENIED            # "Access denied"
STRINGS.AUTH.TOKEN_EXPIRED            # "Token has expired"
STRINGS.AUTH.INSUFFICIENT_PERMISSIONS # "Insufficient permissions"
```

### Validation (`STRINGS.VALIDATION`)
Input validation error messages:
```python
STRINGS.VALIDATION.VALIDATION_ERROR   # "Validation error"
STRINGS.VALIDATION.REQUIRED_FIELD     # "This field is required"
STRINGS.VALIDATION.INVALID_FORMAT     # "Invalid format"
STRINGS.VALIDATION.INVALID_EMAIL      # "Invalid email address"
```

### Database (`STRINGS.DATABASE`)
Database operation messages:
```python
STRINGS.DATABASE.RECORD_CREATED       # "Record created successfully"
STRINGS.DATABASE.RECORD_NOT_FOUND     # "Record not found"
STRINGS.DATABASE.DATABASE_ERROR       # "Database error occurred"
STRINGS.DATABASE.CONNECTION_FAILED    # "Database connection failed"
```

### OIDC (`STRINGS.OIDC`)
OAuth/OIDC verification messages:
```python
STRINGS.OIDC.VERIFICATION_SUCCESSFUL  # "OAuth verification successful"
STRINGS.OIDC.DEPLOYMENT_ALLOWED       # "Deployment allowed - all providers verified"
STRINGS.OIDC.GOOGLE                   # "Google"
STRINGS.OIDC.MICROSOFT                # "Microsoft"
```

### Errors (`STRINGS.ERROR`)
HTTP and business logic errors:
```python
STRINGS.ERROR.NOT_FOUND               # "Not found"
STRINGS.ERROR.INTERNAL_SERVER_ERROR   # "Internal server error"
STRINGS.ERROR.INVALID_OPERATION       # "Invalid operation"
```

## Usage Tracking & Analytics

The system automatically tracks string usage in development mode:

```python
from constants.strings import print_usage_stats, get_string_usage_stats
from utils.i18n_helpers import track_translation_coverage

# Print usage statistics
print_usage_stats()

# Get programmatic access to stats
stats = get_string_usage_stats()
print(f"Most used: {max(stats, key=stats.get)}")

# Check translation coverage
coverage = track_translation_coverage()
print(f"Coverage: {coverage['coverage_percent']}%")
```

Example output:
```
=== String Usage Statistics ===
Translation Key                                      Count
------------------------------------------------------------
healthy                                                 45
success                                                 23
error                                                   18
Authentication failed                                   12
Record not found                                         8

Total unique strings: 156
Total usage count: 342
Average usage per string: 2.2
```

## Advanced Features

### Context-Aware Translation

```python
from utils.i18n_helpers import t_with_context

# Different contexts for same base string
admin_success = t_with_context(STRINGS.COMMON.SUCCESS, context="admin_panel")
user_success = t_with_context(STRINGS.COMMON.SUCCESS, context="user_dashboard")
```

### Pluralization Support

```python
from utils.i18n_helpers import t_pluralize

# Handles singular/plural forms
message = t_pluralize("record_found", count=users.count())
# count=1: "1 record found"
# count=5: "5 records found"
```

### Response Message Decoration

```python
from utils.i18n_helpers import translate_response
from constants.strings import STRINGS

@translate_response(STRINGS.DATABASE.RECORD_CREATED)
async def create_user():
    # Function logic here
    return {"message": "placeholder"}  # Will be auto-translated
```

### Validation & Health Checks

```python
from constants.strings import validate_all_strings
from utils.i18n_helpers import validate_translations

# Validate string constants are properly defined
if validate_all_strings():
    print("All string constants are valid")

# Check translation coverage
validation = validate_translations()
if not validation["validation_passed"]:
    print(f"Missing translations: {validation['missing_count']}")
```

## Integration with fastapi-babel

The system integrates seamlessly with existing fastapi-babel setup:

```python
# In your FastAPI app
from fastapi_babel import Babel, BabelConfigs

configs = BabelConfigs(
    ROOT_DIR=__file__,
    BABEL_DEFAULT_LOCALE="en", 
    BABEL_TRANSLATION_DIRECTORY="locales"
)

babel = Babel(configs=configs)
app.add_middleware(BabelMiddleware, babel=babel)
```

Translation files remain the same format:
```po
# locales/es/LC_MESSAGES/messages.po
msgid "healthy"
msgstr "saludable"

msgid "Authentication failed"  
msgstr "Falló la autenticación"
```

## Best Practices

### Do ✅

```python
# Use string constants
message = t(STRINGS.COMMON.SUCCESS)

# Use helper functions for common strings
status = t_healthy()

# Use context-aware translator
translator = get_translator(request)
auth_msg = translator.auth_failed()

# Group related functionality
class UserService:
    def __init__(self, request: Request):
        self.t = get_translator(request)
    
    async def create_user(self):
        # ... logic ...
        return {"message": self.t.record_created()}
```

### Don't ❌

```python
# Don't use magic strings
message = _("success")  # Hard to track, typo-prone

# Don't duplicate string constants
AUTH_FAILED = "Authentication failed"
LOGIN_ERROR = "Authentication failed"  # Should reuse same constant

# Don't hardcode strings
return {"error": "Not found"}  # Not translatable
```

## Adding New Strings

1. **Check for existing strings**: Look through `STRINGS` to see if a similar translation exists
2. **Choose the right category**: Add to appropriate class in `strings.py`
3. **Use descriptive names**: `AUTHENTICATION_FAILED` is better than `AUTH_ERR_1`
4. **Update helper functions**: Add to `i18n_helpers.py` if commonly used
5. **Add to translation files**: Update both `en` and `es` `.po` files
6. **Compile translations**: Run `pybabel compile -d locales`

## Translation File Management

After adding new constants, update translation files:

```bash
# Extract new strings
cd backend
source .venv/bin/activate
pybabel extract -F babel.cfg -o messages.pot src/

# Update existing translations
pybabel update -i messages.pot -d locales

# Compile for use
pybabel compile -d locales

# Test translations
python test_i18n.py
```

## Performance Considerations

- **Usage tracking** only runs in development mode
- **String constants** are loaded once at startup
- **Translation caching** handled by fastapi-babel
- **Memory overhead** is minimal (constants are just strings)

## Example: Complete Endpoint Implementation

```python
from fastapi import APIRouter, Request, HTTPException
from utils.i18n_helpers import get_translator, t
from constants.strings import STRINGS

router = APIRouter()

@router.get("/users/{user_id}")
async def get_user(user_id: int, request: Request):
    translator = get_translator(request)
    
    try:
        user = await UserService.get_by_id(user_id)
        if not user:
            raise HTTPException(
                status_code=404,
                detail=translator.record_not_found()
            )
        
        return {
            "status": translator.success(),
            "data": user,
            "message": t(STRINGS.DATABASE.RECORD_FOUND)
        }
        
    except DatabaseError:
        raise HTTPException(
            status_code=500,
            detail=translator.database_error()
        )
```

This approach provides type safety, usage tracking, and easy maintenance while preserving the existing fastapi-babel translation workflow.