import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  statuses: [],
  statusesMap: {}, // name to status object map for quick lookup
  isLoading: false,
  lastFetched: null,
};

const statusesSlice = createSlice({
  name: 'statuses',
  initialState,
  reducers: {
    setStatuses: (state, action) => {
      state.statuses = action.payload;
      // Create a map for quick name lookups
      const map = {};
      action.payload.forEach(status => {
        const name = status.name || status.Name;
        if (name) {
          // Store with original name
          map[String(name)] = status;
          // Also store with lowercase for case-insensitive lookups
          map[String(name).toLowerCase()] = status;
          // Store with label if different
          if (status.label && status.label !== name) {
            map[String(status.label).toLowerCase()] = status;
          }
        }
      });
      state.statusesMap = map;
      state.lastFetched = Date.now();
    },
    setStatusesLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    clearStatuses: (state) => {
      state.statuses = [];
      state.statusesMap = {};
      state.lastFetched = null;
    },
  },
});

export const {
  setStatuses,
  setStatusesLoading,
  clearStatuses,
} = statusesSlice.actions;

export default statusesSlice.reducer;







