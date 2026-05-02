# Notification Navigation - Complete Summary

## ✅ All Supported Notification Types

### 1. **Enquiry Notifications** ✅
**Types Supported:**
- `enquiry`
- `enquiry_update`
- `enquiry_created`
- `assigned`
- `assigned_to`
- `assignedto`
- `assignment`

**Navigation:**
- Navigates to: `SingleEnquiry` screen
- Required: `enquiryId` (in data or link)
- Link format: `enquiries/{enquiryId}`

**Example:**
```json
{
  "type": "enquiry_created",
  "enquiryId": "123",
  "link": "enquiries/123"
}
```

---

### 2. **Chat Notifications** ✅
**Types Supported:**
- `chat`
- `message`
- `chat_message`

**Navigation:**
- If `chatId` provided: Navigates to `ChatDetail` screen
- If no `chatId`: Navigates to `MainTabs` → `Chats` tab
- Link format: `chats/{chatId}` or `chat/{chatId}`

**Example:**
```json
{
  "type": "chat",
  "chatId": "456",
  "enquiryId": "123",
  "link": "chats/456"
}
```

---

### 3. **Design Notifications** ✅
**Types Supported:**
- `design`
- `design_uploaded`
- `design_updated`

**Navigation:**
- Navigates to: `DesignViewer` screen
- Required: `enquiryId` and `designType` (defaults to 'cad')
- Optional: `versionIndex`
- Link format: `designs/{enquiryId}` or `design/{enquiryId}`

**Example:**
```json
{
  "type": "design_uploaded",
  "enquiryId": "123",
  "designType": "coral",
  "versionIndex": 1,
  "link": "designs/123"
}
```

---

### 4. **Pricing Notifications** ✅
**Types Supported:**
- `pricing`
- `pricing_update`

**Navigation:**
- Navigates to: `Pricing` screen
- Required: `enquiryId` and `designType` (defaults to 'cad')
- Link format: `pricing/{enquiryId}`

**Example:**
```json
{
  "type": "pricing_update",
  "enquiryId": "123",
  "designType": "coral",
  "link": "pricing/123"
}
```

---

### 5. **Client Notifications** ✅
**Types Supported:**
- `client`
- `client_created`
- `client_updated`

**Navigation:**
- If `clientId` provided: Navigates to `ClientPricing` screen
- If no `clientId`: Navigates to `ClientsList` screen
- Link format: `clients/{clientId}` or `clients`

**Example:**
```json
{
  "type": "client_created",
  "clientId": "789",
  "clientName": "John Doe",
  "link": "clients/789"
}
```

---

### 6. **Metal Price Notifications** ✅
**Types Supported:**
- `metal_price`
- `metal_price_update`

**Navigation:**
- Navigates to: `MetalPrices` screen
- Link format: `metal-prices`

**Example:**
```json
{
  "type": "metal_price_update",
  "link": "metal-prices"
}
```

---

## 🔗 Link-Based Navigation (Priority 1)

The system first checks for a `link` field in the notification data. If found, it parses the link and navigates accordingly.

### Supported Link Patterns:

1. **`notifications`** → `Notifications` screen
2. **`enquiries/{id}`** → `SingleEnquiry` screen
3. **`enquiries`** → `MainTabs` → `Enquiries` tab
4. **`chats/{id}`** or **`chat/{id}`** → `ChatDetail` screen
5. **`chat-groups`** → `ChatGroups` screen
6. **`designs/{id}`** or **`design/{id}`** → `DesignViewer` screen
7. **`pricing/{id}`** → `Pricing` screen
8. **`upload-design`** → `UploadDesign` screen
9. **`metal-prices`** → `MetalPrices` screen
10. **`clients/{id}`** → `ClientPricing` screen
11. **`clients`** → `ClientsList` screen
12. **`create-client`** → `CreateClient` screen
13. **`dashboard`** → `MainTabs` → `Dashboard` tab

---

## 📋 Type-Based Navigation (Priority 2)

If no `link` is provided, the system uses the `type` field to determine navigation.

---

## 🔄 Fallback Behavior

1. **If `enquiryId` found but no link/type:** Navigates to `SingleEnquiry` screen
2. **If no link, type, or enquiryId:** Navigates to `Notifications` screen
3. **On error:** Navigates to `Notifications` screen

---

## 🎯 Data Field Extraction

The system intelligently extracts IDs from various field name formats:

### EnquiryId Extraction:
- `enquiryId`, `EnquiryId`, `id`, `Id`
- `enquiry_id`, `enquiryID`, `EnquiryID`
- `enquiry.id`, `enquiry.Id`, `Enquiry.id`, `Enquiry.Id`

### ChatId Extraction:
- `chatId`, `ChatId`

### ClientId Extraction:
- `clientId`, `ClientId`

---

## ✅ Status Summary

| Notification Type | Navigation Target | Status |
|------------------|-------------------|--------|
| Enquiry Created | SingleEnquiry | ✅ Working |
| Enquiry Updated | SingleEnquiry | ✅ Working |
| Assigned To | SingleEnquiry | ✅ Working |
| Chat Message | ChatDetail / Chats Tab | ✅ Working |
| Design Uploaded | DesignViewer | ✅ Working |
| Design Updated | DesignViewer | ✅ Working |
| Pricing Update | Pricing | ✅ Working |
| Client Created | ClientPricing / ClientsList | ✅ Working |
| Client Updated | ClientPricing / ClientsList | ✅ Working |
| Metal Price Update | MetalPrices | ✅ Working |

---

## 🐛 Known Issues & Fixes

### Issue: App Killed State Navigation
**Problem:** When app is killed and notification is tapped, navigation doesn't work.

**Fix Applied:**
- ✅ Added retry mechanism (up to 20 retries, 10 seconds total)
- ✅ Store pending notifications until navigation is ready
- ✅ Wait for both authentication AND navigation to be ready
- ✅ Check both FCM and Notifee initial notifications
- ✅ Increased delay to 2 seconds for full initialization

### Issue: Missing EnquiryId
**Problem:** Some notifications don't have enquiryId in expected format.

**Fix Applied:**
- ✅ Enhanced ID extraction from multiple field name variations
- ✅ Fallback navigation if enquiryId found but no link/type

---

## 📝 Testing Checklist

- [x] Enquiry created notification → Navigates to enquiry
- [x] Enquiry updated notification → Navigates to enquiry
- [x] Assigned to notification → Navigates to enquiry
- [x] Chat message notification → Navigates to chat
- [x] Design uploaded notification → Navigates to design viewer
- [x] Pricing update notification → Navigates to pricing
- [x] Client created notification → Navigates to client
- [x] Metal price update → Navigates to metal prices
- [x] App killed state → Navigation works after app opens
- [x] App background state → Navigation works immediately
- [x] App foreground state → Navigation works immediately

---

## 🔍 Debugging

All navigation attempts are logged with:
- Full notification data
- Extracted link, type, and IDs
- Navigation target
- Success/failure status

Check console logs for:
- `[Notification Navigation]` - Navigation flow
- `[PushNotification]` - Notification detection
- `[Navigation]` - Navigation container state

