import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  users: [],
  usersMap: {}, // ID to user object map for quick lookup
  isLoading: false,
  lastFetched: null,
};

const usersSlice = createSlice({
  name: 'users',
  initialState,
  reducers: {
    setUsers: (state, action) => {
      state.users = action.payload;
      // Create a map for quick ID lookups
      const map = {};
      action.payload.forEach(user => {
        const id = user.id || user._id;
        if (id) {
          map[String(id)] = user;
          // Also store with _id if different
          if (user._id && user._id !== id) {
            map[String(user._id)] = user;
          }
        }
      });
      state.usersMap = map;
      state.lastFetched = Date.now();
    },
    setLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    clearUsers: (state) => {
      state.users = [];
      state.usersMap = {};
      state.lastFetched = null;
    },
  },
});

export const { setUsers, setLoading, clearUsers } = usersSlice.actions;

export default usersSlice.reducer;



