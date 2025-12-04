# String Constants System

This project uses a centralized string constants system to manage internationalization keys and track translation usage.

## Benefits

1. **Avoid Magic Strings**: Use typed constants instead of string literals for translation keys
2. **Track Usage**: See how often each translation is used across the codebase
3. **Consolidation Opportunities**: Identify duplicate translations that can be consolidated
4. **IDE Support**: Get autocomplete and type checking for translation keys
5. **Refactoring Safety**: Change translation keys in one place

## Quick Start

### Basic Usage

```typescript
import { useStringConstant } from '@/hooks/useStringConstants';
import { STRING_CONSTANTS } from '@/constants/strings';

function MyComponent() {
  const title = useStringConstant(STRING_CONSTANTS.ADMIN.AUTH_VERIFICATION_TITLE);
  return <h1>{title}</h1>;
}
```

### Using Specialized Hooks

```typescript
import { useCommonStrings, useStatusStrings } from '@/hooks/useStringConstants';

function ButtonExample() {
  const common = useCommonStrings();
  const status = useStatusStrings();
  
  return (
    <div>
      <button>{common.save()}</button>
      <button>{common.cancel()}</button>
      <span className={status.success() ? 'text-green-500' : 'text-red-500'}>
        {status.success()}
      </span>
    </div>
  );
}
```

## Translation Key Organization

### Common UI Strings (`COMMON_STRINGS`)
Actions, navigation, and frequently used UI text:
- `SUBMIT`, `CANCEL`, `SAVE`, `EDIT`, `DELETE`
- `HOME`, `DASHBOARD`, `SETTINGS`
- `LOADING`, `ERROR`, `SUCCESS`

### Status Values (`STATUS_STRINGS`)
Status indicators that appear in multiple contexts:
- `ACTIVE`, `EXPIRED`, `SUSPENDED`, `REVOKED`
- `SUCCESS`, `FAILURE`, `NOT_TESTED`

### Provider Names (`PROVIDER_STRINGS`)
OAuth provider-related text:
- `GOOGLE`, `MICROSOFT`, `LINKEDIN`, `APPLE`
- `OAUTH_NOT_CONFIGURED`, `TESTING`

### Form Fields (`FORM_STRINGS`)
Reusable form labels and placeholders:
- `LICENSE_NUMBER`, `FIRST_NAME`, `LAST_NAME`
- Field-specific placeholders and help text

### Error Messages (`ERROR_STRINGS`)
Common error messages:
- `SERVICE_UNAVAILABLE`, `NETWORK_ERROR`
- `LICENSE_NOT_FOUND`, `UNEXPECTED_ERROR`

## Usage Tracking (Development Only)

In development mode, the system tracks how often each string is used:

```typescript
import { getStringUsageStats } from '@/hooks/useStringConstants';

// In browser console:
getStringUsageStats(); // Shows top 20 most used strings
```

This helps identify:
- Strings that are used frequently and should definitely be reusable
- Opportunities to consolidate similar translations
- Dead translation keys that aren't being used

## Best Practices

### Do ✅
```typescript
// Use string constants
const title = useStringConstant(STRING_CONSTANTS.COMMON.LOADING);

// Use specialized hooks for better organization
const common = useCommonStrings();
const submitText = common.submit();

// Group related strings together
const { save, cancel, submit } = useCommonStrings();
```

### Don't ❌
```typescript
// Don't use magic strings
const title = t('common.loading'); // Hard to track, typo-prone

// Don't duplicate translation keys
const title1 = t('admin.save');
const title2 = t('forms.save'); // Should both use common.save

// Don't hardcode strings
const title = "Loading..."; // Not translatable
```

## Adding New Strings

1. **Check if it already exists**: Look through `STRING_CONSTANTS` to see if a similar translation exists
2. **Choose the right category**: Add to `COMMON_STRINGS` if it's reusable, or a specific category if it's domain-specific
3. **Use descriptive names**: `SUBMIT_BUTTON` is better than `BTN1`
4. **Update the hook**: Add the new string to the appropriate hook function
5. **Update types**: TypeScript will help ensure all new constants are properly typed

## Examples of Consolidation Opportunities

### Before (Duplicated)
```json
{
  "admin": { "save": "Save" },
  "forms": { "save": "Save" }, 
  "buttons": { "saveButton": "Save" }
}
```

### After (Consolidated)
```json
{
  "common": { "save": "Save" }
}
```

```typescript
// All components use the same string
const saveText = common.save();
```

## Translation Files

The string constants map to keys in:
- `/src/messages/en.json` - English translations
- `/src/messages/es.json` - Spanish translations

When adding new constants, ensure the corresponding translation keys exist in both files.