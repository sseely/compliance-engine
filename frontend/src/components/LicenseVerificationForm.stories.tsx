import type { Meta, StoryObj } from '@storybook/react'
import { NextIntlClientProvider } from 'next-intl'
import LicenseVerificationForm from './LicenseVerificationForm'
import { VALIDATION_RULES } from '@/constants'

// Simple action function to replace @storybook/addon-actions temporarily
const action = (name: string) => (...args: any[]) => {
  console.log(`Action: ${name}`, ...args)
}

// Mock the accessibility hooks for Storybook
const mockUseAriaAnnouncements = () => ({
  announceFormError: action('announceFormError'),
  announceLoadingState: action('announceLoadingState'),
})

// Mock the i18n utils for Storybook
const mockUseLicenseTypeOptions = () => [
  { value: '', label: 'Select license type' },
  { value: 'md', label: 'Medical Doctor (MD)' },
  { value: 'do', label: 'Doctor of Osteopathic Medicine (DO)' },
  { value: 'rn', label: 'Registered Nurse (RN)' },
  { value: 'lpn', label: 'Licensed Practical Nurse (LPN)' },
  { value: 'pa', label: 'Physician Assistant (PA)' },
  { value: 'np', label: 'Nurse Practitioner (NP)' },
  { value: 'pt', label: 'Physical Therapist (PT)' },
  { value: 'ot', label: 'Occupational Therapist (OT)' },
  { value: 'pharmacist', label: 'Pharmacist' },
  { value: 'dentist', label: 'Dentist (DDS/DMD)' },
]

const mockUseStateOptions = () => [
  { value: '', label: 'Select state' },
  { value: 'al', label: 'Alabama' },
  { value: 'ak', label: 'Alaska' },
  { value: 'az', label: 'Arizona' },
  { value: 'ar', label: 'Arkansas' },
  { value: 'ca', label: 'California' },
  { value: 'co', label: 'Colorado' },
  { value: 'ct', label: 'Connecticut' },
  { value: 'de', label: 'Delaware' },
  { value: 'fl', label: 'Florida' },
  { value: 'ga', label: 'Georgia' },
  { value: 'hi', label: 'Hawaii' },
  { value: 'id', label: 'Idaho' },
  { value: 'il', label: 'Illinois' },
  { value: 'in', label: 'Indiana' },
  { value: 'ia', label: 'Iowa' },
  { value: 'ks', label: 'Kansas' },
  { value: 'ky', label: 'Kentucky' },
  { value: 'la', label: 'Louisiana' },
  { value: 'me', label: 'Maine' },
  { value: 'md', label: 'Maryland' },
  { value: 'ma', label: 'Massachusetts' },
  { value: 'mi', label: 'Michigan' },
  { value: 'mn', label: 'Minnesota' },
  { value: 'ms', label: 'Mississippi' },
  { value: 'mo', label: 'Missouri' },
  { value: 'mt', label: 'Montana' },
  { value: 'ne', label: 'Nebraska' },
  { value: 'nv', label: 'Nevada' },
  { value: 'nh', label: 'New Hampshire' },
  { value: 'nj', label: 'New Jersey' },
  { value: 'nm', label: 'New Mexico' },
  { value: 'ny', label: 'New York' },
  { value: 'nc', label: 'North Carolina' },
  { value: 'nd', label: 'North Dakota' },
  { value: 'oh', label: 'Ohio' },
  { value: 'ok', label: 'Oklahoma' },
  { value: 'or', label: 'Oregon' },
  { value: 'pa', label: 'Pennsylvania' },
  { value: 'ri', label: 'Rhode Island' },
  { value: 'sc', label: 'South Carolina' },
  { value: 'sd', label: 'South Dakota' },
  { value: 'tn', label: 'Tennessee' },
  { value: 'tx', label: 'Texas' },
  { value: 'ut', label: 'Utah' },
  { value: 'vt', label: 'Vermont' },
  { value: 'va', label: 'Virginia' },
  { value: 'wa', label: 'Washington' },
  { value: 'wv', label: 'West Virginia' },
  { value: 'wi', label: 'Wisconsin' },
  { value: 'wy', label: 'Wyoming' },
]

// Mock the modules
jest.mock('@/hooks/useAccessibility', () => ({
  useAriaAnnouncements: mockUseAriaAnnouncements,
}))

