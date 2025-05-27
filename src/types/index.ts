
export interface Product {
  vtexId: string | number;
  name: string;
  productId?: string | number;
  derivation?: string | number;
  productDerivation?: string;
  stock: number;
  readyToShip: number; // Changed to number
  order: number; // Changed to number
  description: string; // Represents print/pattern
  size?: string;
  complement?: string;
  commercialLine: string; // Now consistently populated
  collection: string; // This field's source (e.g. 'COLEÇÃO' or 'Linha Comercial') is determined by parser arg
  commercialLineDescription?: string;
  isCurrentCollection: boolean;
  collectionStartDate: Date | null;
  collectionEndDate: Date | null;
  isExcMtVendors: boolean;
  isDiscontinued: boolean;
  // Raw values for display if needed
  rawCollectionStartDate?: string;
  rawCollectionEndDate?: string;
  identifiedType?: string; // For AI-identified product type
}

export interface FilterState {
  collection: string;
  stockMin: string;
  stockMax: string;
  startDateFrom: Date | undefined;
  startDateTo: Date | undefined;
  endDateFrom: Date | undefined;
  endDateTo: Date | undefined;
}

// UserProfile remains simple as registration was removed.
export interface UserProfile {
  uid: string;
  email: string | null; 
  createdAt?: Date; 
}

// For AI Product Type Identification
export interface CategorizedProduct {
  originalName: string;
  identifiedType: string;
}
