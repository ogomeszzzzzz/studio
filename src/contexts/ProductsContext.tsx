
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
  const [isLoadingProducts, setIsLoadingProducts] = useState(true); // Start true
  const [productsError, setProductsError] = useState<string | null>(null);
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const fetchProductsAndMetadata = useCallback(async (showToastOnRefetch = false) => {
    console.log("ProductsContext: fetchProductsAndMetadata called. CurrentUser:", !!currentUser);
    if (!currentUser) {
      console.log("ProductsContext: No current user, clearing product data and stopping load.");
      setProducts([]);
      setLastDataUpdateTimestamp(null);
      setIsLoadingProducts(false); 
      setProductsError(null);
      return;
    }

    if (firestoreClientInitializationError) {
      const errorMsg = `Cliente Firebase não inicializado: ${firestoreClientInitializationError}.`;
      console.error("ProductsContext: Firebase client init error:", errorMsg);
      toast({ title: "Erro Crítico de Configuração Firebase (Contexto Produtos)", description: errorMsg, variant: "destructive", duration: Infinity });
      setIsLoadingProducts(false);
      setProductsError(firestoreClientInitializationError);
      setProducts([]);
      return;
    }
    if (!firestore) {
      const errorMsg = "Instância do Firestore não está disponível.";
      console.error("ProductsContext: Firestore instance not available:", errorMsg);
      toast({ title: "Erro Crítico de Conexão (Contexto Produtos)", description: errorMsg, variant: "destructive", duration: Infinity });
      setIsLoadingProducts(false);
      setProductsError(errorMsg);
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
      setProducts([]); 
    } finally {
      setIsLoadingProducts(false);
      console.log("ProductsContext: Finished fetching products and metadata, isLoadingProducts set to false.");
    }
  }, [currentUser, toast]); // Removed firestoreClientInitializationError, firestore from deps as they are module-level constants

  useEffect(() => {
    console.log(`ProductsContext useEffect trigger: isAuthLoading: ${isAuthLoading}, currentUser: ${!!currentUser}, productsError: ${productsError}`);
    if (!isAuthLoading) {
      if (currentUser) {
        // Only fetch if products haven't been loaded yet OR if there was a previous error and we might want to retry
        if (products.length === 0 || productsError) { 
          console.log("ProductsContext useEffect: Auth loaded, user present. Fetching products (initial load or retry).");
          fetchProductsAndMetadata();
        } else {
           console.log("ProductsContext useEffect: Auth loaded, user present. Products already loaded and no error.");
           setIsLoadingProducts(false); // Ensure loading is false if data already exists
        }
      } else {
        // No user, clear data and stop loading
        console.log("ProductsContext useEffect: Auth loaded, no user. Clearing data.");
        setProducts([]);
        setLastDataUpdateTimestamp(null);
        setIsLoadingProducts(false);
        setProductsError(null);
      }
    } else {
      console.log("ProductsContext useEffect: Auth still loading. isLoadingProducts remains:", isLoadingProducts);
      // If auth is loading, we typically want isLoadingProducts to remain true until auth is resolved.
      // However, if it was already false from a previous state, keep it false unless a new fetch is triggered.
      // This usually means: if (isLoadingProducts) { /* keep true */ }
    }
  }, [currentUser, isAuthLoading, fetchProductsAndMetadata, products.length, productsError]);


  const refetchProducts = useCallback(async () => {
    console.log("ProductsContext: refetchProducts called explicitly.");
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
