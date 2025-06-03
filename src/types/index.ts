
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
  password?: string; 
  isApproved: boolean;
  pendingApproval: boolean;
  isAdmin: boolean;
  createdAt?: Date | any; 
  photoURL?: string; 
}

// For Pillow Stock Page
export interface AggregatedPillow {
  name: string;
  stock: number;
  fillPercentage: number;
  derivation?: string;
  vtexId?: string | number;
  sales30d: number;
  openOrders: number; 
  isCritical?: boolean;
  isUrgent?: boolean;
}

export type SortCriteria = 'name' | 'stock' | 'fillPercentage' | 'sales30d' | 'openOrders'; 
export type SortOrder = 'asc' | 'desc';
export type StockStatusFilter = 'all' | 'critical' | 'empty' | 'low' | 'medium' | 'good' | 'overstocked';

// For Stock History Chart
export interface StockHistoryEntry {
  id: string;
  date: Date; 
  totalStockUnits: number;
  totalSkusWithStock: number;
}

// For Intelligence Panel AI Flow
export interface LogisticsPredictionInput {
  productId: string;
  productName: string;
  currentStock: number;
  sales30d: number;
  price: number;
  readyToShipStock: number;
  regulatorStock: number;
  openOrders: number;
}

export interface LogisticsPredictionOutput {
  productId: string;
  productName: string;
  daysToRupture: number; // Can be Infinity if no sales
  riskStatus: 'Baixo' | 'Médio' | 'Alto' | 'Crítico' | 'N/A';
  suggestedRestockUnits: number;
  alerts?: string[];
}

