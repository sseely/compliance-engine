# Python Backend String Constants System

This system provides centralized string constants for internationalization in the FastAPI backend.

## Two-File Structure

The constants are split into two files based on translation needs:

### `user_messages.py` - Translatable Strings (MSG)
User-facing messages that appear in API responses. These **must** have translations in `.po` files.

```python
from constants.user_messages import MSG
from utils.i18n_helpers import t

# Use the t() function to get translated strings
message = t(MSG.SUCCESS)
error_msg = t(MSG.AUTH.ACCESS_DENIED)
health = t(MSG.STATUS.HEALTHY)
```

### `internal.py` - Internal Constants (INTERNAL)
Logging, diagnostics, audit trails, and proper nouns. English only - no translation needed.

```python
from constants.internal import INTERNAL

logger.info(INTERNAL.DB.CONNECTED)
logger.warning(INTERNAL.SECURITY.VIOLATION_DETECTED)
provider = INTERNAL.OAUTH_PROVIDERS.GOOGLE  # Proper noun
```

## MSG Categories

### Status (`MSG.STATUS`)
```python
MSG.STATUS.HEALTHY      # "healthy"
MSG.STATUS.UNHEALTHY    # "unhealthy"
MSG.STATUS.SUCCESS      # "success"
MSG.STATUS.ERROR        # "error"
MSG.STATUS.PENDING      # "pending"
MSG.STATUS.OPERATIONAL  # "operational"
```

### Authentication (`MSG.AUTH`)
```python
MSG.AUTH.AUTHENTICATION_REQUIRED   # "Authentication required"
MSG.AUTH.AUTHENTICATION_FAILED     # "Authentication failed"
MSG.AUTH.TOKEN_EXPIRED             # "Token has expired"
MSG.AUTH.ACCESS_DENIED             # "Access denied"
MSG.AUTH.INSUFFICIENT_PERMISSIONS  # "Insufficient permissions"
```

### Validation (`MSG.VALIDATION`)
```python
MSG.VALIDATION.VALIDATION_ERROR  # "Validation error"
MSG.VALIDATION.REQUIRED_FIELD    # "This field is required"
MSG.VALIDATION.INVALID_FORMAT    # "Invalid format"
MSG.VALIDATION.INVALID_EMAIL     # "Invalid email address"
```

### Records (`MSG.RECORD`)
```python
MSG.RECORD.RECORD_CREATED    # "Record created successfully"
MSG.RECORD.RECORD_UPDATED    # "Record updated successfully"
MSG.RECORD.RECORD_DELETED    # "Record deleted successfully"
MSG.RECORD.RECORD_NOT_FOUND  # "Record not found"
```

### Errors (`MSG.ERROR`)
```python
MSG.ERROR.BAD_REQUEST          # "Bad request"
MSG.ERROR.NOT_FOUND            # "Not found"
MSG.ERROR.INTERNAL_ERROR       # "An error occurred"
MSG.ERROR.SERVICE_UNAVAILABLE  # "Service temporarily unavailable"
MSG.ERROR.RATE_LIMIT_EXCEEDED  # "Rate limit exceeded"
```

## INTERNAL Categories

### Database Status (`INTERNAL.DB`)
```python
INTERNAL.DB.CONNECTED           # "Database connected"
INTERNAL.DB.CONNECTION_FAILED   # "Database connection failed"
INTERNAL.DB.POOL_EXHAUSTED      # "Connection pool exhausted"
```

### Security Events (`INTERNAL.SECURITY`)
```python
INTERNAL.SECURITY.VIOLATION_DETECTED   # "Security violation detected"
INTERNAL.SECURITY.SUSPICIOUS_ACTIVITY  # "Suspicious activity detected"
INTERNAL.SECURITY.IP_BLOCKED           # "IP address blocked"
```

### OAuth Providers (`INTERNAL.OAUTH_PROVIDERS`)
Proper nouns - never translated:
```python
INTERNAL.OAUTH_PROVIDERS.GOOGLE     # "Google"
INTERNAL.OAUTH_PROVIDERS.MICROSOFT  # "Microsoft"
INTERNAL.OAUTH_PROVIDERS.GITHUB     # "GitHub"
```

## Using the TranslationContext

For request-scoped translations with convenient helper methods:

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

## Translation Workflow

```bash
cd backend
source .venv/bin/activate

# Extract strings (updates messages.pot)
pybabel extract -F babel.cfg -o messages.pot src/

# Update translation files
pybabel update -i messages.pot -d locales

# Compile for production
pybabel compile -d locales
```

## Adding New Strings

1. **User-facing?** Add to `user_messages.py` under the appropriate class
2. **Internal only?** Add to `internal.py` under the appropriate class
3. **User-facing strings** must be added to `messages.pot` and translated in `.po` files
4. Run `pybabel compile -d locales` after updating translations

## Best Practices

### Do
```python
# Use MSG for user responses
return {"message": t(MSG.RECORD.RECORD_CREATED)}

# Use INTERNAL for logging
logger.error(INTERNAL.DB.CONNECTION_FAILED, error=str(e))

# Use TranslationContext for multiple translations
translator = get_translator(request)
return {"status": translator.success(), "detail": translator.record_created()}
```

### Don't
```python
# Don't use magic strings
message = _("success")  # Hard to track

# Don't translate internal messages
logger.info(t(INTERNAL.DB.CONNECTED))  # Unnecessary translation

# Don't mix concerns
return {"message": INTERNAL.SECURITY.VIOLATION_DETECTED}  # Security message to user
```
