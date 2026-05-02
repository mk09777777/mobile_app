import { useEffect, useMemo } from 'react';
import { useDispatch, useSelector } from 'react-redux';
import { useGetStatusesQuery } from '../../store/api';
import { setStatuses, setStatusesLoading } from './statusesSlice';
import { useAuth } from '../../context/AuthContext';

/**
 * Hook to fetch and cache statuses list
 * Automatically updates Redux store with statuses data
 * Returns cached statuses if available, otherwise returns fresh data
 */
export const useStatuses = (options = {}) => {
  const dispatch = useDispatch();
  const { 
    data: statusesData = [], 
    isLoading, 
    error,
    refetch 
  } = useGetStatusesQuery(undefined, {
    // Cache for 5 minutes
    refetchOnMountOrArgChange: false,
    ...options,
  });

  const cachedStatuses = useSelector(state => state.statuses.statuses);
  const lastFetched = useSelector(state => state.statuses.lastFetched);

  useEffect(() => {
    if (statusesData && statusesData.length > 0) {
      dispatch(setStatuses(statusesData));
    }
    dispatch(setStatusesLoading(isLoading));
  }, [statusesData, isLoading, dispatch]);

  return {
    statuses: cachedStatuses.length > 0 ? cachedStatuses : statusesData,
    isLoading,
    error,
    lastFetched,
    refetch,
  };
};

/**
 * Hook to get status options for dropdowns
 * Filters statuses based on user role (designers see limited options)
 * Returns array of { label, value } objects
 */
export const useStatusOptions = () => {
  const { user } = useAuth();
  const { statuses } = useStatuses();
  
  const isDesigner = user?.role === 'coral' || user?.role === 'cad';
  
  return useMemo(() => {
    if (!statuses || statuses.length === 0) {
      // Return empty array if no statuses loaded yet
      return [];
    }
    
    // Convert statuses to dropdown options format
    const allOptions = statuses.map(status => ({
      label: status.label || status.name || status.Name,
      value: status.name || status.Name,
    }));
    
    // For designers, filter to only show specific statuses
    if (isDesigner) {
      // For CAD role, show specific statuses
      if (user?.role === 'cad') {
        const cadStatuses = ['Cad', 'CAD', 'Approved Cad', 'ApprovedCad', 'Design Approval Pending'];
        return [
          { label: 'All', value: 'all' },
          ...allOptions.filter(opt => {
            const optValue = opt.value?.toLowerCase() || '';
            const optLabel = opt.label?.toLowerCase() || '';
            return cadStatuses.some(ds => 
              optValue === ds.toLowerCase() ||
              optLabel === ds.toLowerCase() ||
              optValue.includes('cad') && !optValue.includes('approved') ||
              (optValue.includes('approved') && optValue.includes('cad')) ||
              optValue.includes('design approval pending')
            );
          }),
        ];
      }
      
      // For Coral role, show existing statuses
      const designerStatuses = ['Design Approval Pending', 'Coral'];
      return [
        { label: 'All Status', value: 'all' },
        ...allOptions.filter(opt => 
          designerStatuses.some(ds => 
            opt.value?.toLowerCase().includes(ds.toLowerCase()) ||
            opt.label?.toLowerCase().includes(ds.toLowerCase())
          )
        ),
      ];
    }
    
    // For all other users, return all statuses with "All" option
    return [
      { label: 'All Status', value: 'all' },
      ...allOptions,
    ];
  }, [statuses, isDesigner]);
};

/**
 * Hook to get a single status by name
 * Uses cached statuses map for quick lookup
 */
export const useStatus = (name) => {
  const statusesMap = useSelector(state => state.statuses.statusesMap);
  const statuses = useSelector(state => state.statuses.statuses);
  
  if (!name) return null;
  
  // Try to find in map first (faster)
  const status = statusesMap[String(name)] || 
                 statusesMap[String(name).toLowerCase()] ||
                 // Fallback to array search
                 statuses.find(s => 
                   s.name === name || 
                   s.Name === name || 
                   s.label?.toLowerCase() === name.toLowerCase() ||
                   s.name?.toLowerCase() === name.toLowerCase()
                 );
  
  return status || null;
};



