import React from 'react';
import { createStackNavigator } from '@react-navigation/stack';
import LoginScreen from '../screens/Auth/LoginScreen';
import AppSelectionScreen from '../screens/AppSelection/AppSelectionScreen';
import StackNavigator from './StackNavigator';
import App2Navigator from './App2Navigator';
import ProductionNavigator from './ProductionNavigator';
import { useAuth } from '../context/AuthContext';

const Root = createStackNavigator();

const RootNavigator = ({ isAuthenticated }) => {
  const { user } = useAuth();
  const isDesignRole = user?.role === 'coral' || user?.role === 'cad';

  return (
    <Root.Navigator screenOptions={{ headerShown: false }}>
      {!isAuthenticated ? (
        <Root.Screen name="Login" component={LoginScreen} />
      ) : isDesignRole ? (
        // coral/cad users go straight to CustomApp — no app selection
        <Root.Screen name="CustomApp">
          {() => <StackNavigator isAuthenticated={isAuthenticated} />}
        </Root.Screen>
      ) : (
        <>
          <Root.Screen name="AppSelection" component={AppSelectionScreen} />

          <Root.Screen name="CustomApp">
            {() => <StackNavigator isAuthenticated={isAuthenticated} />}
          </Root.Screen>

          <Root.Screen name="CatalogApp" component={App2Navigator} />

          {/* Production Intelligence Platform */}
          <Root.Screen name="ProductionApp" component={ProductionNavigator} />
        </>
      )}
    </Root.Navigator>
  );
};

export default RootNavigator;
