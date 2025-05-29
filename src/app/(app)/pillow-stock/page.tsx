
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import { PillowStackColumn } from '@/components/domain/PillowStackColumn';
import type { Product } from '@/types';
import { BedDouble, Loader2, Database, Filter as FilterIcon, AlertTriangle, ShoppingBag, TrendingDown, PackageX, BarChart3, ListFilter, SortAsc, SortDesc } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { clientAuth, firestore } from '@/lib/firebase/config';
import type { User } from 'firebase/auth';
import { collection, getDocs, writeBatch, doc, Timestamp, query } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Button } from '@/components/ui/button';

const FIRESTORE_BATCH_LIMIT = 450;
const PILLOW_PRODUCT_TYPE_EXCEL = "TRAVESSEIRO";
const PILLOW_NAME_PREFIX = "Travesseiro";
const PILLOW_BRAND_NAME = "Altenburg";
const MAX_STOCK_PER_PILLOW_COLUMN = 75; // Updated from 100
const LOW_STOCK_THRESHOLD_PERCENTAGE = 0.25; 
const GOOD_STOCK_THRESHOLD_PERCENTAGE = 0.75; 

type SortCriteria = 'name' | 'stock' | 'fillPercentage';
type SortOrder = 'asc' | 'desc';
type StockStatusFilter = 'all' | 'empty' | 'low' | 'medium' | 'good' | 'overstocked';


interface AggregatedPillow {
  name: string;
  stock: number;
  fillPercentage: number; 
}

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
    if (words.length === 0) return productName; // Fallback if stripping leaves nothing
    else if (words.length === 1) return words[0];
    else return `${words[0]} ${words[1]}`;
  }
  return productName; // Return original if it doesn't start with "Travesseiro"
}


