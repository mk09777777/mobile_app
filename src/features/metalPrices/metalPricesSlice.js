import { createSlice } from '@reduxjs/toolkit';

const initialState = {
  selectedMetal: null,
  editingMetal: null,
  showAddModal: false,
  showEditModal: false,
};

const metalPricesSlice = createSlice({
  name: 'metalPrices',
  initialState,
  reducers: {
    setSelectedMetal: (state, action) => {
      state.selectedMetal = action.payload;
    },
    setEditingMetal: (state, action) => {
      state.editingMetal = action.payload;
    },
    setShowAddModal: (state, action) => {
      state.showAddModal = action.payload;
    },
    setShowEditModal: (state, action) => {
      state.showEditModal = action.payload;
    },
    resetState: (state) => {
      state.selectedMetal = null;
      state.editingMetal = null;
      state.showAddModal = false;
      state.showEditModal = false;
    },
  },
});

export const {
  setSelectedMetal,
  setEditingMetal,
  setShowAddModal,
  setShowEditModal,
  resetState,
} = metalPricesSlice.actions;

export default metalPricesSlice.reducer;

