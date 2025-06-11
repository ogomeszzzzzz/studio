
export interface Product {
  vtexId: string | number;
  name: string;
  productId?: string | number;
  derivation?: string | number;
  productDerivation?: string;
  stock: number; // Total stock
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
  riskStatus?: StockRiskStatus; // Added for new page
}

// UserProfile for Firestore-based custom auth
export interface UserProfile {
  uid: string; 
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
export type SalesBasedPillowStatus = 'Critical' | 'Urgent' | 'Low' | 'Healthy' | 'Overstocked' | 'NoSales' | 'N/A';
export interface AggregatedPillow {
  name: string;
  stock: number;
  fillPercentage: number; // Based on visual max_stock_per_column
  derivation?: string;
  vtexId?: string | number;
  sales30d: number;
  openOrders: number; 
  isCritical?: boolean; // Original visual/urgent critical flag
  isUrgent?: boolean;   // Original visual/urgent flag

  // New sales-based analysis fields
  dailyAverageSales?: number;
  idealStockForSales?: number; // Stock needed for PILLOW_TARGET_COVERAGE_DAYS
  daysOfStock?: number; // Current stock / dailyAverageSales
  stockVsIdealFactor?: number; // currentStock / idealStockForSales
  replenishmentSuggestionForSales?: number; // To reach idealStockForSales, considering openOrders
  salesBasedStatus?: SalesBasedPillowStatus;
}

export type SortCriteria = 
  | 'name' | 'stock' | 'fillPercentage' | 'sales30d' | 'openOrders' 
  | 'dailyAverageSales' | 'daysOfStock' | 'stockVsIdealFactor'
  | 'itemType' | 'size' | 'status' | 'replenishmentSuggestion' // Added for Linha Branca
  | 'salesBasedStatus'; // Added for Pillows & Linha Branca

export type SortOrder = 'asc' | 'desc';
export type StockStatusFilter = 'all' | 'critical' | 'empty' | 'low' | 'medium' | 'good' | 'overstocked' | 'salesCritical' | 'salesUrgent' | 'salesLow' | 'salesHealthy' | 'salesOverstocked' | 'salesNoSales' | 'salesN/A';


// For Stock History Chart
export interface StockHistoryEntry {
  id: string;
  date: Date; 
  totalStockUnits: number;
  totalSkusWithStock: number;
}

// For Collection Stock Intelligence Page
export type StockRiskStatus = 'Alerta Crítico' | 'Risco Moderado' | 'Estável' | 'N/A';

export interface EnhancedProductForStockIntelligence extends Product {
  dailyAverageSales: number;
  estimatedCoverageDays: number | null; // Can be null if no sales
  dailyDepletionRate: number | null; // Can be null if no stock or no sales
  stockRiskStatus: StockRiskStatus;
  recommendedReplenishment: number;
  // For insights
  isHighDemandLowCoverage?: boolean;
  isZeroSalesWithStock?: boolean;
  isRecentCollectionFastDepletion?: boolean;
  // For actions table
  priority?: 1 | 2 | 3;
  automatedJustification?: string;
  isDailySalesExceedsTotalStock?: boolean;
}

// For Linha Branca Ecosystem Page
export type LinhaBrancaItemType = string; // Now generic string from productType
export type LinhaBrancaStockStatus = SalesBasedPillowStatus; // Reuse from Pillows

export interface AggregatedLinhaBrancaItem {
  id: string; // Ex: "protetor-colchao-casal-impermeavel-altenburg" (generated from product name + size)
  productName: string; // Original product name
  itemType: LinhaBrancaItemType; // From product.productType
  size: string; // From product.size
  
  totalStock: number;
  totalSales30d: number;
  totalOpenOrders: number;
  
  dailyAverageSales: number;
  daysOfStock: number | null;
  targetStock: number; // (dailyAverageSales * LINHA_BRANCA_TARGET_COVERAGE_DAYS)
  replenishmentSuggestion: number; // (targetStock - (totalStock + totalOpenOrders))
  status: LinhaBrancaStockStatus;
  
  contributingSkus: Product[];
  vtexIdSample?: string | number; // An example VTEX ID from one of the SKUs
  avgPrice?: number; // Average price of contributing SKUs
}

// Removed LinhaBrancaBedSizeSummary as we are moving to a flat list of items
// export interface LinhaBrancaBedSizeSummary {
//   size: string;
//   items: AggregatedLinhaBrancaItem[];
//   overallHarmonyStatus: 'Good' | 'NeedsAttention' | 'Critical';
// }
    
```