export default function PillowStockPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);
  const [isSavingFirestore, setIsSavingFirestore] = useState(false);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [stockStatusFilter, setStockStatusFilter] = useState<StockStatusFilter>('all');

  useEffect(() => {
    const unsubscribe = clientAuth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (!user) {
        setAllProducts([]);
        setIsLoadingFirestore(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser && allProducts.length === 0 && !isSavingFirestore && !isProcessingExcel) { // Added !isProcessingExcel
      console.log(`PillowStockPage: Fetching products for user UID: ${currentUser.uid} because allProducts is empty.`);
      setIsLoadingFirestore(true);
      const fetchProducts = async () => {
        try {
          const productsCol = collection(firestore, 'users', currentUser.uid, 'products');
          const snapshot = await getDocs(query(productsCol));
          const productsFromDb = snapshot.docs.map(doc => productFromFirestore(doc.data()));
          setAllProducts(productsFromDb);
          if (productsFromDb.length > 0) {
            // Toast might be too noisy if data always loads from DB
            // toast({ title: "Dados Carregados", description: "Dados de produtos carregados do banco de dados." });
          }
        } catch (error) {
          console.error("Error fetching products from Firestore (Pillow Stock):", error);
          toast({ title: "Erro ao Carregar Dados", description: `Não foi possível buscar os produtos: ${(error as Error).message}`, variant: "destructive" });
        } finally {
          setIsLoadingFirestore(false);
        }
      };
      fetchProducts();
    } else if (currentUser && allProducts.length > 0) {
      console.log(`PillowStockPage: Products already loaded for user UID: ${currentUser.uid}. Skipping fetch.`);
      setIsLoadingFirestore(false);
    } else if (!currentUser) {
      setIsLoadingFirestore(false);
    }
  }, [currentUser, toast, allProducts.length, isSavingFirestore, isProcessingExcel]); // Added isProcessingExcel to dependencies

  const saveProductsToFirestore = useCallback(async (productsToSave: Product[]) => {
    if (!currentUser) {
      toast({ title: "Usuário não autenticado", description: "Faça login para salvar os dados.", variant: "destructive" });
      return;
    }
    setIsSavingFirestore(true);
    let totalDeleted = 0, totalAdded = 0;
    try {
      const productsColRef = collection(firestore, 'users', currentUser.uid, 'products');
      const existingDocsSnapshot = await getDocs(query(productsColRef));
      if (!existingDocsSnapshot.empty) {
        for (let i = 0; i < existingDocsSnapshot.docs.length; i += FIRESTORE_BATCH_LIMIT) {
          const batch = writeBatch(firestore);
          const chunk = existingDocsSnapshot.docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
          chunk.forEach(docSnapshot => { batch.delete(docSnapshot.ref); totalDeleted++; });
          await batch.commit();
        }
      }
      if (productsToSave.length > 0) {
        for (let i = 0; i < productsToSave.length; i += FIRESTORE_BATCH_LIMIT) {
          const batch = writeBatch(firestore);
          const chunk = productsToSave.slice(i, i + FIRESTORE_BATCH_LIMIT);
          chunk.forEach(product => { const newDocRef = doc(productsColRef); batch.set(newDocRef, productToFirestore(product)); totalAdded++; });
          await batch.commit();
        }
      }
      setAllProducts(productsToSave);
      toast({ title: "Dados Salvos!", description: `${totalAdded} produtos foram salvos. ${totalDeleted > 0 ? `${totalDeleted} produtos antigos foram removidos.` : ''}` });
    } catch (error) {
      console.error("Error saving products to Firestore (Pillow Stock):", error);
      toast({ title: "Erro ao Salvar", description: `Não foi possível salvar: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsSavingFirestore(false);
    }
  }, [currentUser, toast]);

  const handleExcelDataProcessed = useCallback(async (parsedProducts: Product[]) => {
    setIsProcessingExcel(true); // Set processing excel true
    await saveProductsToFirestore(parsedProducts);
    // setAllProducts(parsedProducts); // Update local state immediately, then save to FS
    setIsProcessingExcel(false); // Set processing excel false
  }, [saveProductsToFirestore]);

  const pillowProducts = useMemo(() => {
    return allProducts.filter(p => p.productType?.toUpperCase() === PILLOW_PRODUCT_TYPE_EXCEL.toUpperCase());
  }, [allProducts]);

  const aggregatedPillowStock = useMemo(() => {
    const pillowStockMap = new Map<string, number>();
    pillowProducts.forEach(pillow => {
        const displayName = derivePillowDisplayName(pillow.name);
        pillowStockMap.set(displayName, (pillowStockMap.get(displayName) || 0) + pillow.stock);
      });

    let derivedPillows: AggregatedPillow[] = Array.from(pillowStockMap.entries())
      .map(([name, stock]) => ({ 
        name, 
        stock,
        fillPercentage: (stock / MAX_STOCK_PER_PILLOW_COLUMN) * 100
      }));

    // Apply search term filter
    if (searchTerm) {
      derivedPillows = derivedPillows.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }

    // Apply stock status filter
    if (stockStatusFilter !== 'all') {
      derivedPillows = derivedPillows.filter(p => {
        const stock = p.stock;
        const lowThreshold = MAX_STOCK_PER_PILLOW_COLUMN * LOW_STOCK_THRESHOLD_PERCENTAGE;
        const goodThreshold = MAX_STOCK_PER_PILLOW_COLUMN * GOOD_STOCK_THRESHOLD_PERCENTAGE;
        switch (stockStatusFilter) {
          case 'empty': return stock === 0;
          case 'low': return stock > 0 && stock < lowThreshold;
          case 'medium': return stock >= lowThreshold && stock < goodThreshold;
          case 'good': return stock >= goodThreshold && stock <= MAX_STOCK_PER_PILLOW_COLUMN;
          case 'overstocked': return stock > MAX_STOCK_PER_PILLOW_COLUMN;
          default: return true;
        }
      });
    }
    
    // Apply sorting
    derivedPillows.sort((a, b) => {
      let comparison = 0;
      if (sortCriteria === 'name') {
        comparison = a.name.localeCompare(b.name);
      } else if (sortCriteria === 'stock') {
        comparison = a.stock - b.stock;
      } else if (sortCriteria === 'fillPercentage') {
        comparison = a.fillPercentage - b.fillPercentage;
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    return derivedPillows;
  }, [pillowProducts, searchTerm, sortCriteria, sortOrder, stockStatusFilter]);

  const pillowKPIs = useMemo(() => {
    if (pillowProducts.length === 0) return { totalPillowSKUs: 0, totalPillowUnits: 0, lowStockPillowTypes: 0, zeroStockPillowTypes: 0, averageStockPerType: 0 };
    
    const allAggregatedPillowsForKPIs = Array.from(
        pillowProducts.reduce((map, pillow) => {
            const displayName = derivePillowDisplayName(pillow.name);
            map.set(displayName, (map.get(displayName) || 0) + pillow.stock);
            return map;
        }, new Map<string, number>()).entries()
    ).map(([name, stock]) => ({ name, stock }));

    const totalPillowSKUs = allAggregatedPillowsForKPIs.length;
    const totalPillowUnits = allAggregatedPillowsForKPIs.reduce((sum, p) => sum + p.stock, 0);
    const lowStockThresholdValue = MAX_STOCK_PER_PILLOW_COLUMN * LOW_STOCK_THRESHOLD_PERCENTAGE;
    const lowStockPillowTypes = allAggregatedPillowsForKPIs.filter(p => p.stock > 0 && p.stock < lowStockThresholdValue).length;
    const zeroStockPillowTypes = allAggregatedPillowsForKPIs.filter(p => p.stock === 0).length;
    const averageStockPerType = totalPillowSKUs > 0 ? parseFloat((totalPillowUnits / totalPillowSKUs).toFixed(1)) : 0;
    return { totalPillowSKUs, totalPillowUnits, lowStockPillowTypes, zeroStockPillowTypes, averageStockPerType };
  }, [pillowProducts]);

  const noPillowsFoundInExcel = useMemo(() => {
    return allProducts.length > 0 && pillowProducts.length === 0;
  }, [allProducts, pillowProducts]);

  const isAnyDataLoading = isLoadingFirestore || isSavingFirestore || isProcessingExcel;
  const lowStockFilterThreshold = (MAX_STOCK_PER_PILLOW_COLUMN * LOW_STOCK_THRESHOLD_PERCENTAGE).toFixed(0);
  const goodStockFilterThreshold = (MAX_STOCK_PER_PILLOW_COLUMN * GOOD_STOCK_THRESHOLD_PERCENTAGE).toFixed(0);


  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <BedDouble className="mr-3 h-8 w-8 text-primary" />
            Controle Analítico de Estoque de Travesseiros
          </h1>
          <p className="text-muted-foreground">
            Visualize o estoque de travesseiros em colunas de empilhamento e analise os principais indicadores.
          </p>
        </div>
      </div>

      <ExcelUploadSection
        onDataParsed={handleExcelDataProcessed}
        onProcessingStart={() => setIsProcessingExcel(true)}
        onProcessingEnd={() => setIsProcessingExcel(false)}
        collectionColumnKey="Descrição Linha Comercial" // This prop isn't strictly used for filtering here, but parser needs it
        cardTitle="1. Carregar/Atualizar Dados da Planilha"
        cardDescription={`Faça o upload da planilha. Os travesseiros serão filtrados pela coluna 'Tipo. Produto' (esperado: "${PILLOW_PRODUCT_TYPE_EXCEL}").`}
        isProcessingParent={isSavingFirestore} // isProcessingExcel is handled internally by this component mostly
      />

      {isAnyDataLoading && (
        <Card className="shadow-lg"><CardHeader><CardTitle className="flex items-center">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
              {isSavingFirestore ? "Salvando..." : (isProcessingExcel ? "Processando..." : "Carregando...")}
            </CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Aguarde.</p></CardContent></Card>
      )}

      {!isAnyDataLoading && allProducts.length === 0 && (
        <Card className="shadow-lg text-center py-10"><CardHeader><CardTitle className="flex items-center justify-center text-xl">
              <Database className="mr-2 h-7 w-7 text-primary" /> Comece Carregando os Dados
            </CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Carregue um arquivo Excel para visualizar o estoque de travesseiros.</p>
            <p className="text-sm text-muted-foreground mt-2">Os dados da planilha serão salvos em seu perfil.</p></CardContent></Card>
      )}

      {!isAnyDataLoading && allProducts.length > 0 && (
        <>
          <Card className="shadow-md border-primary/30 border-l-4">
            <CardHeader><CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary" />Indicadores Chave de Travesseiros</CardTitle></CardHeader>
            <CardContent>
                {pillowProducts.length === 0 && !noPillowsFoundInExcel && (<p className="text-muted-foreground">Nenhum travesseiro encontrado (coluna "Tipo. Produto" diferente de "{PILLOW_PRODUCT_TYPE_EXCEL}").</p>)}
                {noPillowsFoundInExcel && (<p className="text-muted-foreground">Nenhum produto com "Tipo. Produto" igual a "{PILLOW_PRODUCT_TYPE_EXCEL}" foi encontrado na planilha carregada.</p>)}
                {pillowProducts.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Modelos de Travesseiros</CardTitle><BedDouble className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{pillowKPIs.totalPillowSKUs}</div><p className="text-xs text-muted-foreground">Modelos únicos</p></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total em Estoque</CardTitle><ShoppingBag className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{pillowKPIs.totalPillowUnits.toLocaleString()}</div><p className="text-xs text-muted-foreground">Unidades totais</p></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Travesseiros Estoque Baixo</CardTitle><TrendingDown className="h-4 w-4 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{pillowKPIs.lowStockPillowTypes}</div><p className="text-xs text-muted-foreground">Modelos &lt; {lowStockFilterThreshold} unid.</p></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Travesseiros Estoque Zerado</CardTitle><PackageX className="h-4 w-4 text-red-700" /></CardHeader><CardContent><div className="text-2xl font-bold text-red-700">{pillowKPIs.zeroStockPillowTypes}</div><p className="text-xs text-muted-foreground">Modelos sem unidades</p></CardContent></Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Média Estoque/Modelo</CardTitle><BarChart3 className="h-4 w-4 text-muted-foreground" /></CardHeader><CardContent><div className="text-2xl font-bold">{pillowKPIs.averageStockPerType.toLocaleString()}</div><p className="text-xs text-muted-foreground">Unid. médias por modelo</p></CardContent></Card>
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
                  <AlertTriangle className="mr-2 h-5 w-5" />Nenhum Travesseiro na Planilha</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Nenhum produto com "Tipo. Produto" igual a "{PILLOW_PRODUCT_TYPE_EXCEL}" foi encontrado na planilha carregada.</p>
                <p className="text-muted-foreground mt-2">Verifique sua planilha ou carregue uma nova.</p></CardContent></Card>
          )}

          {!noPillowsFoundInExcel && aggregatedPillowStock.length === 0 && (searchTerm || stockStatusFilter !== 'all') && (
             <Card className="shadow-md my-6"><CardHeader><CardTitle className="flex items-center">
                  <FilterIcon className="mr-2 h-5 w-5" />Nenhum Travesseiro Encontrado</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Nenhum travesseiro corresponde aos filtros ou termo de busca atuais. Tente ajustar os filtros.</p></CardContent></Card>
          )}
          
          {aggregatedPillowStock.length > 0 && (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center"><BedDouble className="mr-2 h-5 w-5 text-primary" /> Colunas de Estoque de Travesseiros</CardTitle>
                    <CardDescription>Visualização analítica do estoque de travesseiros (máx. {MAX_STOCK_PER_PILLOW_COLUMN} unidades por coluna). Use os controles acima para filtrar e ordenar.</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 p-4 rounded-lg bg-muted/20">
                    {aggregatedPillowStock.map((pillow) => (
                        <PillowStackColumn
                        key={pillow.name} 
                        pillowName={pillow.name}
                        currentStock={pillow.stock}
                        maxStock={MAX_STOCK_PER_PILLOW_COLUMN}
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
