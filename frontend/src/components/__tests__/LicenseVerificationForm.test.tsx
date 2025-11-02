import { render, screen, fireEvent, waitFor } from '@testing-library/react'
import userEvent from '@testing-library/user-event'
import { NextIntlClientProvider } from 'next-intl'
import LicenseVerificationForm from '../LicenseVerificationForm'
import type { FormData } from '@/types'
import { VALIDATION_RULES } from '@/constants'

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

describe('LicenseVerificationForm', () => {
  const mockOnSubmit = jest.fn()

  beforeEach(() => {
    jest.clearAllMocks()
  })

  it('renders all form fields', () => {
    renderWithIntl(<LicenseVerificationForm onSubmit={mockOnSubmit} />)

    expect(screen.getByLabelText(/license number/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/license type/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/state/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/first name/i)).toBeInTheDocument()
    expect(screen.getByLabelText(/last name/i)).toBeInTheDocument()
    expect(screen.getByRole('button', { name: /verify license/i })).toBeInTheDocument()
  })

  it('shows validation errors for empty fields', async () => {
    const user = userEvent.setup()
    renderWithIntl(<LicenseVerificationForm onSubmit={mockOnSubmit} />)

    const submitButton = screen.getByRole('button', { name: /verify license/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('License number is required')).toBeInTheDocument()
      expect(screen.getByText('License type is required')).toBeInTheDocument()
      expect(screen.getByText('State is required')).toBeInTheDocument()
      expect(screen.getByText('First name is required')).toBeInTheDocument()
      expect(screen.getByText('Last name is required')).toBeInTheDocument()
    })

    expect(mockOnSubmit).not.toHaveBeenCalled()
  })

  it('shows validation error for short license number', async () => {
    const user = userEvent.setup()
    renderWithIntl(<LicenseVerificationForm onSubmit={mockOnSubmit} />)

    const licenseNumberInput = screen.getByLabelText(/license number/i)
    await user.type(licenseNumberInput, 'AB')

    const submitButton = screen.getByRole('button', { name: /verify license/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('License number must be at least 3 characters')).toBeInTheDocument()
    })
  })

  it('submits form with valid data', async () => {
    const user = userEvent.setup()
    renderWithIntl(<LicenseVerificationForm onSubmit={mockOnSubmit} />)

    // Fill out the form
    await user.type(screen.getByLabelText(/license number/i), 'ABC123')
    await user.selectOptions(screen.getByLabelText(/license type/i), 'md')
    await user.selectOptions(screen.getByLabelText(/state/i), 'ca')
    await user.type(screen.getByLabelText(/first name/i), 'John')
    await user.type(screen.getByLabelText(/last name/i), 'Doe')

    const submitButton = screen.getByRole('button', { name: /verify license/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(mockOnSubmit).toHaveBeenCalledWith({
        licenseNumber: 'ABC123',
        licenseType: 'md',
        state: 'ca',
        firstName: 'John',
        lastName: 'Doe',
      })
    })
  })

  it('clears validation errors when user starts typing', async () => {
    const user = userEvent.setup()
    renderWithIntl(<LicenseVerificationForm onSubmit={mockOnSubmit} />)

    // Submit empty form to trigger validation errors
    const submitButton = screen.getByRole('button', { name: /verify license/i })
    await user.click(submitButton)

    await waitFor(() => {
      expect(screen.getByText('License number is required')).toBeInTheDocument()
    })

    // Start typing in license number field
    const licenseNumberInput = screen.getByLabelText(/license number/i)
    await user.type(licenseNumberInput, 'A')

    // Error should be cleared
    await waitFor(() => {
      expect(screen.queryByText('License number is required')).not.toBeInTheDocument()
    })
  })

  it('shows loading state when submitting', () => {
    renderWithIntl(<LicenseVerificationForm onSubmit={mockOnSubmit} isLoading={true} />)

    const submitButton = screen.getByRole('button', { name: /verifying/i })
    expect(submitButton).toBeDisabled()
    expect(screen.getByText('Verifying...')).toBeInTheDocument()
  })

  it('has proper accessibility attributes', () => {
    renderWithIntl(<LicenseVerificationForm onSubmit={mockOnSubmit} />)

    // Check for proper labeling
    expect(screen.getByLabelText(/license number/i)).toHaveAttribute('id', 'licenseNumber')
    
    // Check for proper form structure
    const form = screen.getByRole('form')
    expect(form).toHaveAttribute('noValidate')

    // Check for aria-describedby on submit button
    const submitButton = screen.getByRole('button', { name: /verify license/i })
    expect(submitButton).toHaveAttribute('aria-describedby', 'submit-help')
  })

  it('displays help text', () => {
    renderWithIntl(<LicenseVerificationForm onSubmit={mockOnSubmit} />)
    
    expect(screen.getByText('All fields are required for verification')).toBeInTheDocument()
  })
})