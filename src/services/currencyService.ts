export const convertCurrency = (
  amount: number, 
  from: string, 
  to: string, 
  rates: Record<string, { buy: number, sell: number }>,
  type: 'buy' | 'sell' = 'sell'
) => {
  if (from === to) return amount;
  
  // Convert from 'from' to YER
  // If we are buying 'from' currency, we use the 'buy' rate
  // If we are selling 'from' currency, we use the 'sell' rate
  const fromRate = rates[from]?.[type] || 1;
  const amountInYER = from === 'YER' ? amount : amount * fromRate;
  
  // Convert from YER to 'to'
  const toRate = rates[to]?.[type] || 1;
  const finalAmount = to === 'YER' ? amountInYER : amountInYER / toRate;
  
  return finalAmount;
};

export const formatCurrency = (amount: number, currency: string) => {
  return new Intl.NumberFormat('ar-YE', {
    style: 'currency',
    currency: currency === 'ر.ي' ? 'YER' : currency === 'USD' ? 'USD' : currency === 'SAR' ? 'SAR' : 'YER',
    minimumFractionDigits: currency === 'ر.ي' ? 0 : 2
  }).format(amount).replace('YER', 'ر.ي').replace('SAR', 'ر.س').replace('USD', '$');
};
