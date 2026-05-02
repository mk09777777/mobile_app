    // store.js
    import { configureStore } from '@reduxjs/toolkit';
    import authReducer from './reducer/authReducer'; // Example slice

    export const store = configureStore({
      reducer: {
        counter: authReducer,
        // Add other reducers here
      },
    });