# Testing Guide

This document outlines the testing strategy and tools used in the Compliance Engine frontend.

## Testing Stack

### 🧪 Unit & Integration Testing
- **Jest** - Test framework and runner
- **React Testing Library** - Component testing utilities
- **jest-axe** - Accessibility testing
- **@testing-library/user-event** - User interaction simulation

### 🎭 End-to-End Testing
- **Playwright** - Browser automation and E2E testing
- **@axe-core/playwright** - E2E accessibility testing

### 📚 Component Documentation & Testing
- **Storybook** - Component documentation and isolation
- **@storybook/addon-a11y** - Accessibility testing in Storybook
- **@storybook/test-runner** - Automated testing of stories

## Test Scripts

```bash
# Unit and integration tests
npm run test                    # Run tests once
npm run test:watch             # Run tests in watch mode
npm run test:coverage          # Run tests with coverage report
npm run test:ci                # Run tests for CI (no watch, with coverage)

# Accessibility-specific tests
npm run test:accessibility     # Run only accessibility tests

# End-to-end tests
npm run test:e2e               # Run Playwright tests
npm run test:e2e:ui            # Run Playwright tests with UI
npm run test:e2e:debug         # Run Playwright tests in debug mode
npm run playwright:install     # Install Playwright browsers

# Storybook
npm run storybook              # Start Storybook dev server
npm run build-storybook        # Build Storybook for production
npm run test:storybook         # Test all Storybook stories

# Run all tests
npm run test:all               # Run unit, E2E, and Storybook tests
```

## Testing Structure

```
frontend/
├── src/
│   ├── components/
│   │   ├── __tests__/
│   │   │   ├── Component.test.tsx          # Unit tests
│   │   │   └── Component.a11y.test.tsx     # Accessibility tests
│   │   ├── Component.tsx
│   │   └── Component.stories.tsx           # Storybook stories
│   └── utils/
│       └── __tests__/
│           └── util.test.ts
├── e2e/
│   ├── license-verification.spec.ts        # E2E tests
│   └── accessibility.spec.ts               # E2E accessibility tests
├── jest.config.js                          # Jest configuration
├── jest.setup.js                           # Jest setup and mocks
├── jest.polyfills.js                       # Polyfills for Node.js
└── playwright.config.ts                    # Playwright configuration
```

## Testing Strategies

### 1. Unit Testing

Test individual components and utilities in isolation:

```typescript
// Example: Component.test.tsx
import { render, screen, fireEvent } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import Component from '../Component'

describe('Component', () => {
  it('renders correctly', () => {
    render(<Component />)
    expect(screen.getByRole('button')).toBeInTheDocument()
  })
  
  it('handles user interaction', async () => {
    const user = userEvent.setup()
    const onSubmit = jest.fn()
    render(<Component onSubmit={onSubmit} />)
    
    await user.click(screen.getByRole('button'))
    expect(onSubmit).toHaveBeenCalled()
  })
})
```

### 2. Accessibility Testing

Ensure components meet accessibility standards:

```typescript
// Example: Component.a11y.test.tsx
import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import Component from '../Component'

expect.extend(toHaveNoViolations)

describe('Component Accessibility', () => {
  it('should not have accessibility violations', async () => {
    const { container } = render(<Component />)
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })
})
```

### 3. End-to-End Testing

Test complete user workflows:

```typescript
// Example: e2e/workflow.spec.ts
import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('License Verification Workflow', () => {
  test('user can verify a license', async ({ page }) => {
    await page.goto('/')
    
    // Fill form and submit
    await page.fill('[name="licenseNumber"]', 'ABC123')
    await page.click('button[type="submit"]')
    
    // Verify results
    await expect(page.getByText('License Verified')).toBeVisible()
  })
  
  test('meets accessibility standards', async ({ page }) => {
    await page.goto('/')
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
    expect(accessibilityScanResults.violations).toEqual([])
  })
})
```

### 4. Visual & Interactive Testing with Storybook

Document and test component variations:

```typescript
// Example: Component.stories.tsx
import type { Meta, StoryObj } from '@storybook/react'
import Component from './Component'

const meta: Meta<typeof Component> = {
  title: 'Components/Component',
  component: Component,
  parameters: {
    docs: {
      description: {
        component: 'Component description and usage guidelines',
      },
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

export const Default: Story = {
  args: {
    prop: 'value',
  },
}

export const Loading: Story = {
  args: {
    isLoading: true,
  },
}

export const WithError: Story = {
  args: {
    error: 'Sample error message',
  },
}
```

## Testing Best Practices

### 1. Test Behavior, Not Implementation
- Focus on what the user sees and does
- Test outputs and side effects, not internal state
- Use accessible queries (getByRole, getByLabelText)

### 2. Accessibility First
- Include accessibility tests for all interactive components
- Test keyboard navigation and screen reader compatibility
- Verify color contrast and focus management

### 3. Mobile and Responsive Testing
- Test components on different viewport sizes
- Ensure touch targets meet minimum size requirements
- Verify responsive layouts work correctly

### 4. Internationalization Testing
- Test components with different locales
- Verify text expansion doesn't break layouts
- Test RTL languages when applicable

### 5. Error Handling
- Test error states and validation
- Verify error messages are accessible
- Test network failure scenarios

## Coverage Goals

- **Unit Tests**: 80%+ code coverage
- **Accessibility**: 100% of interactive components tested
- **E2E Tests**: Critical user paths covered
- **Visual Tests**: All component variations documented in Storybook

## CI/CD Integration

Tests run automatically on:
- Pull requests
- Main branch commits
- Before deployments

```yaml
# Example GitHub Actions workflow
- name: Run tests
  run: |
    npm run test:ci
    npm run test:e2e
    npm run build-storybook
```

## Debugging Tests

### Jest/RTL Debug
```typescript
import { screen } from '@testing-library/react'

// Debug rendered output
screen.debug()

// Debug specific element
screen.debug(screen.getByRole('button'))
```

### Playwright Debug
```bash
# Run tests in debug mode
npm run test:e2e:debug

# Run with UI mode
npm run test:e2e:ui
```

### Storybook Debug
- Use browser dev tools in Storybook
- Check accessibility violations in the A11y addon
- Test interactions with the Controls addon

## Common Issues & Solutions

### 1. Module Import Errors
- Ensure all mocks are properly configured in `jest.setup.js`
- Check that TypeScript paths are mapped correctly in Jest config

### 2. Async Testing Issues
- Use `waitFor` for asynchronous updates
- Properly setup user events with `userEvent.setup()`
- Handle promise rejections in tests

### 3. Accessibility Test Failures
- Check color contrast ratios
- Ensure proper ARIA attributes
- Verify keyboard navigation works

### 4. E2E Test Flakiness
- Use proper waiting strategies (`page.waitForLoadState`)
- Avoid hard-coded delays
- Use data-testid attributes for reliable element selection

## Resources

- [Testing Library Documentation](https://testing-library.com/)
- [Jest Documentation](https://jestjs.io/)
- [Playwright Documentation](https://playwright.dev/)
- [Storybook Documentation](https://storybook.js.org/)
- [WCAG Guidelines](https://www.w3.org/WAI/WCAG21/quickref/)
- [axe-core Rules](https://github.com/dequelabs/axe-core/blob/develop/doc/rule-descriptions.md)