import { test, expect } from '@playwright/test'
import AxeBuilder from '@axe-core/playwright'

test.describe('License Verification Form', () => {
  test.beforeEach(async ({ page }) => {
    await page.goto('/')
  })

  test('should load the license verification form', async ({ page }) => {
    // Page has h1 "Professional License Verification" and h2 "License Verification"
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()
    await expect(page.getByRole('heading', { level: 2, name: /license verification/i })).toBeVisible()
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
    // Fill out all required fields (using actual option values)
    await page.getByRole('textbox', { name: /license number/i }).fill('ABC123456')
    await page.getByRole('combobox', { name: /license type/i }).selectOption('medical')
    await page.getByRole('combobox', { name: /state/i }).selectOption('CA')
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

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Form should be responsive and usable on mobile
    const form = page.locator('form')
    await expect(form).toBeVisible()

    // Touch targets should be large enough (minimum 44px)
    const submitButton = page.getByRole('button', { name: /verify license/i })
    const boundingBox = await submitButton.boundingBox()
    expect(boundingBox?.height).toBeGreaterThanOrEqual(44)
  })

  test('should support keyboard navigation to form elements', async ({ page }) => {
    // Focus on the first form input directly
    const licenseInput = page.getByRole('textbox', { name: /license number/i })
    await licenseInput.focus()
    await expect(licenseInput).toBeFocused()

    // Tab to next element
    await page.keyboard.press('Tab')
    await expect(page.getByRole('combobox', { name: /license type/i })).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('combobox', { name: /state/i })).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('textbox', { name: /first name/i })).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('textbox', { name: /last name/i })).toBeFocused()

    await page.keyboard.press('Tab')
    await expect(page.getByRole('button', { name: /verify license/i })).toBeFocused()
  })

  test('should have proper ARIA attributes for accessibility', async ({ page }) => {
    // Submit form to trigger validation and show aria-describedby attributes
    await page.getByRole('button', { name: /verify license/i }).click()
    await expect(page.getByText(/license number is required/i)).toBeVisible()

    // Check that error messages have proper role="alert"
    const errorMessages = page.locator('[role="alert"]')
    await expect(errorMessages.first()).toBeVisible()

    // Check submit button has aria-describedby
    const submitButton = page.getByRole('button', { name: /verify license/i })
    await expect(submitButton).toHaveAttribute('aria-describedby', 'submit-help')

    // Check form has accessible name
    const form = page.locator('form[aria-label]')
    await expect(form).toHaveAttribute('aria-label', 'License verification form')
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

  test('should handle high contrast mode', async ({ page }) => {
    // Simulate high contrast mode preference
    await page.emulateMedia({ colorScheme: 'dark', reducedMotion: 'reduce' })

    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Form should still be functional in high contrast mode
    await page.getByRole('textbox', { name: /license number/i }).fill('TEST123')
    await expect(page.getByRole('textbox', { name: /license number/i })).toHaveValue('TEST123')
  })

  test('should apply reduced motion styles when preference is set', async ({ page }) => {
    await page.emulateMedia({ reducedMotion: 'reduce' })

    // Page should load and be functional
    await expect(page.getByRole('heading', { level: 1 })).toBeVisible()

    // Verify the form is usable
    await page.getByRole('textbox', { name: /license number/i }).fill('TEST123')
    await expect(page.getByRole('textbox', { name: /license number/i })).toHaveValue('TEST123')
  })
})
