
export interface Product {
  vtexId: string | number;
  name: string;
  productId?: string | number;
  derivation?: string | number;
  productDerivation?: string;
  stock: number;
  readyToShip: number;
  regulatorStock: number;
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
}

export interface FilterState {
  collection: string;
  stockMin: string;
  stockMax: string;
  productType: string; // Added productType
  // Removed date fields:
  // startDateFrom: Date | undefined;
  // startDateTo: Date | undefined;
  // endDateFrom: Date | undefined;
  // endDateTo: Date | undefined;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  createdAt?: Date;
}
