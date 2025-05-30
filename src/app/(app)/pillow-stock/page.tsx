
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { PillowStackColumn } from '@/components/domain/PillowStackColumn';
import type { Product } from '@/types';
import { BedDouble, Loader2, Database, Filter as FilterIcon, AlertTriangle, ShoppingBag, TrendingDown, PackageX, BarChart3, ListFilter, SortAsc, SortDesc, Clock, Zap } from 'lucide-react';
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


const PILLOW_PRODUCT_TYPE_EXCEL = "TRAVESSEIRO";
const PILLOW_NAME_PREFIX = "Travesseiro";
const PILLOW_BRAND_NAME = "Altenburg";
const MAX_STOCK_PER_PILLOW_COLUMN = 75;
const LOW_STOCK_THRESHOLD_PERCENTAGE = 0.25;
const GOOD_STOCK_THRESHOLD_PERCENTAGE = 0.75;
const HIGH_SALES_THRESHOLD = 10;
const LOW_DAYS_OF_STOCK_THRESHOLD = 7;


type SortCriteria = 'name' | 'stock' | 'fillPercentage' | 'sales30d';
type SortOrder = 'asc' | 'desc';
type StockStatusFilter = 'all' | 'empty' | 'low' | 'medium' | 'good' | 'overstocked' | 'critical';


