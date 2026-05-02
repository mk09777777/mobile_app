# Chandra Jewellery Management App

A comprehensive React Native application for jewelry business management with role-based access control and modern UI/UX design.

## 🎯 Features

### 🔐 Authentication & Roles
- **Multi-role login system** (Admin, Client, Coral Designer, CAD Designer)
- **Role-based navigation** and feature access
- **Persistent authentication** with AsyncStorage
- **Demo credentials** for easy testing

### 📱 Core Screens
- **Login Screen** - Simple ID/password authentication with demo credentials
- **Dashboard** - Role-specific dashboards with statistics and quick actions
- **Enquiry Management** - List, view, and manage jewellery enquiries
- **Chat System** - WhatsApp-like messaging interface
- **Admin Panel** - Metal prices and client management

### 🎨 UI/UX Features
- **Modern Material Design** with gold/brown color scheme
- **Card-based layouts** similar to Zomato/Groww style
- **Bottom tab navigation** with role-based tabs
- **Search and filtering** capabilities
- **Pull-to-refresh** functionality
- **Modal dialogs** for notifications and account management

## 🏗️ Project Structure

```
src/
├── components/
│   ├── common/          # Reusable UI components
│   │   ├── Button.js    # Custom button components
│   │   ├── Text.js      # Typography components
│   │   ├── Input.js     # Form input components
│   │   ├── Loader.js    # Loading indicators
│   │   └── TopNavbar.js # Top navigation bar
│   ├── cards/           # Card components
│   │   └── Cards.js     # Status cards, enquiry cards
│   └── modals/          # Modal components
│       ├── AccountModal.js      # User account modal
│       └── NotificationsModal.js # Notifications modal
├── navigation/          # Navigation setup
│   ├── BottomTabs.js    # Bottom tab navigator
│   ├── StackNavigator.js # Stack navigator
│   └── index.js         # Main navigation
├── screens/            # Screen components
│   ├── Auth/
│   │   └── LoginScreen.js
│   ├── Dashboard/
│   │   └── DashboardScreen.js
│   ├── Enquiries/
│   │   ├── EnquiryListScreen.js
│   │   └── SingleEnquiryScreen.js
│   ├── Chats/
│   │   ├── ChatsScreen.js
│   │   └── ChatDetailScreen.js
│   ├── Admin/
│   │   ├── MetalPricesScreen.js
│   │   └── ClientsListScreen.js
│   └── AddEnquiry/
│       ├── AddEnquiryStep1Screen.js
│       └── AddEnquiryStep2Screen.js
├── context/
│   └── AuthContext.js   # Authentication context
├── constants/
│   ├── colors.js        # Color palette
│   ├── fonts.js        # Typography
│   └── images.js       # Image assets
├── services/
│   └── api.js          # API service (dummy data)
└── utils/
    └── helpers.js      # Utility functions
```

## 🚀 Getting Started

### Prerequisites
- Node.js >= 20
- React Native development environment
- iOS Simulator or Android Emulator

### Installation

1. **Install dependencies:**
   ```bash
   npm install
   ```

2. **Install iOS dependencies (iOS only):**
   ```bash
   cd ios && pod install && cd ..
   ```

3. **Run the app:**
   ```bash
   # iOS
   npm run ios
   
   # Android
   npm run android
   ```

## 🔑 Demo Credentials

The app includes demo credentials for testing different roles:

| Role | Email | Password |
|------|-------|----------|
| Admin | admin@chandrajewels.com | admin123 |
| Client | john@example.com | client123 |
| Coral Designer | coral@chandrajewels.com | coral123 |
| CAD Designer | cad@chandrajewels.com | cad123 |

## 📱 Role-Based Features

### 👑 Admin
- **Dashboard**: Total enquiries, clients, revenue statistics
- **Metal Prices**: Manage gold, silver, platinum prices
- **Client Management**: View and manage all clients
- **Full Access**: All enquiry management features

### 👤 Client
- **Dashboard**: Personal enquiry statistics
- **Add Enquiries**: 2-step enquiry creation process
- **View Designs**: Coral and CAD design versions
- **Approve/Reject**: Design approval workflow
- **Chat**: Communicate with designers

