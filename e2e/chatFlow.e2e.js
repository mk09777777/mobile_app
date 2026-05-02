/**
 * E2E tests for chat flow
 */
describe('Chat Flow', () => {
  beforeAll(async () => {
    await device.launchApp();
  });

  beforeEach(async () => {
    await device.reloadReactNative();
  });

  it('should login and navigate to chats', async () => {
    // Login
    await element(by.placeholderText(/email/i)).typeText('admin@chandrajewels.com');
    await element(by.placeholderText(/password/i)).typeText('admin123');
    await element(by.text(/login/i)).tap();

    // Wait for dashboard
    await waitFor(element(by.text(/dashboard/i)))
      .toBeVisible()
      .withTimeout(10000);

    // Navigate to chats
    const chatsTab = element(by.text(/chat|message/i));
    if (await chatsTab.exists()) {
      await chatsTab.tap();
    }

    // Should see chat list
    await waitFor(element(by.text(/chat|conversation/i)))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should open chat conversation', async () => {
    // Login and navigate to chats
    await element(by.placeholderText(/email/i)).typeText('admin@chandrajewels.com');
    await element(by.placeholderText(/password/i)).typeText('admin123');
    await element(by.text(/login/i)).tap();

    await waitFor(element(by.text(/dashboard/i)))
      .toBeVisible()
      .withTimeout(10000);

    const chatsTab = element(by.text(/chat|message/i));
    if (await chatsTab.exists()) {
      await chatsTab.tap();
    }

    // Tap on first chat
    const firstChat = element(by.text(/ENQ|chat/i)).atIndex(0);
    if (await firstChat.exists()) {
      await firstChat.tap();
    }

    // Should see chat detail screen
    await waitFor(element(by.text(/message|send/i)))
      .toBeVisible()
      .withTimeout(5000);
  });

  it('should send a message', async () => {
    // Login, navigate to chats, and open conversation
    await element(by.placeholderText(/email/i)).typeText('admin@chandrajewels.com');
    await element(by.placeholderText(/password/i)).typeText('admin123');
    await element(by.text(/login/i)).tap();

    await waitFor(element(by.text(/dashboard/i)))
      .toBeVisible()
      .withTimeout(10000);

    const chatsTab = element(by.text(/chat|message/i));
    if (await chatsTab.exists()) {
      await chatsTab.tap();
    }

    const firstChat = element(by.text(/ENQ|chat/i)).atIndex(0);
    if (await firstChat.exists()) {
      await firstChat.tap();
    }

    // Type and send message
    const messageInput = element(by.placeholderText(/type|message/i));
    if (await messageInput.exists()) {
      await messageInput.typeText('Test message');
      
      const sendButton = element(by.text(/send/i));
      if (await sendButton.exists()) {
        await sendButton.tap();
      }
    }

    // Message should appear in chat
    await waitFor(element(by.text('Test message')))
      .toBeVisible()
      .withTimeout(3000);
  });
});

