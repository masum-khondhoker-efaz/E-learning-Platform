export interface TStripeSaveWithCustomerInfo {
  user: User;
  paymentMethodId: string;
  amount: number;
  address: Address;
}

interface Address {
  line: string;
  city: string;
  postal_code: string;
  country: string;
}

interface User {
  name: string;
  email: string;
}
