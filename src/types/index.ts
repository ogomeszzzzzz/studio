
export interface Product {
  vtexId: string | number; // Can be string like "#N/D" or a number
  name: string;
  productId?: string | number;
  derivation?: string | number;
  productDerivation?: string;
  stock: number;
  readyToShip: number;
  regulatorStock: number;
  openOrders: number;
  description: string;
  size?: string;
  productType?: string;
  complement?: string;
  commercialLine: string;
  collection: string;
  commercialLineDescription?: string;
  isCurrentCollection: boolean;
  collectionStartDate: Date | null;
  collectionEndDate: Date | null;
  isExcMtVendors: boolean;
  isDiscontinued: boolean;
  rawCollectionStartDate?: string;
  rawCollectionEndDate?: string;
  canRestockAmount?: number; // For restock opportunities

  price?: number;
  sales30d?: number;
  revenue30d?: number;
  abcCurve?: 'A' | 'B' | 'C' | 'N/A';
  cumulativeRevenuePercentage?: number;
}

export interface FilterState {
  collection: string;
  stockMin: string;
  stockMax: string;
  productType: string;
}

export interface UserProfile {
  uid: string;
  name?: string; // Added for registration
  email: string | null;
  createdAt?: Date; // Consider using Firestore Timestamp for this
  isApproved?: boolean; // Added for approval system
  pendingApproval?: boolean; // Added for approval system
}
