
export interface Product {
  vtexId: string | number;
  name: string;
  productId?: string | number;
  derivation?: string | number;
  productDerivation?: string;
  stock: number;
  readyToShip?: string | number;
  order?: string;
  description?: string;
  size?: string;
  complement?: string;
  commercialLine?: string;
  collection: string;
  commercialLineDescription?: string;
  isCurrentCollection: boolean;
  collectionStartDate: Date | null;
  collectionEndDate: Date | null;
  isExcMtVendors: boolean;
  isDiscontinued: boolean;
  // Raw values for display if needed
  rawCollectionStartDate?: string;
  rawCollectionEndDate?: string;
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
