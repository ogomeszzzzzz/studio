
'use client';

import { useState, useCallback, useEffect, useMemo } from 'react';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import { PillowStackColumn } from '@/components/domain/PillowStackColumn';
import type { Product } from '@/types';
import { BedDouble, Loader2, Database, Filter, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import { clientAuth, firestore } from '@/lib/firebase/config';
import type { User } from 'firebase/auth';
import { collection, getDocs, writeBatch, doc, Timestamp, query } from 'firebase/firestore';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';

const FIRESTORE_BATCH_LIMIT = 450;
const PILLOW_PRODUCT_TYPE = "TRAVESSEIRO"; // Case-insensitive comparison will be used

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
    if (currentUser && allProducts.length === 0 && !isSavingFirestore) {
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
      setIsLoadingFirestore(false);
    } else if (!currentUser) {
      setIsLoadingFirestore(false);
    }
  }, [currentUser, toast, allProducts.length, isSavingFirestore]);

  const saveProductsToFirestore = useCallback(async (productsToSave: Product[]) => {
    if (!currentUser) {
      toast({ title: "Usuário não autenticado", description: "Faça login para salvar os dados.", variant: "destructive" });
      return;
    }
    setIsSavingFirestore(true);
    let totalDeleted = 0;
    let totalAdded = 0;
    try {
      const productsColRef = collection(firestore, 'users', currentUser.uid, 'products');
      const existingProductsQuery = query(productsColRef);
      const existingDocsSnapshot = await getDocs(existingProductsQuery);
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
    setIsProcessingExcel(true);
    await saveProductsToFirestore(parsedProducts);
    setIsProcessingExcel(false);
  }, [saveProductsToFirestore]);

  const handleProcessingStart = () => setIsProcessingExcel(true);
  const handleProcessingEnd = () => setIsProcessingExcel(false);

  const aggregatedPillowStock = useMemo(() => {
    const pillowStockMap = new Map<string, number>();
    allProducts
      .filter(p => p.productType?.toUpperCase() === PILLOW_PRODUCT_TYPE)
      .forEach(pillow => {
        // Using productDerivation for more specific pillow types if available, otherwise name
        const pillowKey = pillow.productDerivation || pillow.name || "Travesseiro Desconhecido";
        pillowStockMap.set(pillowKey, (pillowStockMap.get(pillowKey) || 0) + pillow.stock);
      });
    
    const sortedPillows: AggregatedPillow[] = Array.from(pillowStockMap.entries())
      .map(([name, stock]) => ({ name, stock }))
      .sort((a, b) => a.name.localeCompare(b.name)); // Sort alphabetically by pillow name

    if (searchTerm) {
      return sortedPillows.filter(p => p.name.toLowerCase().includes(searchTerm.toLowerCase()));
    }
    return sortedPillows;
  }, [allProducts, searchTerm]);

  const noPillowsFound = useMemo(() => {
    return allProducts.filter(p => p.productType?.toUpperCase() === PILLOW_PRODUCT_TYPE).length === 0;
  }, [allProducts]);

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <BedDouble className="mr-3 h-8 w-8 text-primary" />
            Controle de Estoque de Travesseiros
          </h1>
          <p className="text-muted-foreground">
            Visualize o estoque de cada tipo de travesseiro em colunas de empilhamento.
          </p>
        </div>
      </div>

      <ExcelUploadSection
        onDataParsed={handleExcelDataProcessed}
        onProcessingStart={handleProcessingStart}
        onProcessingEnd={handleProcessingEnd}
        collectionColumnKey="Descrição Linha Comercial" // Or any other relevant key if needed for general product data
        cardTitle="1. Carregar/Atualizar Dados da Planilha"
        cardDescription="Faça o upload da planilha de produtos. Os dados substituirão os existentes. Os travesseiros serão filtrados pela coluna 'Tipo. Produto'."
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

      {!isLoadingFirestore && !isSavingFirestore && allProducts.length > 0 && (
        <>
          <Card>
            <CardHeader>
              <CardTitle className="flex items-center">
                <Filter className="mr-2 h-5 w-5 text-primary" />
                Filtrar Travesseiros
              </CardTitle>
            </CardHeader>
            <CardContent>
              <Label htmlFor="searchPillow">Buscar por nome do travesseiro:</Label>
              <Input
                id="searchPillow"
                type="text"
                placeholder="Digite para buscar..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="mt-1"
              />
            </CardContent>
          </Card>

          {noPillowsFound && !isProcessingExcel && (
            <Card className="shadow-md my-6 border-blue-500/50 border-l-4">
                <CardHeader>
                    <CardTitle className="flex items-center text-blue-700">
                        <AlertTriangle className="mr-2 h-5 w-5" />
                        Nenhum Travesseiro Encontrado
                    </CardTitle>
                </CardHeader>
                <CardContent>
                    <p className="text-muted-foreground">
                        Nenhum produto com "Tipo. Produto" igual a "{PILLOW_PRODUCT_TYPE}" foi encontrado na planilha carregada.
                    </p>
                    <p className="text-muted-foreground mt-2">
                        Verifique sua planilha ou carregue uma nova contendo travesseiros.
                    </p>
                </CardContent>
            </Card>
          )}

          {!noPillowsFound && aggregatedPillowStock.length === 0 && searchTerm && (
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
            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-6 2xl:grid-cols-8 gap-4 p-4 rounded-lg">
              {aggregatedPillowStock.map((pillow) => (
                <PillowStackColumn
                  key={pillow.name}
                  pillowName={pillow.name}
                  currentStock={pillow.stock}
                  maxStock={100}
                />
              ))}
            </div>
          )}
        </>
      )}
    </div>
  );
}
