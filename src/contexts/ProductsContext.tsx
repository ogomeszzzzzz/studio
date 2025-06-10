
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
    console.log(`[ProductsContext] fetchProductsAndMetadata called. CurrentUser: ${!!currentUser}, showToast: ${showToastOnRefetch}`);
    
    if (!currentUser) {
      console.log("[ProductsContext] No current user. Clearing product data and stopping load.");
      setProducts([]);
      setLastDataUpdateTimestamp(null);
      setIsLoadingProducts(false);
      setProductsError(null);
      return;
    }

    if (firestoreClientInitializationError) {
      const errorMsg = `Cliente Firebase não inicializado: ${firestoreClientInitializationError}.`;
      console.error("[ProductsContext] Firebase client init error:", errorMsg);
      toast({ title: "Erro Crítico de Configuração Firebase (Contexto Produtos)", description: errorMsg, variant: "destructive", duration: Infinity });
      setIsLoadingProducts(false);
      setProductsError(firestoreClientInitializationError);
      setProducts([]);
      return;
    }
    if (!firestore) {
      const errorMsg = "Instância do Firestore não está disponível.";
      console.error("[ProductsContext] Firestore instance not available:", errorMsg);
      toast({ title: "Erro Crítico de Conexão (Contexto Produtos)", description: errorMsg, variant: "destructive", duration: Infinity });
      setIsLoadingProducts(false);
      setProductsError(errorMsg);
      setProducts([]);
      return;
    }

    console.log("[ProductsContext] Attempting to fetch products and metadata for user:", currentUser.email);
    setIsLoadingProducts(true); // Set loading true before fetch
    setProductsError(null);

    try {
      const productsColPath = "shared_products";
      const productsQuery = query(collection(firestore, productsColPath));
      const snapshot = await getDocs(productsQuery);
      const productsFromDb: Product[] = snapshot.docs.map(docSnap => productFromFirestore(docSnap.data()));
      setProducts(productsFromDb);
      console.log(`[ProductsContext] Fetched ${productsFromDb.length} products.`);

      const metadataDocRef = doc(firestore, "app_metadata", "products_metadata");
      const metadataDocSnap = await getDoc(metadataDocRef);
      if (metadataDocSnap.exists()) {
        const data = metadataDocSnap.data();
        if (data.lastUpdatedAt && data.lastUpdatedAt instanceof Timestamp) {
          setLastDataUpdateTimestamp(data.lastUpdatedAt.toDate());
          console.log(`[ProductsContext] Fetched lastDataUpdateTimestamp: ${data.lastUpdatedAt.toDate()}`);
        } else {
          setLastDataUpdateTimestamp(null);
        }
      } else {
        setLastDataUpdateTimestamp(null);
        console.log("[ProductsContext] No products_metadata document found.");
      }
      if (showToastOnRefetch && productsFromDb.length > 0) {
         toast({ title: "Dados de Produtos Atualizados", description: `Cache local recarregado com ${productsFromDb.length} produtos.` });
      } else if (showToastOnRefetch && productsFromDb.length === 0){
         toast({ title: "Dados de Produtos Atualizados", description: "Cache local recarregado, mas nenhum produto encontrado no banco." });
      }
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : String(error);
      console.error("[ProductsContext] Error fetching products or metadata:", error);
      toast({ title: "Erro ao Carregar Dados de Produtos (Contexto)", description: `Não foi possível buscar os produtos: ${errorMessage}`, variant: "destructive" });
      setProductsError(errorMessage);
      setProducts([]); 
    } finally {
      setIsLoadingProducts(false); // Ensure loading is false after fetch attempt
      console.log("[ProductsContext] Finished fetching products and metadata. isLoadingProducts set to false.");
    }
  }, [currentUser, toast]);

  useEffect(() => {
    console.log(`[ProductsContext] Main useEffect. isAuthLoading: ${isAuthLoading}, currentUser: ${!!currentUser}, products.length: ${products.length}, productsError: ${productsError}`);
    if (!isAuthLoading) {
      if (currentUser) {
        // Fetch if products array is empty or there was a previous error
        if (products.length === 0 || productsError) {
          console.log("[ProductsContext] Auth loaded, user present. Fetching products (initial or retry).");
          fetchProductsAndMetadata();
        } else {
          console.log("[ProductsContext] Auth loaded, user present. Products already loaded and no error. Ensuring isLoadingProducts is false.");
          setIsLoadingProducts(false); // Data already present, ensure loading is false
        }
      } else {
        // No user, auth is loaded
        console.log("[ProductsContext] Auth loaded, no user. Clearing product data, ensuring isLoadingProducts is false.");
        setProducts([]);
        setLastDataUpdateTimestamp(null);
        setIsLoadingProducts(false);
        setProductsError(null);
      }
    } else {
      console.log("[ProductsContext] Auth still loading. Setting isLoadingProducts to true.");
      setIsLoadingProducts(true); // Auth is loading, so product data is implicitly loading or waiting
    }
  }, [currentUser, isAuthLoading, fetchProductsAndMetadata, products.length, productsError]); // products.length and productsError help re-trigger if they change to an "empty" or "error" state

  const refetchProducts = useCallback(async () => {
    console.log("[ProductsContext] refetchProducts called explicitly.");
    await fetchProductsAndMetadata(true);
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
