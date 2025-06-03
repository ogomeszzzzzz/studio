
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { PillowStackColumn } from '@/components/domain/PillowStackColumn';
import type { Product, AggregatedPillow, SortCriteria, SortOrder, StockStatusFilter, SalesBasedPillowStatus } from '@/types';
import { BedDouble, Loader2, Database, Filter as FilterIcon, AlertTriangle, ShoppingBag, TrendingDown, PackageX, BarChart3, ListFilter, SortAsc, SortDesc, Clock, Zap, Inbox, MinusCircle, PlusCircle, ThumbsUp, AlertOctagon, HelpCircle, PackageSearch, Repeat } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { firestore, firestoreClientInitializationError } from '@/lib/firebase/config';
import { collection, getDocs, doc, Timestamp, query, getDoc } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';
import { format as formatDateFns, isValid as isDateValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { TooltipProvider, Tooltip, TooltipTrigger, TooltipContent } from '@/components/ui/tooltip';


const PILLOW_PRODUCT_TYPE_EXCEL = "TRAVESSEIRO";
const PILLOW_NAME_PREFIX = "Travesseiro";
const PILLOW_BRAND_NAME = "Altenburg";
const MAX_STOCK_PER_PILLOW_COLUMN = 75; // For visual representation
const LOW_STOCK_THRESHOLD_PERCENTAGE = 0.25; // For visual representation in column
const GOOD_STOCK_THRESHOLD_PERCENTAGE = 0.75; // For visual representation in column

// New constants for sales-based analysis
const PILLOW_TARGET_COVERAGE_DAYS = 30;
const PILLOW_SALES_BASED_LOW_STOCK_DAYS = 7;
const PILLOW_SALES_BASED_HIGH_SALES_THRESHOLD = 10; // sales30d units
const PILLOW_OVERSTOCK_FACTOR = 1.5; // 150% of ideal stock for sales


const productFromFirestore = (data: any): Product => {
  return {
    ...data,
    collectionStartDate: data.collectionStartDate instanceof Timestamp ? data.collectionStartDate.toDate() : null,
    collectionEndDate: data.collectionEndDate instanceof Timestamp ? data.collectionEndDate.toDate() : null,
  } as Product;
};

function derivePillowDisplayName(productNameInput: string | undefined): string {
  const productName = productNameInput || "";
  if (!productName.trim()) return "Sem Nome";
  let name = productName.trim();
  if (name.toLowerCase().startsWith(PILLOW_NAME_PREFIX.toLowerCase())) {
    name = name.substring(PILLOW_NAME_PREFIX.length).trim();
    if (name.toLowerCase().startsWith(PILLOW_BRAND_NAME.toLowerCase())) {
      const brandNameLength = PILLOW_BRAND_NAME.length;
      if (name.length === brandNameLength || (name.length > brandNameLength && name[brandNameLength] === ' ')) {
         name = name.substring(brandNameLength).trim();
      }
    }
    const words = name.split(/\s+/).filter(word => word.length > 0);
    if (words.length === 0) return productName; 
    
    if (words[0]?.toLowerCase() === 'gellou' && words.length === 1) return words[0];
    if (words.length === 1) return words[0];
    return `${words[0]} ${words[1] || ''}`.trim();
  }
  const words = productName.split(/\s+/).filter(word => word.length > 0);
  if (words.length <= 2) return productName;
  return `${words[0]} ${words[1]}`;
}


export default function PillowStockPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [aggregatedPillowStockState, setAggregatedPillowStockState] = useState<AggregatedPillow[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');
  const [lastDataUpdateTimestamp, setLastDataUpdateTimestamp] = useState<Date | null>(null);

  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('salesBasedStatus');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('all');


  useEffect(() => {
    if (isAuthLoading) {
      if (allProducts.length === 0) setIsLoadingFirestore(true);
      return;
    }
    if (firestoreClientInitializationError || !firestore) {
      toast({ title: "Erro Crítico de Configuração/Conexão Firebase", description: firestoreClientInitializationError || "Instância do Firestore não disponível.", variant: "destructive", duration: Infinity });
      setIsLoadingFirestore(false);
      return;
    }
    if (currentUser) {
      if (allProducts.length === 0) {
        setIsLoadingFirestore(true);
        const fetchProducts = async () => {
          try {
            const productsQuery = query(collection(firestore, "shared_products"));
            const snapshot = await getDocs(productsQuery);
            const productsFromDb: Product[] = snapshot.docs.map(docSnap => productFromFirestore(docSnap.data()));
            setAllProducts(productsFromDb);

            const metadataDocRef = doc(firestore, "app_metadata", "products_metadata");
            const metadataDocSnap = await getDoc(metadataDocRef);
            if (metadataDocSnap.exists()) {
              const data = metadataDocSnap.data();
              if (data.lastUpdatedAt && data.lastUpdatedAt instanceof Timestamp) {
                setLastDataUpdateTimestamp(data.lastUpdatedAt.toDate());
              }
            }
            if (productsFromDb.length === 0) {
               toast({ title: "Sem Dados no Sistema", description: "Nenhum produto encontrado para análise. Carregue uma planilha no Dashboard.", variant: "default" });
            }
          } catch (error) {
            toast({ title: "Erro ao Carregar Dados", description: `Não foi possível buscar produtos: ${(error as Error).message}`, variant: "destructive" });
          } finally {
            setIsLoadingFirestore(false);
          }
        };
        fetchProducts();
      } else {
        setIsLoadingFirestore(false);
      }
    } else {
      setIsLoadingFirestore(false);
      setAllProducts([]);
      setAggregatedPillowStockState([]);
    }
  }, [currentUser, isAuthLoading, allProducts.length, toast]);

  const pillowProducts = useMemo(() => {
    return allProducts.filter(p => p.productType?.toUpperCase() === PILLOW_PRODUCT_TYPE_EXCEL.toUpperCase());
  }, [allProducts]);

  useEffect(() => {
    const pillowStockMap = new Map<string, { stock: number; derivation?: string; vtexId?: string | number; sales30d: number; openOrders: number }>();
    pillowProducts.forEach(pillow => {
        const displayName = derivePillowDisplayName(pillow.name);
        const currentPillowData = pillowStockMap.get(displayName) || {
            stock: 0,
            derivation: pillow.productDerivation || String(pillow.productId || pillow.vtexId || ''),
            vtexId: pillow.vtexId,
            sales30d: 0,
            openOrders: 0,
        };
        currentPillowData.stock += pillow.stock;
        currentPillowData.sales30d += (pillow.sales30d || 0);
        currentPillowData.openOrders += (pillow.openOrders || 0);

        if (!pillowStockMap.has(displayName)) { 
            currentPillowData.derivation = pillow.productDerivation || String(pillow.productId || pillow.vtexId || '');
            currentPillowData.vtexId = pillow.vtexId;
        }
        pillowStockMap.set(displayName, currentPillowData);
    });

    let derivedPillows: AggregatedPillow[] = Array.from(pillowStockMap.entries())
      .map(([name, data]) => {
        const currentStock = data.stock;
        const sales30d = data.sales30d;
        const openOrders = data.openOrders;

        const dailyAverageSales = sales30d > 0 ? sales30d / 30 : 0;
        const idealStockForSales = dailyAverageSales * PILLOW_TARGET_COVERAGE_DAYS;
        const daysOfStock = dailyAverageSales > 0 ? currentStock / dailyAverageSales : (currentStock > 0 ? Infinity : 0);
        const stockVsIdealFactor = idealStockForSales > 0 ? currentStock / idealStockForSales : (currentStock > 0 ? Infinity : 0);
        const replenishmentSuggestionForSales = dailyAverageSales > 0 ? Math.max(0, Math.round(idealStockForSales - currentStock - openOrders)) : 0;
        
        let salesBasedStatus: SalesBasedPillowStatus = 'N/A';
        if (currentStock === 0 && dailyAverageSales > 0 && openOrders === 0) {
            salesBasedStatus = 'Critical';
        } else if (daysOfStock < PILLOW_SALES_BASED_LOW_STOCK_DAYS && dailyAverageSales > 0 && sales30d > PILLOW_SALES_BASED_HIGH_SALES_THRESHOLD) {
            salesBasedStatus = 'Urgent';
        } else if (dailyAverageSales === 0 && currentStock > 0) {
            salesBasedStatus = 'NoSales';
        } else if (dailyAverageSales > 0 && stockVsIdealFactor > PILLOW_OVERSTOCK_FACTOR) {
            salesBasedStatus = 'Overstocked';
        } else if (dailyAverageSales > 0 && daysOfStock < PILLOW_TARGET_COVERAGE_DAYS / 2 && daysOfStock >= PILLOW_SALES_BASED_LOW_STOCK_DAYS) { // Low but not urgent
            salesBasedStatus = 'Low';
        } else if (dailyAverageSales > 0) {
            salesBasedStatus = 'Healthy';
        }


        const fillPercentage = (currentStock / MAX_STOCK_PER_PILLOW_COLUMN) * 100;
        // Original critical/urgent flags (can be kept for visual column emphasis if needed, or removed if salesBasedStatus is primary)
        const isCriticalOriginal = currentStock === 0 && openOrders === 0 && sales30d > 0; // Matches salesBasedStatus 'Critical'
        const isUrgentOriginal = currentStock > 0 && 
                         (currentStock + openOrders) < (MAX_STOCK_PER_PILLOW_COLUMN * LOW_STOCK_THRESHOLD_PERCENTAGE) &&
                         currentStock < (MAX_STOCK_PER_PILLOW_COLUMN * LOW_STOCK_THRESHOLD_PERCENTAGE) && 
                         (sales30d > PILLOW_SALES_BASED_HIGH_SALES_THRESHOLD || (daysOfStock < PILLOW_SALES_BASED_LOW_STOCK_DAYS && sales30d > 0));


        return {
          name,
          stock: currentStock,
          derivation: data.derivation,
          vtexId: data.vtexId,
          fillPercentage,
          sales30d,
          openOrders,
          isCritical: isCriticalOriginal, // keep for now, or align with salesBasedStatus
          isUrgent: isUrgentOriginal,   // keep for now, or align with salesBasedStatus
          dailyAverageSales,
          idealStockForSales,
          daysOfStock,
          stockVsIdealFactor,
          replenishmentSuggestionForSales,
          salesBasedStatus,
        };
      });

    if (searchTerm) {
      derivedPillows = derivedPillows.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (stockStatusFilter !== 'all') {
      derivedPillows = derivedPillows.filter(p => {
        if (stockStatusFilter.startsWith('sales')) {
            const status = stockStatusFilter.replace('sales', '') as SalesBasedPillowStatus;
            return p.salesBasedStatus?.toLowerCase() === status.toLowerCase();
        }
        // Original visual filter logic (can be phased out or kept for column-fill based filtering)
        const stock = p.stock;
        const lowThreshold = MAX_STOCK_PER_PILLOW_COLUMN * LOW_STOCK_THRESHOLD_PERCENTAGE;
        const goodThreshold = MAX_STOCK_PER_PILLOW_COLUMN * GOOD_STOCK_THRESHOLD_PERCENTAGE;
        switch (stockStatusFilter) {
          case 'critical': return !!p.isCritical || !!p.isUrgent; // Original visual critical
          case 'empty': return stock === 0 && p.openOrders === 0;
          case 'low': return stock > 0 && stock < lowThreshold && !p.isCritical && !p.isUrgent;
          case 'medium': return stock >= lowThreshold && stock < goodThreshold && !p.isCritical && !p.isUrgent;
          case 'good': return stock >= goodThreshold && stock <= MAX_STOCK_PER_PILLOW_COLUMN && !p.isCritical && !p.isUrgent;
          case 'overstocked': return stock > MAX_STOCK_PER_PILLOW_COLUMN && !p.isCritical && !p.isUrgent;
          default: return true;
        }
      });
    }

    // Enhanced Sort Logic
    derivedPillows.sort((a, b) => {
      let comparison = 0;
      const valA = a[sortCriteria as keyof AggregatedPillow];
      const valB = b[sortCriteria as keyof AggregatedPillow];

      if (sortCriteria === 'salesBasedStatus') {
          const order: SalesBasedPillowStatus[] = ['Critical', 'Urgent', 'Low', 'N/A', 'Healthy', 'NoSales', 'Overstocked'];
          comparison = order.indexOf(a.salesBasedStatus || 'N/A') - order.indexOf(b.salesBasedStatus || 'N/A');
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = (valA || 0) - (valB || 0);
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = (valA || '').localeCompare(valB || '');
      } else if (valA === Infinity && valB !== Infinity) {
        comparison = 1;
      } else if (valB === Infinity && valA !== Infinity) {
        comparison = -1;
      } else if (valA === Infinity && valB === Infinity) {
        comparison = 0;
      }
      
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    setAggregatedPillowStockState(derivedPillows);
  }, [pillowProducts, searchTerm, sortCriteria, sortOrder, stockStatusFilter]);


  const pillowKPIs = useMemo(() => {
    if (aggregatedPillowStockState.length === 0 && pillowProducts.length > 0) { // Use aggregated state if available
        // Fallback if aggregated is empty but pillowProducts exist (e.g. initial load before agg calculation)
        const tempAgg = pillowProducts.map(p => ({ name: derivePillowDisplayName(p.name), stock: p.stock, sales30d: p.sales30d || 0, openOrders: p.openOrders || 0 }));
        const uniquePillowsForKPIFallback = Array.from(new Map(tempAgg.map(p => [p.name, p])).values());
         return { 
            totalPillowSKUs: uniquePillowsForKPIFallback.length, 
            totalPillowUnits: uniquePillowsForKPIFallback.reduce((sum, p) => sum + p.stock, 0),
            totalOpenOrdersPillows: uniquePillowsForKPIFallback.reduce((sum,p)=> sum + p.openOrders, 0),
            criticalSalesCount: 0, urgentSalesCount: 0, overstockedSalesCount: 0, noSalesCount: 0, totalReplenishmentSuggestion: 0
        };
    }
    if (aggregatedPillowStockState.length === 0) return { totalPillowSKUs: 0, totalPillowUnits: 0, totalOpenOrdersPillows: 0, criticalSalesCount: 0, urgentSalesCount: 0, overstockedSalesCount: 0, noSalesCount: 0, totalReplenishmentSuggestion: 0 };

    return {
      totalPillowSKUs: aggregatedPillowStockState.length,
      totalPillowUnits: aggregatedPillowStockState.reduce((sum, p) => sum + p.stock, 0),
      totalOpenOrdersPillows: aggregatedPillowStockState.reduce((sum, p) => sum + (p.openOrders || 0), 0),
      criticalSalesCount: aggregatedPillowStockState.filter(p => p.salesBasedStatus === 'Critical').length,
      urgentSalesCount: aggregatedPillowStockState.filter(p => p.salesBasedStatus === 'Urgent').length,
      overstockedSalesCount: aggregatedPillowStockState.filter(p => p.salesBasedStatus === 'Overstocked').length,
      noSalesCount: aggregatedPillowStockState.filter(p => p.salesBasedStatus === 'NoSales').length,
      totalReplenishmentSuggestion: aggregatedPillowStockState.reduce((sum,p) => sum + (p.replenishmentSuggestionForSales || 0),0)
    };
  }, [aggregatedPillowStockState, pillowProducts]); 

  const noPillowsFoundInExcel = useMemo(() => {
    return allProducts.length > 0 && pillowProducts.length === 0;
  }, [allProducts, pillowProducts]);

  const displayLoader = (isLoadingFirestore || isAuthLoading) && allProducts.length === 0;
  
  const salesStatusFilterOptions: { value: StockStatusFilter; label: string; icon?: React.ElementType }[] = [
    { value: 'all', label: 'Todos Status (Vendas)' },
    { value: 'salesCritical', label: 'Crítico (Ruptura Venda)', icon: PackageX },
    { value: 'salesUrgent', label: 'Urgente (Venda Alta, Baixa Cob.)', icon: Zap },
    { value: 'salesLow', label: 'Baixo (vs Vendas)', icon: TrendingDown },
    { value: 'salesHealthy', label: 'Saudável (vs Vendas)', icon: ThumbsUp },
    { value: 'salesOverstocked', label: 'Superestocado (vs Vendas)', icon: Repeat },
    { value: 'salesNoSales', label: 'Estagnado (Estoque s/ Venda)', icon: MinusCircle },
  ];


  if (displayLoader) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando dados...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <BedDouble className="mr-3 h-8 w-8 text-primary" />
            Análise de Estoque de Travesseiros (vs Vendas)
          </h1>
          <p className="text-muted-foreground">
            Compare estoque atual com vendas (30d) para otimizar reposição e identificar excessos ou faltas.
          </p>
        </div>
      </div>
      {lastDataUpdateTimestamp && (
        <div className="text-sm text-muted-foreground flex items-center">
            <Clock className="mr-2 h-4 w-4" />
            Dados de produtos atualizados em: {formatDateFns(lastDataUpdateTimestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
        </div>
      )}

      {!isLoadingFirestore && !isAuthLoading && allProducts.length === 0 && (
        <Card className="shadow-lg text-center py-10"><CardHeader><CardTitle className="flex items-center justify-center text-xl">
              <Database className="mr-2 h-7 w-7 text-primary" /> Sem dados para exibir
            </CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Peça ao administrador para carregar dados no Dashboard.</p>
            </CardContent></Card>
      )}

      {!isLoadingFirestore && !isAuthLoading && allProducts.length > 0 && (
        <TooltipProvider>
        <>
          <Card className="shadow-md border-primary/30 border-l-4">
            <CardHeader><CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary" />Indicadores Chave de Travesseiros (Baseado em Vendas)</CardTitle></CardHeader>
            <CardContent>
                {pillowProducts.length === 0 && !noPillowsFoundInExcel && (<p className="text-muted-foreground">Nenhum travesseiro encontrado (coluna "Tipo. Produto" diferente de "{PILLOW_PRODUCT_TYPE_EXCEL}").</p>)}
                {noPillowsFoundInExcel && (<p className="text-muted-foreground">Nenhum produto com "Tipo. Produto" igual a "{PILLOW_PRODUCT_TYPE_EXCEL}" foi encontrado.</p>)}
                {pillowProducts.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-3">
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle className="text-xs font-medium">Modelos Únicos</CardTitle><BedDouble className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl font-bold">{pillowKPIs.totalPillowSKUs}</div></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle className="text-xs font-medium">Total em Estoque</CardTitle><ShoppingBag className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-xl font-bold">{pillowKPIs.totalPillowUnits.toLocaleString()}</div></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle className="text-xs font-medium">Pedidos em Aberto</CardTitle><Inbox className="h-4 w-4 text-blue-500" /></CardHeader><CardContent><div className="text-xl font-bold text-blue-600">{pillowKPIs.totalOpenOrdersPillows.toLocaleString()}</div></CardContent></Card>
                        
                        <Card className="shadow-sm hover:shadow-md transition-shadow bg-red-500/10 border-red-600"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle className="text-xs font-medium text-red-700">Críticos (Ruptura Venda)</CardTitle><PackageX className="h-4 w-4 text-red-600" /></CardHeader><CardContent><div className="text-xl font-bold text-red-700">{pillowKPIs.criticalSalesCount}</div></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow bg-orange-500/10 border-orange-600"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle className="text-xs font-medium text-orange-700">Urgentes (Venda Alta)</CardTitle><Zap className="h-4 w-4 text-orange-600" /></CardHeader><CardContent><div className="text-xl font-bold text-orange-700">{pillowKPIs.urgentSalesCount}</div></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow bg-blue-500/10 border-blue-600"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle className="text-xs font-medium text-blue-700">Superestocados (vs Vendas)</CardTitle><Repeat className="h-4 w-4 text-blue-600" /></CardHeader><CardContent><div className="text-xl font-bold text-blue-700">{pillowKPIs.overstockedSalesCount}</div></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow bg-gray-500/10 border-gray-600"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle className="text-xs font-medium text-gray-700">Estagnados (s/ Venda)</CardTitle><MinusCircle className="h-4 w-4 text-gray-600" /></CardHeader><CardContent><div className="text-xl font-bold text-gray-700">{pillowKPIs.noSalesCount}</div></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow col-span-full sm:col-span-1 bg-green-500/10 border-green-600"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle className="text-xs font-medium text-green-700">Total Reposição Sugerida</CardTitle><PlusCircle className="h-4 w-4 text-green-600" /></CardHeader><CardContent><div className="text-xl font-bold text-green-700">{pillowKPIs.totalReplenishmentSuggestion.toLocaleString()} un.</div></CardContent></Card>
                         <Card className="shadow-sm hover:shadow-md transition-shadow col-span-full sm:col-span-2"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1"><CardTitle className="text-xs font-medium">Cobertura Alvo (Vendas)</CardTitle><HelpCircle className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-md font-semibold">{PILLOW_TARGET_COVERAGE_DAYS} dias</div><p className="text-xs text-muted-foreground">Ideal para estoque baseado em vendas 30d.</p></CardContent></Card>

                    </div>
                )}
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center"><ListFilter className="mr-2 h-5 w-5 text-primary" />Controles de Visualização</CardTitle>
              <CardDescription>Filtre e ordene as colunas de travesseiros para uma análise mais detalhada.</CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="searchPillow">Buscar por nome do travesseiro:</Label>
                <Input id="searchPillow" type="text" placeholder="Ex: Plumi Gold, Gellou..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="mt-1" disabled={pillowProducts.length === 0 && !noPillowsFoundInExcel} />
              </div>
              <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="stockStatusFilter">Filtrar por Status (Base Vendas)</Label>
                  <Select value={stockStatusFilter} onValueChange={(value) => setStockStatusFilter(value as StockStatusFilter)} disabled={pillowProducts.length === 0 && !noPillowsFoundInExcel}>
                    <SelectTrigger id="stockStatusFilter" className="mt-1"><SelectValue placeholder="Filtrar status..." /></SelectTrigger>
                    <SelectContent>
                      {salesStatusFilterOptions.map(opt => (
                        <SelectItem key={opt.value} value={opt.value}>
                          <div className="flex items-center">
                            {opt.icon && <opt.icon className="mr-2 h-4 w-4" />}
                            {opt.label}
                          </div>
                        </SelectItem>
                      ))}
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sortCriteria">Ordenar por</Label>
                  <Select value={sortCriteria} onValueChange={(value) => setSortCriteria(value as SortCriteria)} disabled={pillowProducts.length === 0 && !noPillowsFoundInExcel}>
                    <SelectTrigger id="sortCriteria" className="mt-1"><SelectValue placeholder="Ordenar por..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="salesBasedStatus">Status (Base Vendas)</SelectItem>
                      <SelectItem value="name">Nome do Travesseiro</SelectItem>
                      <SelectItem value="stock">Estoque Atual</SelectItem>
                      <SelectItem value="daysOfStock">Dias de Estoque (vs Vendas)</SelectItem>
                      <SelectItem value="sales30d">Vendas 30d</SelectItem>
                      <SelectItem value="openOrders">Pedidos em Aberto</SelectItem>
                      <SelectItem value="replenishmentSuggestionForSales">Sugestão Reposição</SelectItem>
                      <SelectItem value="stockVsIdealFactor">% Estoque vs Ideal Vendas</SelectItem>
                      <SelectItem value="fillPercentage">Preenchimento Visual Coluna</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sortOrder">Ordem</Label>
                  <Button variant="outline" className="w-full mt-1 flex items-center justify-between" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')} disabled={pillowProducts.length === 0 && !noPillowsFoundInExcel}>
                    <span>{sortOrder === 'asc' ? 'Ascendente' : 'Descendente'}</span>
                    {sortOrder === 'asc' ? <SortAsc className="h-4 w-4" /> : <SortDesc className="h-4 w-4" />}
                  </Button>
                </div>
              </div>
            </CardContent>
          </Card>

          {noPillowsFoundInExcel && (
            <Card className="shadow-md my-6 border-blue-500/50 border-l-4"><CardHeader><CardTitle className="flex items-center text-blue-700">
                  <AlertTriangle className="mr-2 h-5 w-5" />Nenhum Travesseiro nos Dados</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Nenhum produto com "Tipo. Produto" igual a "{PILLOW_PRODUCT_TYPE_EXCEL}" foi encontrado nos dados carregados.</p>
                <p className="text-muted-foreground mt-2">Verifique os dados carregados no Dashboard ou o filtro de tipo de produto.</p></CardContent></Card>
          )}

          {!noPillowsFoundInExcel && aggregatedPillowStockState.length === 0 && (searchTerm || stockStatusFilter !== 'all') && (
             <Card className="shadow-md my-6"><CardHeader><CardTitle className="flex items-center">
                  <PackageSearch className="mr-2 h-5 w-5" />Nenhum Travesseiro Encontrado</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Nenhum travesseiro corresponde aos filtros ou termo de busca atuais. Tente ajustar os filtros.</p></CardContent></Card>
          )}

          {aggregatedPillowStockState.length > 0 && (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center"><BedDouble className="mr-2 h-5 w-5 text-primary" /> Colunas de Estoque de Travesseiros (Análise de Vendas)</CardTitle>
                    <CardDescription>Visualização com base no desempenho de vendas. Máx. visual: {MAX_STOCK_PER_PILLOW_COLUMN} un./coluna. Cobertura alvo: {PILLOW_TARGET_COVERAGE_DAYS} dias.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-7 gap-4 p-4 rounded-lg bg-muted/20">
                    {aggregatedPillowStockState.map((pillow) => (
                        <PillowStackColumn
                        key={`${pillow.name}-${pillow.derivation}`}
                        pillowName={pillow.name}
                        productDerivation={pillow.derivation}
                        currentStock={pillow.stock}
                        maxStock={MAX_STOCK_PER_PILLOW_COLUMN} // Visual max
                        sales30d={pillow.sales30d}
                        openOrders={pillow.openOrders}
                        dailyAverageSales={pillow.dailyAverageSales}
                        daysOfStock={pillow.daysOfStock}
                        replenishmentSuggestionForSales={pillow.replenishmentSuggestionForSales}
                        salesBasedStatus={pillow.salesBasedStatus}
                        />
                    ))}
                    </div>
                </CardContent>
            </Card>
          )}
        </>
        </TooltipProvider>
      )}
    </div>
  );
}

