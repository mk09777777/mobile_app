import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { createStackNavigator } from '@react-navigation/stack';
import CustomTabBar from '../components/common/CustomTabBar';
import { CartProvider } from '../context/CartContext';
import HomeScreen from '../screens/ClientApp/HomeScreen';
import FeaturedCollectionScreen from '../screens/ClientApp/FeaturedCollectionScreen';
import CategoryDetailsScreen from '../screens/ClientApp/CategoryDetailsScreen';
import ProductListScreen from '../screens/ClientApp/ProductListScreen';
import ProductMatrixScreen from '../screens/ClientApp/ProductMatrixScreen';
import RingMatrixPage from '../screens/ClientApp/RingMatrixPage';
import JacketsScreen from '../screens/ClientApp/JacketsScreen';
import OrderReviewScreen from '../screens/ClientApp/OrderReviewScreen';
import BulkOrderParserScreen from '../screens/ClientApp/BulkOrderParserScreen';
import OrderCartScreen from '../screens/ClientApp/OrderCartScreen';
import OrderPlacedScreen from '../screens/ClientApp/OrderPlacedScreen';
import MyOrdersScreen from '../screens/ClientApp/MyOrdersScreen';
import MyOrderDetailsScreen from '../screens/ClientApp/MyOrderDetailsScreen';
import MyShipmentTrackingScreen from '../screens/ClientApp/MyShipmentTrackingScreen';
import CatalogChatsScreen from '../screens/ClientApp/CatalogChatsScreen';

const Tab = createBottomTabNavigator();
const DashboardStack = createStackNavigator();
const CartStack = createStackNavigator();
const OrdersStack = createStackNavigator();

const DashboardStackScreen = () => (
  <DashboardStack.Navigator
    screenOptions={{
      headerShown: false,
    }}>
    <DashboardStack.Screen name="HomeScreen" component={HomeScreen} />
    <DashboardStack.Screen name="FeaturedCollection" component={FeaturedCollectionScreen} />
    <DashboardStack.Screen name="CategoryDetails" component={CategoryDetailsScreen} />
    <DashboardStack.Screen name="ProductList" component={ProductListScreen} />
    <DashboardStack.Screen name="ProductMatrix" component={ProductMatrixScreen} />
    <DashboardStack.Screen name="RingMatrixPage" component={RingMatrixPage} />
    <DashboardStack.Screen name="JacketsScreen" component={JacketsScreen} />
    <DashboardStack.Screen name="BulkOrderParser" component={BulkOrderParserScreen} />
    <DashboardStack.Screen name="OrderReview" component={OrderReviewScreen} />
  </DashboardStack.Navigator>
);

const CartStackScreen = () => (
  <CartStack.Navigator
    screenOptions={{
      headerShown: false,
    }}>
    <CartStack.Screen name="OrderCart" component={OrderCartScreen} />
    <CartStack.Screen name="OrderPlaced" component={OrderPlacedScreen} />
  </CartStack.Navigator>
);

const OrdersStackScreen = () => (
  <OrdersStack.Navigator
    screenOptions={{
      headerShown: false,
    }}>
    <OrdersStack.Screen name="MyOrdersList" component={MyOrdersScreen} />
    <OrdersStack.Screen name="MyOrderDetails" component={MyOrderDetailsScreen} />
    <OrdersStack.Screen name="MyShipmentTracking" component={MyShipmentTrackingScreen} />
  </OrdersStack.Navigator>
);

const CatalogBottomTabs = () => {
  return (
    <CartProvider>
      <Tab.Navigator
        tabBar={(props) => <CustomTabBar {...props} />}
        screenOptions={{
          headerShown: false,
        }}
      >
        <Tab.Screen
          name="Dashboard"
          component={DashboardStackScreen}
          options={{ title: 'Dashboard' }}
        />
        <Tab.Screen
          name="Cart"
          component={CartStackScreen}
          options={{ title: 'Cart' }}
        />
        <Tab.Screen
          name="MyOrders"
          component={OrdersStackScreen}
          options={{ title: 'My Orders' }}
        />
        <Tab.Screen
          name="Chats"
          component={CatalogChatsScreen}
          options={{ title: 'Chats' }}
        />
      </Tab.Navigator>
    </CartProvider>
  );
};

export default CatalogBottomTabs;
