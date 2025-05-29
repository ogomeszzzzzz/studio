
export interface Product {
  vtexId: string | number;
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
  canRestockAmount?: number;

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

// Updated UserProfile for Firestore-based auth
export interface UserProfile {
  uid: string; // Will be the user's email
  email: string;
  name: string;
  isApproved: boolean;
  pendingApproval: boolean;
  isAdmin: boolean;
  createdAt?: Date | any; // Firestore Timestamp will be stored, Date on client
}
