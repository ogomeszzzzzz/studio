
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import { FilterControlsSection } from '@/components/domain/FilterControlsSection';
import { ProductDataTableSection } from '@/components/domain/ProductDataTableSection';
import type { Product, FilterState } from '@/types';
import { PackageSearch, AlertTriangle, Download, TrendingUp, PackageCheck, ListFilter, HelpCircle, Loader2, Database, ClipboardList, CheckSquare, Square } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { clientAuth, firestore } from '@/lib/firebase/config';
import type { User } from 'firebase/auth';
import { collection, getDocs, writeBatch, doc, Timestamp, query } from 'firebase/firestore';


const ALL_COLLECTIONS_VALUE = "_ALL_COLLECTIONS_";
const ALL_PRODUCT_TYPES_VALUE = "_ALL_PRODUCT_TYPES_";
const DEFAULT_LOW_STOCK_THRESHOLD = 10;
const FIRESTORE_BATCH_LIMIT = 450; 

type VtexIdStatusFilter = "all" | "withVtexId" | "withoutVtexId";

const productToFirestore = (product: Product): any => {
  return {
    ...product,
    collectionStartDate: product.collectionStartDate ? Timestamp.fromDate(product.collectionStartDate) : null,
    collectionEndDate: product.collectionEndDate ? Timestamp.fromDate(product.collectionEndDate) : null,
  };
};

const productFromFirestore = (data: any): Product => {
  return {
    ...data,
    collectionStartDate: data.collectionStartDate ? (data.collectionStartDate as Timestamp).toDate() : null,
    collectionEndDate: data.collectionEndDate ? (data.collectionEndDate as Timestamp).toDate() : null,
  } as Product;
};


