/**
 * E2E tests for enquiry management flow
 */
describe('Enquiry Management Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should login and navigate to enquiries', async () => {
    // Login
    await element(by.placeholderText(/email/i)).typeText('admin@chandrajewels.com');
    await element(by.placeholderText(/password/i)).typeText('admin123');
    await element(by.text(/login/i)).tap();

    // Wait for dashboard
    await waitFor(element(by.text(/dashboard/i)))
      .toBeVisible()
      .withTimeout(10000);

    // Navigate to enquiries (tap on enquiries tab or card)
    const enquiriesTab = element(by.text(/enquiries/i));
    if (await enquiriesTab.exists()) {
      await enquiriesTab.tap();
    }

    // Should see enquiry list
    await waitFor(element(by.text(/enquiry|list/i)))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should search enquiries', async () => {
    // Login and navigate to enquiries
    await element(by.placeholderText(/email/i)).typeText('admin@chandrajewels.com');
    await element(by.placeholderText(/password/i)).typeText('admin123');
    await element(by.text(/login/i)).tap();

    await waitFor(element(by.text(/dashboard/i)))
      .toBeVisible()
      .withTimeout(10000);

    const enquiriesTab = element(by.text(/enquiries/i));
    if (await enquiriesTab.exists()) {
      await enquiriesTab.tap();
    }

    // Enter search query
    const searchInput = element(by.placeholderText(/search/i));
    await searchInput.typeText('test enquiry');

    // Results should update
    await waitFor(element(by.text(/test|enquiry/i)))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should filter enquiries by status', async () => {
    // Login and navigate to enquiries
    await element(by.placeholderText(/email/i)).typeText('admin@chandrajewels.com');
    await element(by.placeholderText(/password/i)).typeText('admin123');
    await element(by.text(/login/i)).tap();

    await waitFor(element(by.text(/dashboard/i)))
      .toBeVisible()
      .withTimeout(10000);

    const enquiriesTab = element(by.text(/enquiries/i));
    if (await enquiriesTab.exists()) {
      await enquiriesTab.tap();
    }

    // Tap on status filter
    const pendingFilter = element(by.text(/pending/i));
    if (await pendingFilter.exists()) {
      await pendingFilter.tap();
    }

    // Should see filtered results
    await waitFor(element(by.text(/pending/i)))
      .toBeVisible()
      .withTimeout(3000);
  });

  it('should open enquiry detail', async () => {
    // Login and navigate to enquiries
    await element(by.placeholderText(/email/i)).typeText('admin@chandrajewels.com');
    await element(by.placeholderText(/password/i)).typeText('admin123');
    await element(by.text(/login/i)).tap();

    await waitFor(element(by.text(/dashboard/i)))
      .toBeVisible()
      .withTimeout(10000);

    const enquiriesTab = element(by.text(/enquiries/i));
    if (await enquiriesTab.exists()) {
      await enquiriesTab.tap();
    }

    // Tap on first enquiry card
    const firstEnquiry = element(by.text(/ENQ/i)).atIndex(0);
    if (await firstEnquiry.exists()) {
      await firstEnquiry.tap();
    }

    // Should see enquiry detail screen
    await waitFor(element(by.text(/detail|information/i)))
      .toBeVisible()
      .withTimeout(5000);
  });
});

