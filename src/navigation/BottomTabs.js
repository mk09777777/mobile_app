import React from 'react';
import { createBottomTabNavigator } from '@react-navigation/bottom-tabs';
import { Text, View } from 'react-native';
import { colors } from '../constants/colors';
import { fonts } from '../constants/fonts';
import Icon from '../components/common/Icon';
import CustomTabBar from '../components/common/CustomTabBar';

// Import screens
import DashboardScreen from '../screens/Dashboard/DashboardScreen';
import EnquiryListScreen from '../screens/Enquiries/EnquiryListScreen';
import ChatsScreen from '../screens/Chats/ChatsScreen';

const Tab = createBottomTabNavigator();

const BottomTabs = () => {
  return (
    <Tab.Navigator
      tabBar={(props) => <CustomTabBar {...props} />}
      screenOptions={{
        headerShown: false,
      }}>
      <Tab.Screen
        name="Dashboard"
        component={DashboardScreen}
        options={{
          title: 'Dashboard',
        }}
      />
      <Tab.Screen
        name="Enquiries"
        component={EnquiryListScreen}
        options={{
          title: 'Enquiries',
        }}
      />
      <Tab.Screen
        name="Chats"
        component={ChatsScreen}
        options={{
          title: 'Chats',
        }}
      />
    </Tab.Navigator>
  );
};

export default BottomTabs;