export default function RestockOpportunitiesPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [baseFilters, setBaseFilters] = useState<FilterState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState<string>(DEFAULT_LOW_STOCK_THRESHOLD.toString());
  const [vtexIdStatusFilter, setVtexIdStatusFilter] = useState<VtexIdStatusFilter>("all");
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);
  const [isSavingFirestore, setIsSavingFirestore] = useState(false);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);


  useEffect(() => {
    const unsubscribe = clientAuth.onAuthStateChanged((user) => {
      setCurrentUser(user);
       if (!user) {
        setAllProducts([]); 
        setFilteredProducts([]);
        setIsLoadingFirestore(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser) {
      console.log(`RestockOpportunitiesPage: Fetching products for user UID: ${currentUser.uid}`); 
      const fetchProducts = async () => {
        setIsLoadingFirestore(true);
        try {
          const productsCol = collection(firestore, 'users', currentUser.uid, 'products');
          const snapshot = await getDocs(query(productsCol));
          const productsFromDb = snapshot.docs.map(doc => productFromFirestore(doc.data()));
          setAllProducts(productsFromDb);
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
        setAllProducts([]);
        setFilteredProducts([]);
        setIsLoadingFirestore(false);
    }
  }, [currentUser, toast]);

 const saveProductsToFirestore = useCallback(async (productsToSave: Product[]) => {
    if (!currentUser) {
      toast({ title: "Usuário não autenticado", description: "Faça login para salvar os dados.", variant: "destructive" });
      return;
    }
    console.log(`RestockOpportunitiesPage: Saving products for user UID: ${currentUser.uid}`);
    setIsSavingFirestore(true);
    let totalDeleted = 0;
    let totalAdded = 0;

    try {
      const productsColRef = collection(firestore, 'users', currentUser.uid, 'products');
      
      const existingProductsQuery = query(productsColRef);
      const existingDocsSnapshot = await getDocs(existingProductsQuery);
      
      if (!existingDocsSnapshot.empty) {
        const deletePromises: Promise<void>[] = [];
        console.log(`RestockOpportunitiesPage: Deleting ${existingDocsSnapshot.docs.length} existing documents in chunks of ${FIRESTORE_BATCH_LIMIT}.`);
        for (let i = 0; i < existingDocsSnapshot.docs.length; i += FIRESTORE_BATCH_LIMIT) {
          const batch = writeBatch(firestore);
          const chunk = existingDocsSnapshot.docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
          chunk.forEach(docSnapshot => {
            batch.delete(docSnapshot.ref);
            totalDeleted++;
          });
          deletePromises.push(batch.commit());
        }
        await Promise.all(deletePromises);
        console.log(`RestockOpportunitiesPage: Successfully deleted ${totalDeleted} existing products.`);
      }

      if (productsToSave.length > 0) {
        const addPromises: Promise<void>[] = [];
        console.log(`RestockOpportunitiesPage: Adding ${productsToSave.length} new products in chunks of ${FIRESTORE_BATCH_LIMIT}.`);
        for (let i = 0; i < productsToSave.length; i += FIRESTORE_BATCH_LIMIT) {
          const batch = writeBatch(firestore);
          const chunk = productsToSave.slice(i, i + FIRESTORE_BATCH_LIMIT);
          chunk.forEach(product => {
            const newDocRef = doc(productsColRef); 
            batch.set(newDocRef, productToFirestore(product));
            totalAdded++;
          });
          addPromises.push(batch.commit());
        }
        await Promise.all(addPromises);
        console.log(`RestockOpportunitiesPage: Successfully added ${totalAdded} new products.`);
      }
      
      setAllProducts(productsToSave); 
      toast({ title: "Dados Salvos!", description: `${totalAdded} produtos foram salvos. ${totalDeleted > 0 ? `${totalDeleted} produtos antigos foram removidos.` : ''}` });

    } catch (error) {
      console.error("Error saving products to Firestore (Restock):", error);
      toast({ title: "Erro ao Salvar", description: `Não foi possível salvar: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsSavingFirestore(false);
    }
  },[currentUser, toast]);

  const handleExcelDataProcessed = useCallback(async (parsedProducts: Product[]) => {
    setIsProcessingExcel(true); 
    await saveProductsToFirestore(parsedProducts);
    setIsProcessingExcel(false); 
  }, [saveProductsToFirestore]);


  const availableCollections = useMemo(() => {
    const collections = new Set(allProducts.map(p => p.collection).filter(Boolean).sort((a,b) => (a as string).localeCompare(b as string)));
    return Array.from(collections);
  }, [allProducts]);

  const availableProductTypes = useMemo(() => {
    const productTypes = new Set(allProducts.map(p => p.productType).filter(Boolean).sort((a,b) => (a as string).localeCompare(b as string)));
    return Array.from(productTypes);
  }, [allProducts]);

  const applyAllFilters = useCallback(() => {
    setIsLoading(true);
    console.log("Applying filters with baseFilters:", baseFilters, "lowStockThreshold:", lowStockThreshold, "vtexIdStatusFilter:", vtexIdStatusFilter);
    let tempFiltered = [...allProducts];
    const effectiveThreshold = parseInt(lowStockThreshold, 10);

    const currentThreshold = isNaN(effectiveThreshold) || lowStockThreshold.trim() === '' ? DEFAULT_LOW_STOCK_THRESHOLD : effectiveThreshold;
    if (isNaN(effectiveThreshold) && lowStockThreshold.trim() !== '') {
        toast({ title: "Aviso", description: `Limite de baixo estoque inválido, usando padrão: ${DEFAULT_LOW_STOCK_THRESHOLD}.`, variant: "default" });
    }

    // Apply ID VTEX status filter
    if (vtexIdStatusFilter === "withVtexId") {
      tempFiltered = tempFiltered.filter(p => 
        p.vtexId && String(p.vtexId).trim() !== '' && String(p.vtexId).toUpperCase() !== '#N/D'
      );
    } else if (vtexIdStatusFilter === "withoutVtexId") {
      tempFiltered = tempFiltered.filter(p => 
        !p.vtexId || String(p.vtexId).trim() === '' || String(p.vtexId).toUpperCase() === '#N/D'
      );
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

    // Apply core restock opportunity logic
    tempFiltered = tempFiltered.filter(p =>
        p.stock <= currentThreshold &&
        (p.readyToShip > 0 || p.regulatorStock > 0) &&
        p.openOrders === 0 
    );
    console.log("Filtered products count:", tempFiltered.length);
    setFilteredProducts(tempFiltered);
    setIsLoading(false);
  }, [allProducts, baseFilters, lowStockThreshold, vtexIdStatusFilter, toast]);


  const handleBaseFilterChange = useCallback((filters: FilterState) => {
    setBaseFilters(filters);
  }, []);

  useEffect(() => {
   if(allProducts.length > 0 || baseFilters !== null || vtexIdStatusFilter !== "all") {
    applyAllFilters();
   } else if (!isLoadingFirestore) { 
    setFilteredProducts([]);
   }
  }, [allProducts, lowStockThreshold, baseFilters, vtexIdStatusFilter, applyAllFilters, isLoadingFirestore]);

  const handleProcessingStart = () => setIsProcessingExcel(true);
  const handleProcessingEnd = () => setIsProcessingExcel(false);


  const summaryStats = useMemo(() => {
    const totalSkusToRestock = filteredProducts.length;
    const totalUnitsAvailableForRestock = filteredProducts.reduce((sum, p) => sum + p.readyToShip + p.regulatorStock, 0);
    const potentialStockAtRiskUnits = filteredProducts.reduce((sum, p) => {
      if (p.stock === 0) return sum + p.readyToShip + p.regulatorStock;
      return sum + Math.max(0, (p.readyToShip + p.regulatorStock) - p.stock);
    }, 0);

    return {
      totalSkusToRestock,
      totalUnitsAvailableForRestock,
      potentialStockAtRiskUnits
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
      "ID VTEX": p.vtexId,
      "Nome Produto": p.name,
      "Produto-Derivação": p.productDerivation,
      "Estoque Atual": p.stock,
      "Pronta Entrega": p.readyToShip,
      "Regulador": p.regulatorStock,
      "Pedidos em Aberto": p.openOrders, 
      "Coleção (Desc. Linha Comercial)": p.collection,
      "Descrição (Estampa)": p.description,
      "Tamanho": p.size,
      "Tipo Produto": p.productType,
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

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
                <TrendingUp className="mr-3 h-8 w-8 text-primary" />
                Oportunidades de Reabastecimento
            </h1>
            <p className="text-muted-foreground">
                Identifique produtos com baixo estoque que possuem unidades em "Pronta Entrega" ou "Regulador" para reposição, e que não possuam "Pedidos em Aberto".
            </p>
        </div>
      </div>

      <ExcelUploadSection
        onDataParsed={handleExcelDataProcessed}
        onProcessingStart={handleProcessingStart}
        onProcessingEnd={handleProcessingEnd}
        collectionColumnKey="Descrição Linha Comercial"
        cardTitle="1. Carregar/Atualizar Dados do Excel"
        cardDescription="Faça o upload da planilha de produtos. Os dados substituirão os existentes em seu perfil."
        isProcessingParent={isSavingFirestore || isProcessingExcel}
      />
      
      {(isLoadingFirestore || isSavingFirestore) && (
         <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> 
              {isSavingFirestore ? "Salvando dados..." : "Carregando dados..."}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Por favor, aguarde.</p>
          </CardContent>
        </Card>
      )}


      {!isLoadingFirestore && !isSavingFirestore && allProducts.length === 0 && !isProcessingExcel && (
        <Card className="shadow-lg text-center py-10">
          <CardHeader>
            <CardTitle className="flex items-center justify-center text-xl">
                <Database className="mr-2 h-7 w-7 text-primary" />
                Comece Analisando as Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Carregue um arquivo Excel no passo "1. Carregar Dados do Excel" para identificar produtos com baixo estoque que podem ser reabastecidos.
            </p>
             <p className="text-sm text-muted-foreground mt-2">Se você já carregou dados antes, eles serão buscados automaticamente. Caso contrário, esta mensagem indica que não há dados salvos.</p>
          </CardContent>
        </Card>
      )}

      {!isLoadingFirestore && !isSavingFirestore && allProducts.length > 0 && (
        <>
          <Card className="shadow-md border-primary border-l-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ListFilter className="mr-2 h-5 w-5 text-primary" />
                2. Definir Critérios e Filtros
              </CardTitle>
              <CardDescription>
                Ajuste o limite de estoque para considerar um item como "baixo" e aplique filtros adicionais.
                As oportunidades são itens com estoque atual &lt;= ao limite definido, COM unidades em "Pronta Entrega" ou "Regulador" E SEM "Pedidos em Aberto".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-3 gap-4 items-end">
                    <div>
                        <Label htmlFor="lowStockThreshold" className="flex items-center font-semibold">
                            Estoque Atual Máximo
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <HelpCircle className="ml-1.5 h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Produtos com estoque atual igual ou inferior a este valor serão considerados.</p>
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
                    <div>
                        <Label htmlFor="vtexIdStatusFilter" className="flex items-center font-semibold">
                            Status Cadastro (ID VTEX)
                             <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <HelpCircle className="ml-1.5 h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Filtrar por itens com ou sem cadastro de ID VTEX (exclui #N/D).</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </Label>
                        <Select value={vtexIdStatusFilter} onValueChange={(value) => setVtexIdStatusFilter(value as VtexIdStatusFilter)}>
                            <SelectTrigger id="vtexIdStatusFilter" className="mt-1 text-base">
                                <SelectValue placeholder="Selecionar status do ID VTEX" />
                            </SelectTrigger>
                            <SelectContent>
                                <SelectItem value="all">Todos (Com e Sem ID VTEX)</SelectItem>
                                <SelectItem value="withVtexId">Com ID VTEX (Cadastrado)</SelectItem>
                                <SelectItem value="withoutVtexId">Sem ID VTEX (Não Cadastrado)</SelectItem>
                            </SelectContent>
                        </Select>
                    </div>
                    <Button onClick={applyAllFilters} className="w-full md:w-auto py-2.5 text-base self-end" disabled={isLoading || isSavingFirestore}>
                        {isLoading ? (
                            <Loader2 className="mr-2 h-5 w-5 animate-spin" />
                        ) : (
                            <ListFilter className="mr-2 h-5 w-5" />
                        )}
                        {isLoading ? 'Aplicando...' : 'Aplicar Critérios e Filtros'}
                    </Button>
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
                    3. Resultados da Análise de Reabastecimento
                </CardTitle>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <CardDescription>
                        Visão geral e lista detalhada dos produtos que representam oportunidades de reabastecimento.
                    </CardDescription>
                    <Button onClick={handleExportToExcel} disabled={filteredProducts.length === 0 || isExporting || isLoading || isSavingFirestore} size="sm">
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
                    <Card className="border-green-500 border-l-4 shadow-md hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Unidades Disponíveis (PE+Reg.)</CardTitle>
                            <PackageCheck className="h-5 w-5 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-green-600">{summaryStats.totalUnitsAvailableForRestock.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Total em Pronta Entrega + Regulador.</p>
                        </CardContent>
                    </Card>
                    <Card className="border-destructive border-l-4 shadow-md hover:shadow-lg transition-shadow">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Estoque em Risco (Unidades)</CardTitle>
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-3xl font-bold text-destructive">{summaryStats.potentialStockAtRiskUnits.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Unidades de PE/Regulador que podem faltar se não repostas.</p>
                        </CardContent>
                    </Card>
                </div>

                <ProductDataTableSection
                    products={filteredProducts}
                    isLoading={(isLoading || isSavingFirestore || isLoadingFirestore) && filteredProducts.length === 0}
                    cardIcon={PackageSearch}
                    cardTitle="Produtos com Oportunidade de Reabastecimento"
                    cardDescription="Lista de produtos com baixo estoque atual, disponibilidade em 'Pronta Entrega' ou 'Regulador', e sem 'Pedidos em Aberto'."
                    showVtexIdColumn={true}
                    showNameColumn={true}
                    showProductDerivationColumn={true}
                    showStockColumn={true}
                    showReadyToShipColumn={true}
                    showRegulatorStockColumn={true}
                    showOpenOrdersColumn={true} 
                    showCollectionColumn={true}
                    showDescriptionColumn={true} 
                    showSizeColumn={true}
                    showProductTypeColumn={true}
                    showStatusColumn={true}    
                />
                 {allProducts.length > 0 && filteredProducts.length === 0 && !isLoading && !isSavingFirestore && !isLoadingFirestore && (
                    <Card className="shadow-md my-6 border-blue-500/50 border-l-4">
                        <CardHeader>
                            <CardTitle className="flex items-center text-blue-700">
                                <PackageSearch className="mr-2 h-5 w-5" />
                                Nenhuma Oportunidade Encontrada
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                Nenhum produto com estoque atual &le; <span className="font-semibold">{parseInt(lowStockThreshold, 10) || DEFAULT_LOW_STOCK_THRESHOLD}</span> unidades, com disponibilidade em "Pronta Entrega" ou "Regulador", E sem "Pedidos em Aberto" foi encontrado com os filtros atuais (incluindo status do ID VTEX: {
                                    vtexIdStatusFilter === "withVtexId" ? "Com ID VTEX" : vtexIdStatusFilter === "withoutVtexId" ? "Sem ID VTEX" : "Todos"
                                }).
                            </p>
                            <p className="text-muted-foreground mt-2">
                                Tente ajustar o "Estoque Atual Máximo", o status do ID VTEX, ou os filtros adicionais e clique em "Aplicar Critérios e Filtros".
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