### 🎨 Coral Designer
- **Dashboard**: Assigned enquiries and completion stats
- **Upload Designs**: Coral Excel/image uploads
- **Chat**: Client communication
- **Assigned Work**: View only assigned enquiries

### 💻 CAD Designer
- **Dashboard**: Assigned enquiries and completion stats
- **Upload Designs**: CAD Excel/image uploads
- **Chat**: Client communication
- **Assigned Work**: View only assigned enquiries

## 🎨 Design System

### Colors
- **Primary**: Gold (#D4AF37)
- **Secondary**: Brown (#8B4513)
- **Success**: Green (#10B981)
- **Error**: Red (#EF4444)
- **Warning**: Orange (#F59E0B)
- **Info**: Blue (#3B82F6)

### Typography
- **Headings**: Bold, various sizes (h1-h4)
- **Body**: Regular weight, readable sizes
- **Captions**: Smaller, secondary information
- **Labels**: Medium weight for form labels

## 🔧 Technical Implementation

### Navigation
- **React Navigation v6** with stack and tab navigators
- **Role-based navigation** with conditional screens
- **Deep linking** support for enquiry details

### State Management
- **React Context API** for authentication
- **Local state** with React hooks
- **AsyncStorage** for persistent authentication

### Data Management
- **Dummy API service** with realistic data
- **Simulated API calls** with loading states
- **Error handling** with user-friendly messages

### UI Components
- **Reusable components** with consistent styling
- **Custom hooks** for common functionality
- **Responsive design** for different screen sizes

## 📋 Key Features Implemented

### ✅ Authentication System
- [x] Multi-role login with demo credentials
- [x] Persistent authentication state
- [x] Role-based navigation flow
- [x] Secure logout functionality

### ✅ Dashboard Screens
- [x] Role-specific dashboard content
- [x] Statistics cards with real data
- [x] Quick action buttons
- [x] Recent activity feed

### ✅ Enquiry Management
- [x] Enquiry list with search and filters
- [x] Card-based layout (Zomato style)
- [x] Detailed enquiry view
- [x] Role-based actions (approve/reject/upload)
- [x] 2-step enquiry creation process

### ✅ Chat System
- [x] WhatsApp-like chat interface
- [x] Real-time message simulation
- [x] Chat list with unread indicators
- [x] Message timestamps and sender info

### ✅ Admin Features
- [x] Metal prices management
- [x] Client list with search
- [x] Statistics and analytics
- [x] Edit capabilities

### ✅ UI/UX Features
- [x] Modern Material Design
- [x] Bottom tab navigation
- [x] Top navbar with notifications
- [x] Modal dialogs for account/notifications
- [x] Pull-to-refresh functionality
- [x] Loading states and error handling

## 🔮 Future Enhancements

### Backend Integration
- Replace dummy API with real backend
- Implement real-time chat with WebSocket
- Add push notifications
- File upload for images/documents

### Advanced Features
- Push notifications
- Offline support
- Advanced search and filtering
- Export functionality (PDF generation)
- Analytics and reporting
- Multi-language support

### Performance
- Image optimization
- Lazy loading
- Caching strategies
- Performance monitoring

## 🐛 Known Issues

- Images use placeholder URLs (replace with actual assets)
- Some navigation flows may need refinement
- Error handling could be more comprehensive
- File upload is simulated (needs real implementation)

## 📄 License

This project is created for demonstration purposes. Please ensure you have proper licensing for any production use.

## 🤝 Contributing

1. Fork the repository
2. Create a feature branch
3. Commit your changes
4. Push to the branch
5. Create a Pull Request

## 📞 Support

For support or questions, please contact the development team.

---

**Built with ❤️ using React Native**

## 🔔 Push Notification Setup

1. **Install native configs**
   - Place your Firebase `google-services.json` under `android/app/`.
   - Place your `GoogleService-Info.plist` inside `ios/chandrajewellery/`.
2. **iOS pods**
   - Run `cd ios && pod install` after adding the plist.
3. **Android build**
   - Ensure `com.google.gms:google-services` plugin syncs by running `./gradlew clean` once.
4. **Environment**
   - The app now requests notification permission at runtime, registers the FCM token, and sends it to `/api/notifications/device-token`.
   - Confirm that backend endpoints exist to store/delete tokens for authenticated users.