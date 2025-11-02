# Internationalization (i18n) Guide

## Overview

The Compliance Engine supports multiple languages through a comprehensive internationalization (i18n) system built on `fastapi-babel`. Currently supported languages:

- **English (en)** - Default language
- **Spanish (es)** - Español

## Quick Start

### Making API Requests with Language Preference

1. **Using Accept-Language Header** (Recommended):
```bash
curl -H "Accept-Language: es" http://localhost:8000/api/v1/health
curl -H "Accept-Language: en" http://localhost:8000/api/v1/health
```

2. **Using URL Parameter**:
```bash
curl "http://localhost:8000/api/v1/health?locale=es"
curl "http://localhost:8000/api/v1/health?locale=en"
```

### Language Selection Priority

1. `locale` URL parameter (highest priority)
2. `Accept-Language` HTTP header
3. Default language (`en`)

## Available Endpoints

### Get Supported Languages
```bash
GET /api/v1/i18n/languages
```
Returns:
```json
{
  "languages": {
    "en": "English",
    "es": "Español"
  },
  "current_locale": "en",
  "default_locale": "en"
}
```

### Get Current Locale
```bash
GET /api/v1/i18n/locale
```

### Validate Locale
```bash
POST /api/v1/i18n/locale/validate
{
  "locale": "es"
}
```

### Localized Health Check
```bash
GET /api/v1/i18n/health/localized
```

## For Developers

### Adding Translatable Strings

1. **Wrap strings in translation function**:
```python
from fastapi_babel import _

@app.get("/status")
async def get_status():
    return {"message": _("System is running")}
```

2. **Extract new strings**:
```bash
cd backend
source .venv/bin/activate
pybabel extract -F babel.cfg -o messages.pot src/
```

3. **Update existing translations**:
```bash
pybabel update -i messages.pot -d locales
```

4. **Edit translation files**:
- `locales/es/LC_MESSAGES/messages.po` - Spanish translations
- `locales/en/LC_MESSAGES/messages.po` - English translations

5. **Compile translations**:
```bash
pybabel compile -d locales
```

### Translation File Structure

```
backend/
├── locales/
│   ├── en/
│   │   └── LC_MESSAGES/
│   │       ├── messages.po
│   │       └── messages.mo
│   └── es/
│       └── LC_MESSAGES/
│           ├── messages.po
│           └── messages.mo
├── messages.pot
├── babel.cfg
└── babel.py
```

### Best Practices

1. **Always use the `_()` function for user-facing strings**:
```python
# Good
return {"status": _("healthy")}

# Bad  
return {"status": "healthy"}
```

2. **Keep original English text in code**:
```python
# Good
_("User not found")

# Bad
_("usuario_no_encontrado")
```

3. **Use descriptive context for similar words**:
```python
# Instead of just _("Cancel")
_("Cancel order")  # for order cancellation
_("Cancel subscription")  # for subscription cancellation
```

4. **Avoid string concatenation in translations**:
```python
# Good
_("Welcome back, {username}").format(username=user.name)

# Bad
_("Welcome back, ") + user.name
```

### Adding New Languages

1. **Initialize new language** (example for French):
```bash
pybabel init -i messages.pot -d locales -l fr
```

2. **Update supported languages in `core/i18n.py`**:
```python
SUPPORTED_LANGUAGES = {
    "en": "English",
    "es": "Español", 
    "fr": "Français"  # Add new language
}
```

3. **Translate strings in the new `.po` file**

4. **Compile translations**:
```bash
pybabel compile -d locales
```

## Configuration

### Babel Configuration (`babel.cfg`)
```ini
[python: **.py]
[jinja2: **/templates/**.html]
extensions=jinja2.ext.autoescape,jinja2.ext.with_
```

### Environment Variables

No additional environment variables needed. The system uses:
- Default locale: `en`
- Translation directory: `locales/`
- Locale detection: HTTP headers and URL parameters

## Testing Translations

### Unit Testing
```python
def test_spanish_translation():
    with override_locale('es'):
        result = _("healthy")
        assert result == "saludable"
```

### Manual Testing
```bash
# Test Spanish
curl -H "Accept-Language: es" http://localhost:8000/

# Test English (default)
curl http://localhost:8000/

# Test with URL parameter
curl "http://localhost:8000/?locale=es"
```

## Troubleshooting

### Common Issues

1. **Translations not appearing**:
   - Check if `.mo` files are compiled: `pybabel compile -d locales`
   - Verify correct `Accept-Language` header format
   - Ensure locale code matches supported languages

2. **Missing translations show English**:
   - This is expected fallback behavior
   - Add missing translations to `.po` files and recompile

3. **Installation issues**:
```bash
pip install fastapi-babel==1.0.0
```

### Debug Language Detection
Check current locale detection:
```bash
curl -H "Accept-Language: es,en;q=0.9" http://localhost:8000/api/v1/i18n/locale
```

## Examples

### API Response in English
```bash
curl http://localhost:8000/
```
```json
{
  "name": "Compliance Engine API",
  "status": "operational"
}
```

### API Response in Spanish
```bash
curl -H "Accept-Language: es" http://localhost:8000/
```
```json
{
  "name": "API del Motor de Cumplimiento", 
  "status": "operativo"
}
```