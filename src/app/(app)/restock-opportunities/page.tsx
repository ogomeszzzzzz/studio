
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { FilterControlsSection } from '@/components/domain/FilterControlsSection';
import { ProductDataTableSection } from '@/components/domain/ProductDataTableSection';
import type { Product, FilterState } from '@/types';
import { PackageSearch, Download, TrendingUp, ClipboardList, CheckSquare, Loader2, Database, Filter, HelpCircle, ListFilter, Clock } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { firestore, firestoreClientInitializationError } from '@/lib/firebase/config';
import { collection, getDocs, doc, Timestamp, query, getDoc } from 'firebase/firestore';
import { format as formatDateFns, isValid as isDateValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';


const ALL_COLLECTIONS_VALUE = "_ALL_COLLECTIONS_";
const ALL_PRODUCT_TYPES_VALUE = "_ALL_PRODUCT_TYPES_";
const DEFAULT_LOW_STOCK_THRESHOLD = 10;

const productFromFirestore = (data: any): Product => {
  return {
    ...data,
    collectionStartDate: data.collectionStartDate instanceof Timestamp ? data.collectionStartDate.toDate() : null,
    collectionEndDate: data.collectionEndDate instanceof Timestamp ? data.collectionEndDate.toDate() : null,
  } as Product;
};


export default function RestockOpportunitiesPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [baseFilters, setBaseFilters] = useState<FilterState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState<string>(DEFAULT_LOW_STOCK_THRESHOLD.toString());
  const { toast } = useToast();
  const [lastDataUpdateTimestamp, setLastDataUpdateTimestamp] = useState<Date | null>(null);

  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);


  useEffect(() => {
    if (isAuthLoading) {
      console.log("RestockOpportunitiesPage: Auth context is loading...");
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
        console.log(`RestockOpportunitiesPage: Attempting to fetch products for user email: ${currentUser.email}`);
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
            if (productsFromDb.length > 0) {
              toast({ title: "Dados Carregados", description: "Dados de produtos carregados do banco de dados." });
            }
          } catch (error) {
            console.error("Error fetching products from Firestore (Restock):", error);
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
      setFilteredProducts([]);
      setLastDataUpdateTimestamp(null);
    }
  }, [currentUser, isAuthLoading, allProducts.length, toast]);


  const availableCollections = useMemo(() => {
    const collections = new Set(allProducts.map(p => p.collection).filter(Boolean).sort((a,b) => (a as string).localeCompare(b as string)));
    return Array.from(collections);
  }, [allProducts]);

  const availableProductTypes = useMemo(() => {
    const productTypes = new Set(allProducts.map(p => p.productType).filter(Boolean).sort((a,b) => (a as string).localeCompare(b as string)));
    return Array.from(productTypes);
  }, [allProducts]);

  const applyAllFilters = useCallback(() => {
    if (isAuthLoading || isLoadingFirestore) {
        if (!isAuthLoading && !isLoadingFirestore && allProducts.length === 0){
            setFilteredProducts([]);
        }
        return;
    }

    setIsLoading(true);
    console.log("Applying filters with baseFilters:", baseFilters, "lowStockThreshold:", lowStockThreshold);
    let tempFiltered = [...allProducts];
    const effectiveThreshold = parseInt(lowStockThreshold, 10);
    const currentThreshold = isNaN(effectiveThreshold) || lowStockThreshold.trim() === '' ? DEFAULT_LOW_STOCK_THRESHOLD : effectiveThreshold;

    if (isNaN(effectiveThreshold) && lowStockThreshold.trim() !== '') {
        toast({ title: "Aviso", description: `Limite de baixo estoque inválido, usando padrão: ${DEFAULT_LOW_STOCK_THRESHOLD}.`, variant: "default" });
    }

    if (baseFilters) {
      if (baseFilters.collection && baseFilters.collection !== ALL_COLLECTIONS_VALUE) {
        tempFiltered = tempFiltered.filter(p => p.collection === baseFilters.collection);
      }
      if (baseFilters.productType && baseFilters.productType !== ALL_PRODUCT_TYPES_VALUE) {
        tempFiltered = tempFiltered.filter(p => p.productType === baseFilters.productType);
      }
      if (baseFilters.stockMin && baseFilters.stockMin.trim() !== '') {
        const stockMinNum = parseInt(baseFilters.stockMin, 10);
        if (!isNaN(stockMinNum)) {
            tempFiltered = tempFiltered.filter(p => p.stock >= stockMinNum);
        }
      }
      if (baseFilters.stockMax && baseFilters.stockMax.trim() !== '') {
        const stockMaxNum = parseInt(baseFilters.stockMax, 10);
        if (!isNaN(stockMaxNum)) {
            tempFiltered = tempFiltered.filter(p => p.stock <= stockMaxNum);
        }
      }
    }

    tempFiltered = tempFiltered.filter(p =>
        p.stock <= currentThreshold &&
        (p.readyToShip > 0 || (p.regulatorStock || 0) > 0) &&
        (p.openOrders || 0) === 0
    ).map(p => ({
      ...p,
      canRestockAmount: Math.min(Math.max(0, currentThreshold - p.stock), p.readyToShip + (p.regulatorStock || 0))
    }));

    console.log("Filtered products count:", tempFiltered.length);
    setFilteredProducts(tempFiltered);
    setIsLoading(false);
  }, [allProducts, baseFilters, lowStockThreshold, toast, isAuthLoading, isLoadingFirestore]);


  const handleBaseFilterChange = useCallback((filters: FilterState) => {
    setBaseFilters(filters);
  }, []);

  useEffect(() => {
   if(!isAuthLoading && !isLoadingFirestore && allProducts.length > 0) {
    applyAllFilters();
   } else if (!isAuthLoading && !isLoadingFirestore && allProducts.length === 0) {
    setFilteredProducts([]);
   }
  }, [allProducts, lowStockThreshold, baseFilters, applyAllFilters, isAuthLoading, isLoadingFirestore]);


  const summaryStats = useMemo(() => {
    const totalSkusToRestock = filteredProducts.length;
    const totalUnitsInPERegForOpportunities = filteredProducts.reduce((sum, p) => sum + p.readyToShip + (p.regulatorStock || 0), 0);
    const totalUnitsThatCanBeRestocked = filteredProducts.reduce((sum, p) => sum + (p.canRestockAmount || 0), 0);

    return {
      totalSkusToRestock,
      totalUnitsInPERegForOpportunities,
      totalUnitsThatCanBeRestocked
    };
  }, [filteredProducts]);

  const handleExportToExcel = () => {
    if (filteredProducts.length === 0) {
      toast({
        title: "Nenhum Dado para Exportar",
        description: "Não há produtos filtrados para exportar.",
        variant: "default",
      });
      return;
    }
    setIsExporting(true);
    toast({ title: "Exportando...", description: "Gerando arquivo Excel." });

    const dataToExport = filteredProducts.map(p => ({
      "ID VTEX": typeof p.vtexId === 'number' ? p.vtexId : String(p.vtexId ?? ''),
      "Nome Produto": p.name,
      "Produto-Derivação": p.productDerivation,
      "Estoque Atual": p.stock,
      "Pronta Entrega": p.readyToShip,
      "Regulador": p.regulatorStock || 0,
      "Pedidos em Aberto": p.openOrders || 0,
      "Pode Repor (Un.)": p.canRestockAmount || 0,
      "Coleção (Desc. Linha Comercial)": p.collection,
      "Descrição (Estampa)": p.description,
      "Tamanho": p.size,
      "Tipo Produto": p.productType,
      "Status Coleção": getCollectionStatus(p).text,
    }));

    try {
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "OportunidadesReabastecimento");
        XLSX.writeFile(workbook, `Oportunidades_Reabastecimento_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast({
          title: "Exportação Concluída",
          description: "Os dados de oportunidades de reabastecimento foram exportados para Excel.",
        });
    } catch (error) {
        console.error("Erro ao exportar para Excel:", error);
        toast({ title: "Erro na Exportação", description: "Não foi possível gerar o arquivo Excel.", variant: "destructive" });
    } finally {
        setIsExporting(false);
    }
  };

  const handleApplyMainFilters = () => {
    applyAllFilters();
  }

  const displayLoader = (isLoadingFirestore || isAuthLoading) && allProducts.length === 0;

  if (displayLoader) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando dados...</p></div>;
  }


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
                <TrendingUp className="mr-3 h-8 w-8 text-primary" />
                Análise de Oportunidades de Reabastecimento
            </h1>
            <p className="text-muted-foreground">
                Identifique SKUs com baixo estoque que podem ser repostos utilizando unidades de "Pronta Entrega" ou "Regulador".
                <br />
                Os dados são carregados do último upload feito na página do Dashboard.
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
        <Card className="shadow-lg text-center py-10">
          <CardHeader>
            <CardTitle className="flex items-center justify-center text-xl">
                <Database className="mr-2 h-7 w-7 text-primary" />
                Sem Dados para Análise
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Nenhum dado de produto encontrado. Por favor, vá para a página do Dashboard e carregue um arquivo Excel.
            </p>
             <p className="text-sm text-muted-foreground mt-2">Os dados salvos em seu perfil serão carregados automaticamente aqui.</p>
          </CardContent>
        </Card>
      )}

      {!isLoadingFirestore && !isAuthLoading && allProducts.length > 0 && (
        <>
          <Card className="shadow-md border-primary border-l-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ListFilter className="mr-2 h-5 w-5 text-primary" />
                Definir Critérios e Filtros
              </CardTitle>
              <CardDescription>
                Defina o "Estoque Atual Máximo" para identificar itens com baixo estoque.
                As oportunidades são itens com estoque atual &le; ao limite definido, COM unidades em "Pronta Entrega" ou "Regulador" E SEM "Pedidos em Aberto".
                Use os filtros adicionais para refinar sua análise. Clique em "Analisar Oportunidades" para aplicar.
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <Label htmlFor="lowStockThreshold" className="flex items-center font-semibold">
                            Estoque Atual Máximo (para Oportunidade)
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <HelpCircle className="ml-1.5 h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Produtos com estoque atual igual ou inferior a este valor serão considerados para reabastecimento.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </Label>
                        <Input
                        id="lowStockThreshold"
                        type="number"
                        value={lowStockThreshold}
                        onChange={(e) => setLowStockThreshold(e.target.value)}
                        placeholder={`Padrão: ${DEFAULT_LOW_STOCK_THRESHOLD}`}
                        min="0"
                        className="mt-1 text-base"
                        />
                    </div>
                    <div className="md:col-span-2">
                        <Button onClick={handleApplyMainFilters} className="w-full py-2.5 text-base" disabled={isLoading || isLoadingFirestore || isAuthLoading}>
                            {(isLoading && !isLoadingFirestore && !isAuthLoading) ? (
                                <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                            ) : (
                                <Filter className="mr-2 h-5 w-5" />
                            )}
                            {(isLoading && !isLoadingFirestore && !isAuthLoading) ? 'Analisando...' : 'Analisar Oportunidades'}
                        </Button>
                    </div>
                </div>
                <FilterControlsSection
                    products={allProducts}
                    onFilterChange={handleBaseFilterChange}
                    availableCollections={availableCollections}
                    availableProductTypes={availableProductTypes}
                />
            </CardContent>
          </Card>

          <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center">
                    <PackageSearch className="mr-2 h-5 w-5 text-primary" />
                    Resultados da Análise de Reabastecimento
                </CardTitle>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <CardDescription>
                        Visão geral e lista detalhada dos produtos que representam oportunidades de reabastecimento.
                    </CardDescription>
                    <Button onClick={handleExportToExcel} disabled={filteredProducts.length === 0 || isExporting || isLoading || isLoadingFirestore || isAuthLoading} size="sm">
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        {isExporting ? "Exportando..." : "Exportar Lista para Excel"}
                    </Button>
                </div>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-accent border-l-4 shadow-md hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">SKUs para Reabastecer</CardTitle>
                            <PackageSearch className="h-5 w-5 text-accent" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-accent">{summaryStats.totalSkusToRestock.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Produtos únicos identificados.</p>
                        </CardContent>
                    </Card>
                    <Card className="border-blue-500 border-l-4 shadow-md hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Unidades em PE/Regulador (Oportunidades)</CardTitle>
                            <ClipboardList className="h-5 w-5 text-blue-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-blue-600">{summaryStats.totalUnitsInPERegForOpportunities.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Total em Pronta Entrega + Regulador para estes SKUs.</p>
                        </CardContent>
                    </Card>
                    <Card className="border-green-500 border-l-4 shadow-md hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Total Unidades para Reposição</CardTitle>
                            <CheckSquare className="h-5 w-5 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-green-600">{summaryStats.totalUnitsThatCanBeRestocked.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Unidades que podem ser efetivamente repostas de PE/Regulador.</p>
                        </CardContent>
                    </Card>
                </div>

                <ProductDataTableSection
                    products={filteredProducts}
                    isLoading={(isLoading && !isLoadingFirestore && !isAuthLoading) && filteredProducts.length === 0 && allProducts.length > 0}
                    cardIcon={PackageSearch}
                    cardTitle="Produtos com Oportunidade de Reabastecimento"
                    cardDescription="Lista de produtos com baixo estoque, disponibilidade em 'Pronta Entrega' ou 'Regulador', e sem 'Pedidos em Aberto'. Clique nos cabeçalhos para ordenar."
                    showVtexIdColumn={true}
                    showNameColumn={true}
                    showProductDerivationColumn={true}
                    showStockColumn={true}
                    showReadyToShipColumn={true}
                    showRegulatorStockColumn={true}
                    showOpenOrdersColumn={true}
                    showCanRestockAmountColumn={true}
                    lowStockThresholdForRestock={parseInt(lowStockThreshold, 10) || DEFAULT_LOW_STOCK_THRESHOLD}
                    showCollectionColumn={true}
                    showDescriptionColumn={false} 
                    showSizeColumn={true}
                    showProductTypeColumn={true}
                    showStatusColumn={true}
                />
                 {allProducts.length > 0 && filteredProducts.length === 0 && !isLoading && !isLoadingFirestore && !isAuthLoading && (
                    <Card className="shadow-md my-6 border-blue-500/50 border-l-4">
                        <CardHeader>
                            <CardTitle className="flex items-center text-blue-700">
                                <PackageSearch className="mr-2 h-5 w-5" />
                                Nenhuma Oportunidade Encontrada
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                Nenhum produto atendeu aos critérios de oportunidade (Estoque Atual &le; <span className="font-semibold">{parseInt(lowStockThreshold, 10) || DEFAULT_LOW_STOCK_THRESHOLD}</span>,
                                disponibilidade em PE/Regulador, e sem Pedidos em Aberto) com os filtros atuais.
                            </p>
                            <p className="text-muted-foreground mt-2">
                                Tente ajustar o "Estoque Atual Máximo" ou os filtros adicionais e clique em "Analisar Oportunidades".
                            </p>
                        </CardContent>
                    </Card>
                  )}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}

// Helper function for getCollectionStatus
const getCollectionStatus = (product: Product): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline', colorClass?: string } => {
  const today = new Date();
  today.setHours(0,0,0,0);

  const endDateInput = product.collectionEndDate;
  let endDate: Date | null = null;

  if (endDateInput instanceof Date && isDateValid(endDateInput)) {
    endDate = new Date(endDateInput.valueOf()); 
  } else if (typeof endDateInput === 'string') {
    const parsedDate = new Date(endDateInput); // Try parsing common date string formats, or ISO if excel-parser provides that
    if (isDateValid(parsedDate)) {
      endDate = parsedDate;
    }
  }
  
  if (endDate && isDateValid(endDate)) {
    endDate.setHours(0,0,0,0);

    if (endDate < today) {
      return product.stock > 0
        ? { text: 'Coleção Passada (Em Estoque)', variant: 'destructive', colorClass: 'bg-destructive/80 text-destructive-foreground' }
        : { text: 'Coleção Passada (Sem Estoque)', variant: 'outline', colorClass: 'border-muted-foreground text-muted-foreground' };
    }
    const thirtyDaysFromNow = new Date(today);
    thirtyDaysFromNow.setDate(today.getDate() + 30);
    if (endDate < thirtyDaysFromNow) {
      return { text: 'Próximo ao Fim', variant: 'default', colorClass: 'bg-amber-500 text-white' };
    }
  }
  if (product.isCurrentCollection === false && product.stock > 0) {
     return { text: 'Não Atual (Em Estoque)', variant: 'secondary' };
  }
  if (product.isCurrentCollection === true) {
    return { text: 'Coleção Atual', variant: 'default', colorClass: 'bg-primary/80 text-primary-foreground' };
  }
  return { text: 'Status N/A', variant: 'outline' };
};

    
