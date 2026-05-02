import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import { fonts } from '../constants/fonts';
import CatalogShellScreen from '../screens/ClientApp/CatalogShellScreen';
import NotificationsScreen from '../screens/Notifications/NotificationsScreen';

const Stack = createStackNavigator();

/**
 * App2Navigator — navigator for the Catalog (client-facing) app.
 *
 * Auth is handled upstream in RootNavigator — by the time the user reaches
 * this navigator they are always authenticated. No login gating needed here.
 *
 * API calls → use src/services/catalogApi.js which auto-attaches the JWT.
 *
 * Adding new screens:
 *   1. Import the screen component above
 *   2. Add a <Stack.Screen> below
 *   3. Navigate with navigation.navigate('ScreenName')
 *
 * Available chandra_backend endpoints (see src/config/catalogApiConfig.js):
 *   GET  /categories                           → product categories
 *   GET  /categories/:id/subcategory-profiles  → subcategory listings
 *   GET  /banners                              → promotional banners
 *   GET  /auth/me                              → current client profile
 */
const App2Navigator = () => {
  return (
    <Stack.Navigator
      initialRouteName="CatalogMain"
      screenOptions={{
        headerStyle: { backgroundColor: '#0F2E30' },
        headerTintColor: '#C8A265',
        headerTitleStyle: {
          fontFamily: fonts.bold,
          fontSize: fonts.lg,
          color: '#C8A265',
        },
        headerBackButtonDisplayMode: 'minimal',
        cardStyle: { backgroundColor: '#0F2E30' },
      }}>
      <Stack.Screen
        name="CatalogMain"
        component={CatalogShellScreen}
        options={{ headerShown: false }}
      />
      <Stack.Screen
        name="Notifications"
        component={NotificationsScreen}
        options={{ headerShown: false }}
      />
      {/*
        Future screens — import and add here as the catalog app grows:

        <Stack.Screen
          name="Categories"
          component={CategoriesScreen}
          options={{ title: 'Collections' }}
        />
        <Stack.Screen
          name="Subcategories"
          component={SubcategoriesScreen}
          options={({ route }) => ({ title: route.params?.categoryName || 'Category' })}
        />
        <Stack.Screen
          name="ProductDetail"
          component={ProductDetailScreen}
          options={{ title: 'Product' }}
        />
      */}
    </Stack.Navigator>
  );
};

export default App2Navigator;
