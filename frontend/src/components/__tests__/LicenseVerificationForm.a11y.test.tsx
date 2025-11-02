import { render } from '@testing-library/react'
import { axe, toHaveNoViolations } from 'jest-axe'
import { NextIntlClientProvider } from 'next-intl'
import LicenseVerificationForm from '../LicenseVerificationForm'
import { VALIDATION_RULES, TIMING } from '@/constants'

// Extend Jest matchers
expect.extend(toHaveNoViolations)

// Mock the accessibility hooks
jest.mock('@/hooks/useAccessibility', () => ({
  useAriaAnnouncements: () => ({
    announceFormError: jest.fn(),
    announceLoadingState: jest.fn(),
  }),
}))

// Mock the i18n utils
jest.mock('@/utils/i18n', () => ({
  useLicenseTypeOptions: () => [
    { value: '', label: 'Select license type' },
    { value: 'md', label: 'Medical Doctor (MD)' },
    { value: 'rn', label: 'Registered Nurse (RN)' },
  ],
  useStateOptions: () => [
    { value: '', label: 'Select state' },
    { value: 'ca', label: 'California' },
    { value: 'ny', label: 'New York' },
  ],
}))

const mockMessages = {
  verification: {
    form: {
      title: 'License Verification',
      subtitle: 'Enter license information to verify professional credentials',
      licenseNumber: 'License Number',
      licenseNumberPlaceholder: 'Enter license number',
      licenseType: 'License Type',
      state: 'State',
      firstName: 'First Name',
      firstNamePlaceholder: 'Enter first name',
      lastName: 'Last Name',
      lastNamePlaceholder: 'Enter last name',
      verifyButton: 'Verify License',
      verifyingButton: 'Verifying...',
      helpText: 'All fields are required for verification',
    },
    validation: {
      licenseNumberRequired: 'License number is required',
      licenseNumberMinLength: `License number must be at least ${VALIDATION_RULES.LICENSE_NUMBER_MIN_LENGTH} characters`,
      licenseTypeRequired: 'License type is required',
      stateRequired: 'State is required',
      firstNameRequired: 'First name is required',
      firstNameMinLength: `First name must be at least ${VALIDATION_RULES.FIRST_NAME_MIN_LENGTH} characters`,
      lastNameRequired: 'Last name is required',
      lastNameMinLength: `Last name must be at least ${VALIDATION_RULES.LAST_NAME_MIN_LENGTH} characters`,
    },
  },
}

const renderWithIntl = (component: React.ReactElement) => {
  return render(
    <NextIntlClientProvider messages={mockMessages} locale="en">
      {component}
    </NextIntlClientProvider>
  )
}

describe('LicenseVerificationForm Accessibility', () => {
  const mockOnSubmit = jest.fn()

  it('should not have any accessibility violations', async () => {
    const { container } = renderWithIntl(
      <LicenseVerificationForm onSubmit={mockOnSubmit} />
    )
    
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should not have accessibility violations in loading state', async () => {
    const { container } = renderWithIntl(
      <LicenseVerificationForm onSubmit={mockOnSubmit} isLoading={true} />
    )
    
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should not have accessibility violations with validation errors', async () => {
    const { container } = renderWithIntl(
      <LicenseVerificationForm onSubmit={mockOnSubmit} />
    )
    
    // Trigger validation by submitting empty form
    const form = container.querySelector('form')
    if (form) {
      const submitEvent = new Event('submit', { bubbles: true })
      form.dispatchEvent(submitEvent)
    }
    
    // Wait for validation errors to appear
    await new Promise(resolve => setTimeout(resolve, TIMING.TEST_TIMEOUT))
    
    const results = await axe(container)
    expect(results).toHaveNoViolations()
  })

  it('should meet WCAG AA color contrast requirements', async () => {
    const { container } = renderWithIntl(
      <LicenseVerificationForm onSubmit={mockOnSubmit} />
    )
    
    const results = await axe(container, {
      rules: {
        'color-contrast': { enabled: true },
        'color-contrast-enhanced': { enabled: false }, // WCAG AAA (stricter)
      },
    })
    
    expect(results).toHaveNoViolations()
  })

  it('should have proper keyboard navigation', async () => {
    const { container } = renderWithIntl(
      <LicenseVerificationForm onSubmit={mockOnSubmit} />
    )
    
    const results = await axe(container, {
      rules: {
        'focus-order-semantics': { enabled: true },
        'tabindex': { enabled: true },
      },
    })
    
    expect(results).toHaveNoViolations()
  })
})