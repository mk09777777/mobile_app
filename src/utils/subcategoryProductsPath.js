export const getSubcategoryProductsPath = (subcategoryId, options = {}) => {
  const params = new URLSearchParams();
  if (options.onlyBestSeller) params.set('isBestSeller', 'true');
  if (options.onlyReadyToShip) params.set('isReadyToShip', 'true');
  const query = params.toString();
  return `/subcategories/${subcategoryId}/products${query ? `?${query}` : ''}`;
};
