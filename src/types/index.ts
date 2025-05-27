
export interface Product {
  vtexId: string | number;
  name: string;
  productId?: string | number;
  derivation?: string | number;
  productDerivation?: string;
  stock: number;
  readyToShip: number;
  regulatorStock: number; // Substituindo 'order'
  description: string; // Represents print/pattern from Excel "Descrição"
  size?: string; // From Excel "Tamanho" column
  productType?: string; // Derived from Excel "Tipo. Produto" column
  complement?: string;
  commercialLine: string;
  collection: string; // This field's source is determined by parser arg (e.g., "Descrição Linha Comercial" or "COLEÇÃO")
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
  startDateFrom: Date | undefined;
  startDateTo: Date | undefined;
  endDateFrom: Date | undefined;
  endDateTo: Date | undefined;
}

export interface UserProfile {
  uid: string;
  email: string | null;
  createdAt?: Date;
}