jest.mock('@/utils/i18n', () => ({
  useLicenseTypeOptions: mockUseLicenseTypeOptions,
  useStateOptions: mockUseStateOptions,
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

const meta: Meta<typeof LicenseVerificationForm> = {
  title: 'Components/LicenseVerificationForm',
  component: LicenseVerificationForm,
  parameters: {
    layout: 'centered',
    docs: {
      description: {
        component: 'A form component for verifying professional licenses. Includes validation, loading states, and accessibility features.',
      },
    },
  },
  decorators: [
    (Story) => (
      <NextIntlClientProvider messages={mockMessages} locale="en">
        <div style={{ width: '800px', maxWidth: '100vw' }}>
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
  argTypes: {
    onSubmit: {
      action: 'submitted',
      description: 'Callback function called when form is submitted with valid data',
    },
    isLoading: {
      control: 'boolean',
      description: 'Whether the form is in a loading state',
    },
  },
  tags: ['autodocs'],
}

export default meta
type Story = StoryObj<typeof meta>

// Default story
export const Default: Story = {
  args: {
    onSubmit: action('onSubmit'),
    isLoading: false,
  },
}

// Loading state
export const Loading: Story = {
  args: {
    onSubmit: action('onSubmit'),
    isLoading: true,
  },
  parameters: {
    docs: {
      description: {
        story: 'Form in loading state with disabled inputs and loading button text',
      },
    },
  },
}

// With validation errors (simulated)
export const WithValidationErrors: Story = {
  args: {
    onSubmit: action('onSubmit'),
    isLoading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Form showing validation errors when submitted with empty fields',
      },
    },
  },
  play: async ({ canvasElement }) => {
    // Auto-trigger validation errors for demonstration
    const canvas = canvasElement
    const submitButton = canvas.querySelector('button[type="submit"]') as HTMLButtonElement
    if (submitButton) {
      submitButton.click()
    }
  },
}

// Filled form
export const FilledForm: Story = {
  args: {
    onSubmit: action('onSubmit'),
    isLoading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Form pre-filled with sample data',
      },
    },
  },
  play: async ({ canvasElement }) => {
    const canvas = canvasElement
    
    // Fill out the form with sample data
    const licenseNumberInput = canvas.querySelector('input[id="licenseNumber"]') as HTMLInputElement
    const licenseTypeSelect = canvas.querySelector('select[id="licenseType"]') as HTMLSelectElement
    const stateSelect = canvas.querySelector('select[id="state"]') as HTMLSelectElement
    const firstNameInput = canvas.querySelector('input[id="firstName"]') as HTMLInputElement
    const lastNameInput = canvas.querySelector('input[id="lastName"]') as HTMLInputElement
    
    if (licenseNumberInput) licenseNumberInput.value = 'MD123456789'
    if (licenseTypeSelect) licenseTypeSelect.value = 'md'
    if (stateSelect) stateSelect.value = 'ca'
    if (firstNameInput) firstNameInput.value = 'John'
    if (lastNameInput) lastNameInput.value = 'Doe'
    
    // Trigger change events
    const changeEvent = new Event('change', { bubbles: true })
    licenseNumberInput?.dispatchEvent(changeEvent)
    licenseTypeSelect?.dispatchEvent(changeEvent)
    stateSelect?.dispatchEvent(changeEvent)
    firstNameInput?.dispatchEvent(changeEvent)
    lastNameInput?.dispatchEvent(changeEvent)
  },
}

// Mobile viewport
export const Mobile: Story = {
  args: {
    onSubmit: action('onSubmit'),
    isLoading: false,
  },
  parameters: {
    viewport: {
      defaultViewport: 'mobile1',
    },
    docs: {
      description: {
        story: 'Form rendered on a mobile viewport to test responsive design',
      },
    },
  },
}

// Dark mode simulation
export const DarkMode: Story = {
  args: {
    onSubmit: action('onSubmit'),
    isLoading: false,
  },
  parameters: {
    backgrounds: {
      default: 'dark',
      values: [
        { name: 'dark', value: '#1e293b' },
      ],
    },
    docs: {
      description: {
        story: 'Form with dark background to simulate dark mode',
      },
    },
  },
}

// High contrast mode simulation
export const HighContrast: Story = {
  args: {
    onSubmit: action('onSubmit'),
    isLoading: false,
  },
  parameters: {
    docs: {
      description: {
        story: 'Form simulating high contrast mode preferences',
      },
    },
  },
  decorators: [
    (Story) => (
      <NextIntlClientProvider messages={mockMessages} locale="en">
        <div style={{ width: '800px', maxWidth: '100vw' }} className="high-contrast">
          <Story />
        </div>
      </NextIntlClientProvider>
    ),
  ],
}