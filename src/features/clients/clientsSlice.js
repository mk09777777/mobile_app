import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  clients: [],
  clientsMap: {}, // ID to client object map for quick lookup
  isLoading: false,
  lastFetched: null,
  selectedClientId: null,
  searchQuery: '',
  sortBy: 'name',
  sortOrder: 'asc',
};

const clientsSlice = createSlice({
  name: 'clients',
  initialState,
  reducers: {
    setClients: (state, action) => {
      state.clients = action.payload;
      // Create a map for quick ID lookups
      const map = {};
      action.payload.forEach(client => {
        const id = client.id || client._id;
        if (id) {
          map[String(id)] = client;
          // Also store with _id if different
          if (client._id && client._id !== id) {
            map[String(client._id)] = client;
          }
        }
        // Also index by name for quick lookups
        if (client.name) {
          map[client.name.toLowerCase()] = client;
        }
      });
      state.clientsMap = map;
      state.lastFetched = Date.now();
    },
    setClientsLoading: (state, action) => {
      state.isLoading = action.payload;
    },
    clearClients: (state) => {
      state.clients = [];
      state.clientsMap = {};
      state.lastFetched = null;
    },
    setSelectedClient: (state, action) => {
      state.selectedClientId = action.payload;
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setSorting: (state, action) => {
      state.sortBy = action.payload.sortBy;
      state.sortOrder = action.payload.sortOrder;
    },
    clearFilters: (state) => {
      state.searchQuery = '';
      state.sortBy = 'name';
      state.sortOrder = 'asc';
    },
  },
});

export const {
  setClients,
  setClientsLoading,
  clearClients,
  setSelectedClient,
  setSearchQuery,
  setSorting,
  clearFilters,
} = clientsSlice.actions;

export default clientsSlice.reducer;

