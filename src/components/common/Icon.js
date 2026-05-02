import React from 'react';
import MaterialIcons from 'react-native-vector-icons/MaterialIcons';
import { icons } from '../../constants/images';

const Icon = ({ name, size = 24, color = '#000', ...props }) => {
  // Get the icon name from our icons constant, fallback to the provided name
  const iconName = icons[name] || name;
  
  return (
    <MaterialIcons 
      name={iconName} 
      size={size} 
      color={color} 
      {...props} 
    />
  );
};

export default Icon;

