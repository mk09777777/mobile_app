import { useGetEnquiryByIdQuery } from '../../store/api';

export const useEnquiry = (id) => {
  return useGetEnquiryByIdQuery(id, {
    skip: !id,
  });
};
