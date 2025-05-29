
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import { PillowStackColumn } from '@/components/domain/PillowStackColumn';
import type { Product } from '@/types';
import { BedDouble, Loader2, Database, Filter, AlertTriangle, ShoppingBag, TrendingDown, PackageX, BarChart3 } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { clientAuth, firestore } from '@/lib/firebase/config';
import type { User } from 'firebase/auth';
import { collection, getDocs, writeBatch, doc, Timestamp, query } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const FIRESTORE_BATCH_LIMIT = 450;
const PILLOW_PRODUCT_TYPE_EXCEL = "TRAVESSEIRO"; // Case-insensitive comparison will be used for Excel's 'Tipo. Produto'
const PILLOW_NAME_PREFIX = "Travesseiro"; // For derivePillowDisplayName
const PILLOW_BRAND_NAME = "Altenburg"; // For derivePillowDisplayName
const MAX_STOCK_PER_PILLOW_COLUMN = 100;
const LOW_STOCK_THRESHOLD_PERCENTAGE = 0.25; // 25% of MAX_STOCK_PER_PILLOW_COLUMN

interface AggregatedPillow {
  name: string;
  stock: number;
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

  if (!productName.trim()) {
    return "Sem Nome";
  }

  let name = productName.trim();

  // Case-insensitive check for "Travesseiro" prefix
  if (name.toLowerCase().startsWith(PILLOW_NAME_PREFIX.toLowerCase())) {
    name = name.substring(PILLOW_NAME_PREFIX.length).trim();

    // Case-insensitive check for "Altenburg" prefix
    if (name.toLowerCase().startsWith(PILLOW_BRAND_NAME.toLowerCase())) {
      const brandNameLength = PILLOW_BRAND_NAME.length;
      // Ensure "Altenburg" is a whole word or followed by a space
      if (name.length === brandNameLength || (name.length > brandNameLength && name[brandNameLength] === ' ')) {
         name = name.substring(brandNameLength).trim();
      }
    }
    
    // Split into words and take the first two (if they exist)
    const words = name.split(/\s+/).filter(word => word.length > 0); // Filter out empty strings from multiple spaces

    if (words.length === 0) {
        // If only "Travesseiro" or "Travesseiro Altenburg" was present
        return productName; // Fallback to original full name
    } else if (words.length === 1) {
      return words[0]; // e.g., "Gellou"
    } else { 
      return `${words[0]} ${words[1]}`; // e.g., "Plumi Gold"
    }
  }
  // If it doesn't start with "Travesseiro", return the original name
  return productName;
}


