/**
 * E2E tests for authentication flow
 */
describe('Authentication Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should display login screen on app launch', async () => {
    // Wait for splash screen to finish
    await waitFor(element(by.text(/login|sign in/i)))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should show validation errors for invalid input', async () => {
    // Try to submit empty form
    const loginButton = element(by.text(/login/i));
    await loginButton.tap();

    // Should show validation errors
    await expect(element(by.text(/required|invalid/i))).toBeVisible();
  });

  it('should login successfully with valid credentials', async () => {
    // Enter email
    const emailInput = element(by.placeholderText(/email/i));
    await emailInput.typeText('admin@chandrajewels.com');

    // Enter password
    const passwordInput = element(by.placeholderText(/password/i));
    await passwordInput.typeText('admin123');

    // Submit login
    const loginButton = element(by.text(/login/i));
    await loginButton.tap();

    // Should navigate to dashboard
    await waitFor(element(by.text(/dashboard/i)))
      .toBeVisible()
      .withTimeout(10000);
  });

  it('should show error for invalid credentials', async () => {
    await device.reloadReactNative();

    // Enter invalid credentials
    const emailInput = element(by.placeholderText(/email/i));
    await emailInput.typeText('wrong@example.com');

    const passwordInput = element(by.placeholderText(/password/i));
    await passwordInput.typeText('wrongpassword');

    const loginButton = element(by.text(/login/i));
    await loginButton.tap();

    // Should show error message
    await waitFor(element(by.text(/invalid|error|incorrect/i)))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should persist login state after app restart', async () => {
    // Login first
    const emailInput = element(by.placeholderText(/email/i));
    await emailInput.typeText('admin@chandrajewels.com');

    const passwordInput = element(by.placeholderText(/password/i));
    await passwordInput.typeText('admin123');

    const loginButton = element(by.text(/login/i));
    await loginButton.tap();

    await waitFor(element(by.text(/dashboard/i)))
      .toBeVisible()
      .withTimeout(10000);

    // Reload app
    await device.reloadReactNative();

    // Should still be logged in (dashboard visible)
    await waitFor(element(by.text(/dashboard/i)))
      .toBeVisible()
      .withTimeout(5000);
  });
});

