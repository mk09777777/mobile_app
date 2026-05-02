import { configureStore } from '@reduxjs/toolkit';
import { api } from './api';
import authReducer from '../features/auth/authSlice';
import enquiriesReducer from '../features/enquiries/enquiriesSlice';
import clientsReducer from '../features/clients/clientsSlice';
import metalPricesReducer from '../features/metalPrices/metalPricesSlice';
import usersReducer from '../features/users/usersSlice';
import statusesReducer from '../features/statuses/statusesSlice';

export const store = configureStore({
  reducer: {
    api: api.reducer,
    auth: authReducer,
    enquiries: enquiriesReducer,
    clients: clientsReducer,
    metalPrices: metalPricesReducer,
    users: usersReducer,
    statuses: statusesReducer,
  },
  middleware: (getDefaultMiddleware) =>
    getDefaultMiddleware({
      serializableCheck: false, // For React Native compatibility
    }).concat(api.middleware),
});

export default store;

