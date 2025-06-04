
'use client';

import type { ReactNode } from 'react';
import { createContext, useContext, useState, useEffect, useCallback } from 'react';
import type { Product } from '@/types';
import { firestore, firestoreClientInitializationError } from '@/lib/firebase/config';
import { collection, getDocs, doc, Timestamp, query, getDoc } from 'firebase/firestore';
import { useAuth } from './AuthContext';
import { useToast } from '@/hooks/use-toast';

interface ProductsContextType {
  products: Product[];
  lastDataUpdateTimestamp: Date | null;
  isLoadingProducts: boolean;
  productsError: string | null;
  refetchProducts: () => Promise<void>;
}

const ProductsContext = createContext<ProductsContextType | undefined>(undefined);

const productFromFirestore = (data: any): Product => {
  return {
    ...data,
    collectionStartDate: data.collectionStartDate instanceof Timestamp ? data.collectionStartDate.toDate() : null,
    collectionEndDate: data.collectionEndDate instanceof Timestamp ? data.collectionEndDate.toDate() : null,
  } as Product;
};

export function ProductsProvider({ children }: { children: ReactNode }) {
  const [products, setProducts] = useState<Product[]>([]);
  const [lastDataUpdateTimestamp, setLastDataUpdateTimestamp] = useState<Date | null>(null);
  const [isLoadingProducts, setIsLoadingProducts] = useState(true);
  const [productsError, setProductsError] = useState<string | null>(null);
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const fetchProductsAndMetadata = useCallback(async (showToastOnRefetch = false) => {
    if (!currentUser) {
      console.log("ProductsContext: No current user, clearing product data.");
      setProducts([]);
      setLastDataUpdateTimestamp(null);
      setIsLoadingProducts(false); // Ensure loading stops if no user
      setProductsError(null);
      return;
    }

    if (firestoreClientInitializationError) {
      toast({ title: "Erro Crítico de Configuração Firebase (Contexto Produtos)", description: `Cliente Firebase não inicializado: ${firestoreClientInitializationError}.`, variant: "destructive", duration: Infinity });
      setIsLoadingProducts(false);
      setProductsError(firestoreClientInitializationError);
      setProducts([]);
      return;
    }
    if (!firestore) {
      toast({ title: "Erro Crítico de Conexão (Contexto Produtos)", description: "Instância do Firestore não está disponível.", variant: "destructive", duration: Infinity });
      setIsLoadingProducts(false);
      setProductsError("Instância do Firestore não disponível.");
      setProducts([]);
      return;
    }

    console.log("ProductsContext: Attempting to fetch products and metadata for user:", currentUser.email);
    setIsLoadingProducts(true);
    setProductsError(null);

    try {
      const productsColPath = "shared_products";
      const productsQuery = query(collection(firestore, productsColPath));
      const snapshot = await getDocs(productsQuery);
      const productsFromDb: Product[] = snapshot.docs.map(docSnap => productFromFirestore(docSnap.data()));
      setProducts(productsFromDb);
      console.log(`ProductsContext: Fetched ${productsFromDb.length} products.`);

      const metadataDocRef = doc(firestore, "app_metadata", "products_metadata");
      const metadataDocSnap = await getDoc(metadataDocRef);
      if (metadataDocSnap.exists()) {
        const data = metadataDocSnap.data();
        if (data.lastUpdatedAt && data.lastUpdatedAt instanceof Timestamp) {
          setLastDataUpdateTimestamp(data.lastUpdatedAt.toDate());
          console.log(`ProductsContext: Fetched lastDataUpdateTimestamp: ${data.lastUpdatedAt.toDate()}`);
        } else {
          setLastDataUpdateTimestamp(null);
        }
      } else {
        setLastDataUpdateTimestamp(null);
        console.log("ProductsContext: No products_metadata document found.");
      }
      if (showToastOnRefetch && productsFromDb.length > 0) {
         toast({ title: "Dados de Produtos Atualizados", description: `Cache local recarregado com ${productsFromDb.length} produtos.` });
      } else if (showToastOnRefetch && productsFromDb.length === 0){
         toast({ title: "Dados de Produtos Atualizados", description: "Cache local recarregado, mas nenhum produto encontrado no banco." });
      }

    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("ProductsContext: Error fetching products or metadata:", error);
      toast({ title: "Erro ao Carregar Dados de Produtos (Contexto)", description: `Não foi possível buscar os produtos: ${errorMessage}`, variant: "destructive" });
      setProductsError(errorMessage);
      setProducts([]); // Clear products on error
    } finally {
      setIsLoadingProducts(false);
      console.log("ProductsContext: Finished fetching products and metadata, isLoadingProducts set to false.");
    }
  }, [currentUser, toast]);

  useEffect(() => {
    console.log(`ProductsContext useEffect: isAuthLoading: ${isAuthLoading}, currentUser: ${!!currentUser}`);
    if (!isAuthLoading && currentUser) {
      // Fetch only if products haven't been loaded yet or user changed
      // This simple check might need refinement if user switching is frequent without page reload
      if (products.length === 0 && !productsError) { // Only fetch if no products and no prior error
          fetchProductsAndMetadata();
      } else if (products.length > 0 && !isLoadingProducts) {
          setIsLoadingProducts(false); // Already loaded
      }
    } else if (!isAuthLoading && !currentUser) {
      // Clear data if user logs out or session ends
      setProducts([]);
      setLastDataUpdateTimestamp(null);
      setIsLoadingProducts(false); // Not loading if no user
      setProductsError(null);
    }
  }, [currentUser, isAuthLoading, fetchProductsAndMetadata, products.length, productsError, isLoadingProducts]);

  const refetchProducts = useCallback(async () => {
    console.log("ProductsContext: refetchProducts called.");
    await fetchProductsAndMetadata(true); // showToastOnRefetch = true
  }, [fetchProductsAndMetadata]);

  return (
    <ProductsContext.Provider value={{ products, lastDataUpdateTimestamp, isLoadingProducts, productsError, refetchProducts }}>
      {children}
    </ProductsContext.Provider>
  );
}

export function useProducts() {
  const context = useContext(ProductsContext);
  if (context === undefined) {
    throw new Error('useProducts must be used within a ProductsProvider');
  }
  return context;
}
