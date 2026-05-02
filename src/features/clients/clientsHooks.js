import { useEffect } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetClientsQuery } from '../../store/api';
import { setClients, setClientsLoading } from './clientsSlice';

/**
 * Hook to fetch and cache clients list
 * Automatically updates Redux store with clients data
 * Returns cached clients if available, otherwise returns fresh data
 */
export const useClients = (options = {}) => {
  const dispatch = useDispatch();
  const { 
    data: clientsData = [], 
    isLoading, 
    error,
    refetch 
  } = useGetClientsQuery(undefined, {
    // Cache for 5 minutes
    refetchOnMountOrArgChange: false,
    ...options,
  });

  const cachedClients = useSelector(state => state.clients.clients);
  const lastFetched = useSelector(state => state.clients.lastFetched);

  useEffect(() => {
    if (clientsData && clientsData.length > 0) {
      dispatch(setClients(clientsData));
    }
    dispatch(setClientsLoading(isLoading));
  }, [clientsData, isLoading, dispatch]);

  return {
    clients: cachedClients.length > 0 ? cachedClients : clientsData,
    isLoading,
    error,
    lastFetched,
    refetch,
  };
};

/**
 * Hook to get a single client by ID or name
 * Uses cached clients map for quick lookup
 */
export const useClient = (idOrName) => {
  const clientsMap = useSelector(state => state.clients.clientsMap);
  const clients = useSelector(state => state.clients.clients);
  
  if (!idOrName) return null;
  
  // Try to find in map first (faster)
  const client = clientsMap[String(idOrName)] || 
                 clientsMap[idOrName.toLowerCase()] ||
                 // Fallback to array search
                 clients.find(c => 
                   c.id === idOrName || 
                   c._id === idOrName || 
                   c.name?.toLowerCase() === idOrName.toLowerCase()
                 );
  
  return client || null;
};

