import { useEffect } from 'react';
import { useUsers } from '../../features/users/usersHooks';

/**
 * Provider component to initialize and cache users list
 * Should be mounted early in the app lifecycle
 */
const UsersProvider = ({ children }) => {
  // Fetch and cache users when component mounts
  useUsers();

  return children;
};

export default UsersProvider;