interface AggregatedPillow {
  name: string;
  stock: number;
  fillPercentage: number;
  derivation?: string;
  vtexId?: string | number;
  sales30d: number;
  isCritical?: boolean;
  isUrgent?: boolean;
}

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

  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('all');


  useEffect(() => {
    if (isAuthLoading) {
      console.log("PillowStockPage: Auth context is loading...");
      if (allProducts.length === 0) setIsLoadingFirestore(true);
      return;
    }

    if (firestoreClientInitializationError) {
      toast({ title: "Erro de Configuração", description: `Firebase client não inicializado: ${firestoreClientInitializationError}`, variant: "destructive", duration: Infinity });
      setIsLoadingFirestore(false);
      return;
    }
    if (!firestore) {
      toast({ title: "Erro de Configuração", description: "Instância do Firestore não está disponível.", variant: "destructive", duration: Infinity });
      setIsLoadingFirestore(false);
      return;
    }

    if (currentUser) {
      if (allProducts.length === 0) {
        console.log(`PillowStockPage: Attempting to fetch products for user email: ${currentUser.email}`);
        setIsLoadingFirestore(true);
        const fetchProducts = async () => {
          try {
            const productsColPath = `user_products/${currentUser.email}/uploaded_products`;
            const productsQuery = query(collection(firestore, productsColPath));
            const snapshot = await getDocs(productsQuery);
            const productsFromDb: Product[] = snapshot.docs.map(docSnap => productFromFirestore(docSnap.data()));
            setAllProducts(productsFromDb);

            const metadataDocRef = doc(firestore, `user_products/${currentUser.email}/uploaded_products`, '_metadata');
            const metadataDocSnap = await getDoc(metadataDocRef);
            if (metadataDocSnap.exists()) {
              const data = metadataDocSnap.data();
              if (data.lastUpdatedAt && data.lastUpdatedAt instanceof Timestamp) {
                setLastDataUpdateTimestamp(data.lastUpdatedAt.toDate());
              }
            }
          } catch (error) {
            console.error("Error fetching products from Firestore (Pillow Stock):", error);
            toast({ title: "Erro ao Carregar Dados", description: `Não foi possível buscar os produtos: ${(error as Error).message}`, variant: "destructive" });
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
      setLastDataUpdateTimestamp(null);
    }
  }, [currentUser, isAuthLoading, allProducts.length, toast]);

  const pillowProducts = useMemo(() => {
    return allProducts.filter(p => p.productType?.toUpperCase() === PILLOW_PRODUCT_TYPE_EXCEL.toUpperCase());
  }, [allProducts]);

  useEffect(() => {
    const pillowStockMap = new Map<string, { stock: number; derivation?: string; vtexId?: string | number; sales30d: number }>();
    pillowProducts.forEach(pillow => {
        const displayName = derivePillowDisplayName(pillow.name);
        const currentPillowData = pillowStockMap.get(displayName) || {
            stock: 0,
            derivation: pillow.productDerivation || String(pillow.productId || pillow.vtexId || ''),
            vtexId: pillow.vtexId,
            sales30d: 0,
        };
        currentPillowData.stock += pillow.stock;
        currentPillowData.sales30d += (pillow.sales30d || 0);

        if (!pillowStockMap.has(displayName)) { 
            currentPillowData.derivation = pillow.productDerivation || String(pillow.productId || pillow.vtexId || '');
            currentPillowData.vtexId = pillow.vtexId;
        }
        pillowStockMap.set(displayName, currentPillowData);
    });

    let derivedPillows: AggregatedPillow[] = Array.from(pillowStockMap.entries())
      .map(([name, data]) => {
        const fillPercentage = (data.stock / MAX_STOCK_PER_PILLOW_COLUMN) * 100;
        const daysOfStock = data.sales30d > 0 ? (data.stock / (data.sales30d / 30)) : Infinity;
        
        const isCritical = data.stock === 0 && data.sales30d > 0;
        const isUrgent = data.stock > 0 && data.stock < (MAX_STOCK_PER_PILLOW_COLUMN * LOW_STOCK_THRESHOLD_PERCENTAGE) && 
                         (data.sales30d > HIGH_SALES_THRESHOLD || (daysOfStock < LOW_DAYS_OF_STOCK_THRESHOLD && data.sales30d > 0));

        return {
          name,
          stock: data.stock,
          derivation: data.derivation,
          vtexId: data.vtexId,
          fillPercentage,
          sales30d: data.sales30d,
          isCritical,
          isUrgent,
        };
      });

    if (searchTerm) {
      derivedPillows = derivedPillows.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    if (stockStatusFilter !== 'all') {
      derivedPillows = derivedPillows.filter(p => {
        const stock = p.stock;
        const lowThreshold = MAX_STOCK_PER_PILLOW_COLUMN * LOW_STOCK_THRESHOLD_PERCENTAGE;
        const goodThreshold = MAX_STOCK_PER_PILLOW_COLUMN * GOOD_STOCK_THRESHOLD_PERCENTAGE;
        switch (stockStatusFilter) {
          case 'critical': return !!p.isCritical || !!p.isUrgent;
          case 'empty': return stock === 0;
          case 'low': return stock > 0 && stock < lowThreshold;
          case 'medium': return stock >= lowThreshold && stock < goodThreshold;
          case 'good': return stock >= goodThreshold && stock <= MAX_STOCK_PER_PILLOW_COLUMN;
          case 'overstocked': return stock > MAX_STOCK_PER_PILLOW_COLUMN;
          default: return true;
        }
      });
    }

    derivedPillows.sort((a, b) => {
      let comparison = 0;
      if (sortCriteria === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortCriteria === 'stock') {
        comparison = a.stock - b.stock;
      } else if (sortCriteria === 'fillPercentage') {
        comparison = a.fillPercentage - b.fillPercentage;
      } else if (sortCriteria === 'sales30d') {
        comparison = (a.sales30d || 0) - (b.sales30d || 0);
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });
    setAggregatedPillowStockState(derivedPillows);
  }, [pillowProducts, searchTerm, sortCriteria, sortOrder, stockStatusFilter]);


  const pillowKPIs = useMemo(() => {
    if (pillowProducts.length === 0) return { totalPillowSKUs: 0, totalPillowUnits: 0, lowStockPillowTypes: 0, zeroStockPillowTypes: 0, averageStockPerType: 0, criticalPillowsCount: 0 };

    const uniquePillowDisplays = aggregatedPillowStockState; 

    const totalPillowSKUs = uniquePillowDisplays.length;
    const totalPillowUnits = uniquePillowDisplays.reduce((sum, p) => sum + p.stock, 0);
    
    const lowStockThresholdValue = MAX_STOCK_PER_PILLOW_COLUMN * LOW_STOCK_THRESHOLD_PERCENTAGE;
    const lowStockPillowTypes = uniquePillowDisplays.filter(p => p.stock > 0 && p.stock < lowStockThresholdValue && !p.isCritical && !p.isUrgent).length;
    const zeroStockPillowTypes = uniquePillowDisplays.filter(p => p.stock === 0 && !p.isCritical).length; 
    const averageStockPerType = totalPillowSKUs > 0 ? parseFloat((totalPillowUnits / totalPillowSKUs).toFixed(1)) : 0;
    const criticalPillowsCount = uniquePillowDisplays.filter(p => p.isCritical || p.isUrgent).length;
    
    return { totalPillowSKUs, totalPillowUnits, lowStockPillowTypes, zeroStockPillowTypes, averageStockPerType, criticalPillowsCount };
  }, [pillowProducts, aggregatedPillowStockState]);

  const noPillowsFoundInExcel = useMemo(() => {
    return allProducts.length > 0 && pillowProducts.length === 0;
  }, [allProducts, pillowProducts]);

  const displayLoader = (isLoadingFirestore || isAuthLoading) && allProducts.length === 0;
  const lowStockFilterThreshold = (MAX_STOCK_PER_PILLOW_COLUMN * LOW_STOCK_THRESHOLD_PERCENTAGE).toFixed(0);
  const goodStockFilterThreshold = (MAX_STOCK_PER_PILLOW_COLUMN * GOOD_STOCK_THRESHOLD_PERCENTAGE).toFixed(0);


  if (displayLoader) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando dados...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <BedDouble className="mr-3 h-8 w-8 text-primary" />
            Controle Analítico de Estoque de Travesseiros
          </h1>
          <p className="text-muted-foreground">
            Visualize o estoque de travesseiros em colunas de empilhamento. Os dados são carregados do último upload feito no Dashboard.
          </p>
        </div>
      </div>
      {lastDataUpdateTimestamp && (
        <div className="text-sm text-muted-foreground flex items-center">
            <Clock className="mr-2 h-4 w-4" />
            Última atualização dos dados: {formatDateFns(lastDataUpdateTimestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
        </div>
      )}

      {!isLoadingFirestore && !isAuthLoading && allProducts.length === 0 && (
        <Card className="shadow-lg text-center py-10"><CardHeader><CardTitle className="flex items-center justify-center text-xl">
              <Database className="mr-2 h-7 w-7 text-primary" /> Sem dados para exibir
            </CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Por favor, carregue um arquivo Excel na página do Dashboard para visualizar o estoque de travesseiros.</p>
            <p className="text-sm text-muted-foreground mt-2">Os dados da planilha serão salvos em seu perfil e carregados aqui.</p></CardContent></Card>
      )}

      {!isLoadingFirestore && !isAuthLoading && allProducts.length > 0 && (
        <>
          <Card className="shadow-md border-primary/30 border-l-4">
            <CardHeader><CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary" />Indicadores Chave de Travesseiros</CardTitle></CardHeader>
            <CardContent>
                {pillowProducts.length === 0 && !noPillowsFoundInExcel && (<p className="text-muted-foreground">Nenhum travesseiro encontrado (coluna "Tipo. Produto" diferente de "{PILLOW_PRODUCT_TYPE_EXCEL}").</p>)}
                {noPillowsFoundInExcel && (<p className="text-muted-foreground">Nenhum produto com "Tipo. Produto" igual a "{PILLOW_PRODUCT_TYPE_EXCEL}" foi encontrado nos dados carregados.</p>)}
                {pillowProducts.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-3 gap-4">
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Modelos de Travesseiros</CardTitle><BedDouble className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{pillowKPIs.totalPillowSKUs}</div><p className="text-xs text-muted-foreground">Modelos únicos</p></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total em Estoque</CardTitle><ShoppingBag className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{pillowKPIs.totalPillowUnits.toLocaleString()}</div><p className="text-xs text-muted-foreground">Unidades totais</p></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow bg-destructive/10 border-destructive"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium text-destructive">Travesseiros Críticos</CardTitle><Zap className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{pillowKPIs.criticalPillowsCount}</div><p className="text-xs text-destructive/80">Ruptura ou Urgência!</p></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Travesseiros com Estoque Baixo</CardTitle><TrendingDown className="h-4 w-4 text-amber-600" /></CardHeader><CardContent><div className="text-2xl font-bold text-amber-700">{pillowKPIs.lowStockPillowTypes}</div><p className="text-xs text-muted-foreground">&lt; {lowStockFilterThreshold} unid. (não críticos)</p></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Travesseiros com Estoque Zerado</CardTitle><PackageX className="h-4 w-4 text-red-700" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-700">{pillowKPIs.zeroStockPillowTypes}</div><p className="text-xs text-muted-foreground">Modelos sem unid. (e sem vendas)</p></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Média Estoque/Modelo</CardTitle><BarChart3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{pillowKPIs.averageStockPerType.toLocaleString()}</div><p className="text-xs text-muted-foreground">Unid. médias por modelo de travesseiro.</p></CardContent></Card>
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
                  <Label htmlFor="stockStatusFilter">Filtrar por Status do Estoque</Label>
                  <Select value={stockStatusFilter} onValueChange={(value) => setStockStatusFilter(value as StockStatusFilter)} disabled={pillowProducts.length === 0 && !noPillowsFoundInExcel}>
                    <SelectTrigger id="stockStatusFilter" className="mt-1"><SelectValue placeholder="Filtrar status..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="all">Todos</SelectItem>
                      <SelectItem value="critical">Críticos (Ruptura/Urgência)</SelectItem>
                      <SelectItem value="empty">Vazio (0 unidades)</SelectItem>
                      <SelectItem value="low">Estoque Baixo (&lt; {lowStockFilterThreshold} unidades)</SelectItem>
                      <SelectItem value="medium">Estoque Médio ({lowStockFilterThreshold}-{(Number(goodStockFilterThreshold)-1).toFixed(0)} unidades)</SelectItem>
                      <SelectItem value="good">Estoque Bom (&ge; {goodStockFilterThreshold} unidades)</SelectItem>
                      <SelectItem value="overstocked">Superestocado (&gt; {MAX_STOCK_PER_PILLOW_COLUMN} unidades)</SelectItem>
                    </SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sortCriteria">Ordenar por</Label>
                  <Select value={sortCriteria} onValueChange={(value) => setSortCriteria(value as SortCriteria)} disabled={pillowProducts.length === 0 && !noPillowsFoundInExcel}>
                    <SelectTrigger id="sortCriteria" className="mt-1"><SelectValue placeholder="Ordenar por..." /></SelectTrigger>
                    <SelectContent>
                      <SelectItem value="name">Nome do Travesseiro</SelectItem>
                      <SelectItem value="stock">Estoque Atual</SelectItem>
                      <SelectItem value="fillPercentage">Percentual Preenchido</SelectItem>
                      <SelectItem value="sales30d">Vendas 30d</SelectItem>
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
                  <FilterIcon className="mr-2 h-5 w-5" />Nenhum Travesseiro Encontrado</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Nenhum travesseiro corresponde aos filtros ou termo de busca atuais. Tente ajustar os filtros.</p></CardContent></Card>
          )}

          {aggregatedPillowStockState.length > 0 && (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center"><BedDouble className="mr-2 h-5 w-5 text-primary" /> Colunas de Estoque de Travesseiros</CardTitle>
                    <CardDescription>Visualização analítica do estoque de travesseiros (máx. {MAX_STOCK_PER_PILLOW_COLUMN} unidades por coluna). Use os controles acima para filtrar e ordenar.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 p-4 rounded-lg bg-muted/20">
                    {aggregatedPillowStockState.map((pillow) => (
                        <PillowStackColumn
                        key={`${pillow.name}-${pillow.derivation}`}
                        pillowName={pillow.name}
                        productDerivation={pillow.derivation}
                        currentStock={pillow.stock}
                        maxStock={MAX_STOCK_PER_PILLOW_COLUMN}
                        sales30d={pillow.sales30d}
                        isCritical={pillow.isCritical}
                        isUrgent={pillow.isUrgent}
                        />
                    ))}
                    </div>
                </CardContent>
            </Card>
          )}
        </>
      )}
    </div>
  );
}

    
