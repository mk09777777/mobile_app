import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  filters: {
    status: 'all',
    priority: 'all',
    category: 'all',
    clientId: 'all',
    assignedTo: 'all',
    stoneType: 'all',
    metalColor: 'all',
    metalQuality: 'all',
    shippingDateFrom: '',
    shippingDateTo: '',
    assignedDateFrom: '',
    assignedDateTo: '',
    createdDateFrom: '',
    createdDateTo: '',
  },
  searchQuery: '',
  sortBy: 'CreatedDate',
  sortOrder: 'desc',
  selectedEnquiryId: null,
  selectedStatus: 'All', // Keep for backward compatibility, but use selectedStatuses array
  selectedStatuses: [], // Array of selected statuses for multi-select
  selectedClient: 'All',
};

const enquiriesSlice = createSlice({
  name: 'enquiries',
  initialState,
  reducers: {
    setFilters: (state, action) => {
      state.filters = { ...state.filters, ...action.payload };
    },
    setSearchQuery: (state, action) => {
      state.searchQuery = action.payload;
    },
    setSorting: (state, action) => {
      state.sortBy = action.payload.sortBy;
      state.sortOrder = action.payload.sortOrder;
    },
    setSelectedEnquiry: (state, action) => {
      state.selectedEnquiryId = action.payload;
    },
    setSelectedStatus: (state, action) => {
      state.selectedStatus = action.payload;
      // Legacy support - no longer updates filters
    },
    setSelectedStatuses: (state, action) => {
      state.selectedStatuses = action.payload;
      // Update filters.status to be an array or comma-separated string
      if (action.payload.length === 0) {
        state.filters.status = 'all';
      } else {
        state.filters.status = action.payload;
      }
    },
    toggleStatus: (state, action) => {
      const status = action.payload;
      const index = state.selectedStatuses.indexOf(status);
      if (index > -1) {
        // Remove status if already selected
        state.selectedStatuses.splice(index, 1);
      } else {
        // Add status if not selected
        state.selectedStatuses.push(status);
      }
      // Update filters.status
      if (state.selectedStatuses.length === 0) {
        state.filters.status = 'all';
      } else {
        state.filters.status = state.selectedStatuses;
      }
    },
    setSelectedClient: (state, action) => {
      state.selectedClient = action.payload;
      // Legacy support - no longer updates filters
    },
    clearFilters: (state) => {
      state.filters = {
        status: 'all',
        priority: 'all',
        category: 'all',
        clientId: 'all',
        assignedTo: 'all',
        stoneType: 'all',
        metalColor: 'all',
        metalQuality: 'all',
        shippingDateFrom: '',
        shippingDateTo: '',
        assignedDateFrom: '',
        assignedDateTo: '',
        createdDateFrom: '',
        createdDateTo: '',
      };
      state.searchQuery = '';
      state.selectedStatus = 'All';
      state.selectedStatuses = [];
      state.selectedClient = 'All';
    },
  },
});

export const {
  setFilters,
  setSearchQuery,
  setSorting,
  setSelectedEnquiry,
  setSelectedStatus,
  setSelectedStatuses,
  toggleStatus,
  setSelectedClient,
  clearFilters,
} = enquiriesSlice.actions;

export default enquiriesSlice.reducer;

