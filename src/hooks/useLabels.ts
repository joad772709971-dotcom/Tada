import { BUSINESS_LABELS } from '../constants/labels';

export const useLabels = (businessType: string = 'mobiles') => {
  return BUSINESS_LABELS[businessType as keyof typeof BUSINESS_LABELS] || BUSINESS_LABELS.mobiles;
};