export default function PillowStockPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);
  const [isSavingFirestore, setIsSavingFirestore] = useState(false);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();
  const [searchTerm, setSearchTerm] = useState('');

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
    if (currentUser && allProducts.length === 0 && !isSavingFirestore && !isLoadingFirestore) {
      console.log(`PillowStockPage: Fetching products for user UID: ${currentUser.uid} because allProducts is empty.`);
      setIsLoadingFirestore(true);
      const fetchProducts = async () => {
        try {
          const productsCol = collection(firestore, 'users', currentUser.uid, 'products');
          const snapshot = await getDocs(query(productsCol));
          const productsFromDb = snapshot.docs.map(doc => productFromFirestore(doc.data()));
          setAllProducts(productsFromDb);
          if (productsFromDb.length > 0) {
            toast({ title: "Dados Carregados", description: "Dados de produtos carregados do banco de dados." });
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
  }, [currentUser, toast, allProducts.length, isSavingFirestore, isLoadingFirestore]);

  const saveProductsToFirestore = useCallback(async (productsToSave: Product[]) => {
    if (!currentUser) {
      toast({ title: "Usuário não autenticado", description: "Faça login para salvar os dados.", variant: "destructive" });
      return;
    }
    console.log(`PillowStockPage: Saving products for user UID: ${currentUser.uid}`);
    setIsSavingFirestore(true);
    let totalDeleted = 0;
    let totalAdded = 0;
    try {
      const productsColRef = collection(firestore, 'users', currentUser.uid, 'products');
      const existingProductsQuery = query(productsColRef);
      const existingDocsSnapshot = await getDocs(existingProductsQuery);
      if (!existingDocsSnapshot.empty) {
        console.log(`PillowStockPage: Deleting ${existingDocsSnapshot.docs.length} existing documents in chunks of ${FIRESTORE_BATCH_LIMIT}.`);
        for (let i = 0; i < existingDocsSnapshot.docs.length; i += FIRESTORE_BATCH_LIMIT) {
          const batch = writeBatch(firestore);
          const chunk = existingDocsSnapshot.docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
          chunk.forEach(docSnapshot => { batch.delete(docSnapshot.ref); totalDeleted++; });
          await batch.commit();
          console.log(`PillowStockPage: Committed a batch of ${chunk.length} deletions.`);
        }
        console.log(`PillowStockPage: Successfully deleted ${totalDeleted} existing products.`);
      }
      if (productsToSave.length > 0) {
        console.log(`PillowStockPage: Adding ${productsToSave.length} new products in chunks of ${FIRESTORE_BATCH_LIMIT}.`);
        for (let i = 0; i < productsToSave.length; i += FIRESTORE_BATCH_LIMIT) {
          const batch = writeBatch(firestore);
          const chunk = productsToSave.slice(i, i + FIRESTORE_BATCH_LIMIT);
          chunk.forEach(product => { const newDocRef = doc(productsColRef); batch.set(newDocRef, productToFirestore(product)); totalAdded++; });
          await batch.commit();
          console.log(`PillowStockPage: Committed a batch of ${chunk.length} additions.`);
        }
        console.log(`PillowStockPage: Successfully added ${totalAdded} new products.`);
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
    setIsProcessingExcel(true); // Indicate processing starts before saving
    await saveProductsToFirestore(parsedProducts);
    setIsProcessingExcel(false); // Indicate processing ends after saving
  }, [saveProductsToFirestore]);

  const handleProcessingStart = () => setIsProcessingExcel(true);
  const handleProcessingEnd = () => setIsProcessingExcel(false);

  const pillowProducts = useMemo(() => {
    return allProducts.filter(p => p.productType?.toUpperCase() === PILLOW_PRODUCT_TYPE_EXCEL.toUpperCase());
  }, [allProducts]);

  const aggregatedPillowStock = useMemo(() => {
    const pillowStockMap = new Map<string, number>();
    pillowProducts.forEach(pillow => {
        // Use the derived display name for aggregation
        const displayName = derivePillowDisplayName(pillow.name);
        pillowStockMap.set(displayName, (pillowStockMap.get(displayName) || 0) + pillow.stock);
      });
    
    // Sort alphabetically by the derived display name
    const sortedPillows: AggregatedPillow[] = Array.from(pillowStockMap.entries())
      .map(([name, stock]) => ({ name, stock }))
      .sort((a, b) => a.name.localeCompare(b.name)); 

    // Apply search term if present
    if (searchTerm) {
      return sortedPillows.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return sortedPillows;
  }, [pillowProducts, searchTerm]);

  const pillowKPIs = useMemo(() => {
    if (pillowProducts.length === 0) {
      return {
        totalPillowSKUs: 0,
        totalPillowUnits: 0,
        lowStockPillowTypes: 0,
        zeroStockPillowTypes: 0,
        averageStockPerType: 0,
      };
    }

    // Use the non-filtered aggregatedPillowStock for KPIs related to *types* of pillows
    // to get a true sense of all pillow types, not just the searched ones.
    const allAggregatedPillows = Array.from(
        pillowProducts.reduce((map, pillow) => {
            const displayName = derivePillowDisplayName(pillow.name);
            map.set(displayName, (map.get(displayName) || 0) + pillow.stock);
            return map;
        }, new Map<string, number>()).entries()
    ).map(([name, stock]) => ({ name, stock }));


    const totalPillowSKUs = allAggregatedPillows.length;
    const totalPillowUnits = allAggregatedPillows.reduce((sum, p) => sum + p.stock, 0);
    
    const lowStockThreshold = MAX_STOCK_PER_PILLOW_COLUMN * LOW_STOCK_THRESHOLD_PERCENTAGE;
    const lowStockPillowTypes = allAggregatedPillows.filter(p => p.stock > 0 && p.stock < lowStockThreshold).length;
    const zeroStockPillowTypes = allAggregatedPillows.filter(p => p.stock === 0).length;
    const averageStockPerType = totalPillowSKUs > 0 ? parseFloat((totalPillowUnits / totalPillowSKUs).toFixed(1)) : 0;

    return {
      totalPillowSKUs,
      totalPillowUnits,
      lowStockPillowTypes,
      zeroStockPillowTypes,
      averageStockPerType,
    };
  }, [pillowProducts]);

  const noPillowsFoundInExcel = useMemo(() => {
    // This means data was loaded (allProducts > 0) but no pillows were found (pillowProducts === 0)
    return allProducts.length > 0 && pillowProducts.length === 0;
  }, [allProducts, pillowProducts]);

  const isAnyDataLoading = isLoadingFirestore || isSavingFirestore || isProcessingExcel;

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
        onProcessingStart={handleProcessingStart}
        onProcessingEnd={handleProcessingEnd}
        collectionColumnKey="Descrição Linha Comercial" // Not directly used for pillow page logic but required by component
        cardTitle="1. Carregar/Atualizar Dados da Planilha"
        cardDescription={`Faça o upload da planilha de produtos. Os dados substituirão os existentes. Os travesseiros serão filtrados pela coluna 'Tipo. Produto' (esperado: "${PILLOW_PRODUCT_TYPE_EXCEL}").`}
        isProcessingParent={isSavingFirestore || isProcessingExcel}
      />

      {isAnyDataLoading && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />
              {isSavingFirestore ? "Salvando dados..." : (isProcessingExcel ? "Processando planilha..." : "Carregando dados...")}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Por favor, aguarde.</p>
          </CardContent>
        </Card>
      )}

      {!isAnyDataLoading && allProducts.length === 0 && (
        <Card className="shadow-lg text-center py-10">
          <CardHeader>
            <CardTitle className="flex items-center justify-center text-xl">
              <Database className="mr-2 h-7 w-7 text-primary" />
              Comece Carregando os Dados
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Carregue um arquivo Excel para visualizar o estoque de travesseiros.
            </p>
            <p className="text-sm text-muted-foreground mt-2">Os dados serão salvos em seu perfil.</p>
          </CardContent>
        </Card>
      )}

      {!isAnyDataLoading && allProducts.length > 0 && (
        <>
          <Card className="shadow-md border-primary/30 border-l-4">
            <CardHeader>
                <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary" />Indicadores Chave de Travesseiros</CardTitle>
            </CardHeader>
            <CardContent>
                {pillowProducts.length === 0 && !noPillowsFoundInExcel && (
                     <p className="text-muted-foreground">Nenhum travesseiro encontrado nos dados carregados para exibir indicadores. Verifique a coluna "Tipo. Produto" na sua planilha.</p>
                )}
                {noPillowsFoundInExcel && (
                    <p className="text-muted-foreground">Nenhum produto com "Tipo. Produto" igual a "{PILLOW_PRODUCT_TYPE_EXCEL}" foi encontrado na planilha para exibir indicadores.</p>
                )}
                {pillowProducts.length > 0 && (
                    <div className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-5 gap-4">
                        <Card className="shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Tipos de Travesseiros</CardTitle>
                                <BedDouble className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{pillowKPIs.totalPillowSKUs}</div>
                                <p className="text-xs text-muted-foreground">Modelos únicos identificados</p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Total em Estoque</CardTitle>
                                <ShoppingBag className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{pillowKPIs.totalPillowUnits.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground">Unidades totais de travesseiros</p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Travesseiros Estoque Baixo</CardTitle>
                                <TrendingDown className="h-4 w-4 text-destructive" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-destructive">{pillowKPIs.lowStockPillowTypes}</div>
                                <p className="text-xs text-muted-foreground">Modelos com &lt; {MAX_STOCK_PER_PILLOW_COLUMN * LOW_STOCK_THRESHOLD_PERCENTAGE} unid.</p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Travesseiros Estoque Zerado</CardTitle>
                                <PackageX className="h-4 w-4 text-red-700" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold text-red-700">{pillowKPIs.zeroStockPillowTypes}</div>
                                <p className="text-xs text-muted-foreground">Modelos sem nenhuma unidade</p>
                            </CardContent>
                        </Card>
                        <Card className="shadow-sm hover:shadow-md transition-shadow">
                            <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                                <CardTitle className="text-sm font-medium">Média Estoque/Tipo</CardTitle>
                                <BarChart3 className="h-4 w-4 text-muted-foreground" />
                            </CardHeader>
                            <CardContent>
                                <div className="text-2xl font-bold">{pillowKPIs.averageStockPerType.toLocaleString()}</div>
                                <p className="text-xs text-muted-foreground">Unidades médias por modelo único</p>
                            </CardContent>
                        </Card>
                    </div>
                )}
            </CardContent>
          </Card>


          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="mr-2 h-5 w-5 text-primary" />
                Filtrar Visualização de Travesseiros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="searchPillow">Buscar por nome do travesseiro (após processamento do nome):</Label>
              <Input
                id="searchPillow"
                type="text"
                placeholder="Digite para buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1"
                disabled={pillowProducts.length === 0 && !noPillowsFoundInExcel}
              />
            </CardContent>
          </Card>

          {noPillowsFoundInExcel && (
            <Card className="shadow-md my-6 border-blue-500/50 border-l-4">
                <CardHeader>
                    <CardTitle className="flex items-center text-blue-700">
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        Nenhum Travesseiro Encontrado na Planilha
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Nenhum produto com "Tipo. Produto" igual a "{PILLOW_PRODUCT_TYPE_EXCEL}" foi encontrado na planilha carregada.
                    </p>
                    <p className="text-muted-foreground mt-2">
                        Verifique sua planilha ou carregue uma nova contendo travesseiros. Os KPIs e as colunas de empilhamento não serão exibidos.
                    </p>
                </CardContent>
            </Card>
          )}

          {!noPillowsFoundInExcel && aggregatedPillowStock.length === 0 && searchTerm && (
             <Card className="shadow-md my-6">
                <CardHeader>
                    <CardTitle className="flex items-center">
                        <Filter className="mr-2 h-5 w-5" />
                        Nenhum Travesseiro Encontrado para "{searchTerm}"
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Nenhum travesseiro corresponde à sua busca. Tente um termo diferente.
                    </p>
                </CardContent>
            </Card>
          )}
          
          {aggregatedPillowStock.length > 0 && (
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center"><BedDouble className="mr-2 h-5 w-5 text-primary" /> Colunas de Estoque de Travesseiros</CardTitle>
                    <CardDescription>Cada coluna representa um tipo de travesseiro e seu estoque atual (máx. {MAX_STOCK_PER_PILLOW_COLUMN} unidades por coluna).</CardDescription>
                </CardHeader>
                <CardContent>
                    <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 p-4 rounded-lg bg-muted/20">
                    {aggregatedPillowStock.map((pillow) => (
                        <PillowStackColumn
                        key={pillow.name} 
                        pillowName={pillow.name}
                        currentStock={pillow.stock}
                        maxStock={MAX_STOCK_PER_PILLOW_COLUMN} // Passa o máximo para o componente
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

