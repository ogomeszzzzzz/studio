
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

// UserProfile for Firestore-based custom auth
export interface UserProfile {
  uid: string; // Will be the user's email for doc ID
  email: string;
  name: string;
  password?: string; // Only for creation, should not be stored/read from client directly after creation
  isApproved: boolean;
  pendingApproval: boolean;
  isAdmin: boolean;
  createdAt?: Date | any; // Firestore Timestamp stored, Date on client
  photoURL?: string; // For profile picture
}

// For Pillow Stock Page
export interface AggregatedPillow {
  name: string;
  stock: number;
  fillPercentage: number;
  derivation?: string;
  vtexId?: string | number;
  sales30d: number;
  isCritical?: boolean;
  isUrgent?: boolean;
}

export type SortCriteria = 'name' | 'stock' | 'fillPercentage' | 'sales30d';
export type SortOrder = 'asc' | 'desc';
export type StockStatusFilter = 'all' | 'critical' | 'empty' | 'low' | 'medium' | 'good' | 'overstocked';
