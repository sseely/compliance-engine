import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('License Verification Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load the license verification form', async ({ page }) => {
    await expect(page.getByRole('heading', { name: /license verification/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /license number/i })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /license type/i })).toBeVisible()
    await expect(page.getByRole('combobox', { name: /state/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /first name/i })).toBeVisible()
    await expect(page.getByRole('textbox', { name: /last name/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /verify license/i })).toBeVisible()
  })

  test('should show validation errors for empty form submission', async ({ page }) => {
    await page.getByRole('button', { name: /verify license/i }).click()
    
    await expect(page.getByText(/license number is required/i)).toBeVisible()
    await expect(page.getByText(/license type is required/i)).toBeVisible()
    await expect(page.getByText(/state is required/i)).toBeVisible()
    await expect(page.getByText(/first name is required/i)).toBeVisible()
    await expect(page.getByText(/last name is required/i)).toBeVisible()
  })

  test('should clear validation errors when user starts typing', async ({ page }) => {
    // Submit empty form to trigger validation
    await page.getByRole('button', { name: /verify license/i }).click()
    await expect(page.getByText(/license number is required/i)).toBeVisible()
    
    // Start typing in license number field
    await page.getByRole('textbox', { name: /license number/i }).fill('A')
    
    // Error should be cleared
    await expect(page.getByText(/license number is required/i)).not.toBeVisible()
  })

  test('should validate minimum length requirements', async ({ page }) => {
    await page.getByRole('textbox', { name: /license number/i }).fill('AB')
    await page.getByRole('textbox', { name: /first name/i }).fill('A')
    await page.getByRole('textbox', { name: /last name/i }).fill('B')
    await page.getByRole('button', { name: /verify license/i }).click()
    
    await expect(page.getByText(/license number must be at least 3 characters/i)).toBeVisible()
    await expect(page.getByText(/first name must be at least 2 characters/i)).toBeVisible()
    await expect(page.getByText(/last name must be at least 2 characters/i)).toBeVisible()
  })

  test('should fill out and submit form successfully', async ({ page }) => {
    // Fill out all required fields
    await page.getByRole('textbox', { name: /license number/i }).fill('ABC123456')
    await page.getByRole('combobox', { name: /license type/i }).selectOption('md')
    await page.getByRole('combobox', { name: /state/i }).selectOption('ca')
    await page.getByRole('textbox', { name: /first name/i }).fill('John')
    await page.getByRole('textbox', { name: /last name/i }).fill('Doe')
    
    // Submit the form
    await page.getByRole('button', { name: /verify license/i }).click()
    
    // Should show loading state
    await expect(page.getByRole('button', { name: /verifying/i })).toBeVisible()
    await expect(page.getByRole('button', { name: /verifying/i })).toBeDisabled()
  })

  test('should work on mobile viewport', async ({ page }) => {
    await page.setViewportSize({ width: 375, height: 667 }) // iPhone SE size
    
    await expect(page.getByRole('heading', { name: /license verification/i })).toBeVisible()
    
    // Form should be responsive and usable on mobile
    const form = page.locator('form')
    await expect(form).toBeVisible()
    
    // Touch targets should be large enough (minimum 44px)
    const submitButton = page.getByRole('button', { name: /verify license/i })
    const boundingBox = await submitButton.boundingBox()
    expect(boundingBox?.height).toBeGreaterThanOrEqual(44)
  })

  test('should support keyboard navigation', async ({ page }) => {
    // Tab through form elements
    await page.keyboard.press('Tab') // Skip link (hidden)
    await page.keyboard.press('Tab') // License number input
    await expect(page.getByRole('textbox', { name: /license number/i })).toBeFocused()
    
    await page.keyboard.press('Tab') // License type select
    await expect(page.getByRole('combobox', { name: /license type/i })).toBeFocused()
    
    await page.keyboard.press('Tab') // State select
    await expect(page.getByRole('combobox', { name: /state/i })).toBeFocused()
    
    await page.keyboard.press('Tab') // First name input
    await expect(page.getByRole('textbox', { name: /first name/i })).toBeFocused()
    
    await page.keyboard.press('Tab') // Last name input
    await expect(page.getByRole('textbox', { name: /last name/i })).toBeFocused()
    
    await page.keyboard.press('Tab') // Submit button
    await expect(page.getByRole('button', { name: /verify license/i })).toBeFocused()
  })

  test('should not have accessibility violations', async ({ page }) => {
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should not have accessibility violations with errors visible', async ({ page }) => {
    // Trigger validation errors
    await page.getByRole('button', { name: /verify license/i }).click()
    await expect(page.getByText(/license number is required/i)).toBeVisible()
    
    const accessibilityScanResults = await new AxeBuilder({ page }).analyze()
    expect(accessibilityScanResults.violations).toEqual([])
  })

  test('should work with screen reader simulation', async ({ page }) => {
    // Check for proper ARIA attributes
    const licenseNumberInput = page.getByRole('textbox', { name: /license number/i })
    await expect(licenseNumberInput).toHaveAttribute('aria-describedby')
    
    const submitButton = page.getByRole('button', { name: /verify license/i })
    await expect(submitButton).toHaveAttribute('aria-describedby', 'submit-help')
    
    // Check for proper labeling
    await expect(page.getByText('All fields are required for verification')).toHaveAttribute('id', 'submit-help')
  })

  test('should handle high contrast mode', async ({ page }) => {
    // Simulate high contrast mode preference
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })
    
    await expect(page.getByRole('heading', { name: /license verification/i })).toBeVisible()
    
    // Form should still be functional in high contrast mode
    await page.getByRole('textbox', { name: /license number/i }).fill('TEST123')
    await expect(page.getByRole('textbox', { name: /license number/i })).toHaveValue('TEST123')
  })

  test('should respect reduced motion preferences', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })
    
    // Page should load without motion-based animations
    await expect(page.getByRole('heading', { name: /license verification/i })).toBeVisible()
    
    // Check that reduced motion CSS is applied
    const styles = await page.evaluate(() => {
      const element = document.documentElement
      return window.getComputedStyle(element).getPropertyValue('--animation-duration')
    })
    
    // Should be minimal duration for reduced motion
    expect(styles).toBe('0.01ms')
  })
})