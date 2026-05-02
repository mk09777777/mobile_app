import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetUsersQuery } from '../../store/api';
import { setUsers, setLoading } from './usersSlice';

/**
 * Hook to fetch and cache users list
 * Automatically updates Redux store with users data
 */
export const useUsers = () => {
  const dispatch = useDispatch();
  const { data: usersData = [], isLoading, error } = useGetUsersQuery(undefined, {
    // Cache for 5 minutes
    refetchOnMountOrArgChange: false,
  });

  const cachedUsers = useSelector(state => state.users.users);
  const lastFetched = useSelector(state => state.users.lastFetched);

  useEffect(() => {
    if (usersData && usersData.length > 0) {
      dispatch(setUsers(usersData));
    }
    dispatch(setLoading(isLoading));
  }, [usersData, isLoading, dispatch]);

  return {
    users: cachedUsers.length > 0 ? cachedUsers : usersData,
    isLoading,
    error,
    lastFetched,
  };
};



