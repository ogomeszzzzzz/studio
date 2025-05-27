
'use client';

import { useState, useMemo, useCallback } from 'react';
// Removed AppHeader import as layout will handle it
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import { FilterControlsSection } from '@/components/domain/FilterControlsSection';
import { ProductDataTableSection } from '@/components/domain/ProductDataTableSection';
import { GapAnalysisSection } from '@/components/domain/GapAnalysisSection';
import type { Product, FilterState } from '@/types';
import { isAfter, isBefore, isValid } from 'date-fns';

const ALL_COLLECTIONS_VALUE = "_ALL_COLLECTIONS_";

export default function CollectionGapAnalyzerPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [activeFilters, setActiveFilters] = useState<FilterState | null>(null);
  const [isLoading, setIsLoading] = useState(false); // General loading for data processing stages

  const handleDataParsed = useCallback((data: Product[]) => {
    setAllProducts(data);
    setFilteredProducts(data); // Initially, filtered products are all products
    setActiveFilters(null); // Reset filters when new data is parsed
  }, []);

  const availableCollections = useMemo(() => {
    const collections = new Set(allProducts.map(p => p.collection).filter(Boolean));
    return Array.from(collections).sort();
  }, [allProducts]);

  const handleFilterChange = useCallback((filters: FilterState) => {
    setActiveFilters(filters);
    let tempFiltered = [...allProducts];

    if (filters.collection && filters.collection !== ALL_COLLECTIONS_VALUE) {
      tempFiltered = tempFiltered.filter(p => p.collection === filters.collection);
    }
    if (filters.stockMin) {
      tempFiltered = tempFiltered.filter(p => p.stock >= parseInt(filters.stockMin, 10));
    }
    if (filters.stockMax) {
      tempFiltered = tempFiltered.filter(p => p.stock <= parseInt(filters.stockMax, 10));
    }
    if (filters.startDateFrom) {
      tempFiltered = tempFiltered.filter(p => p.collectionStartDate && isValid(p.collectionStartDate) && !isBefore(p.collectionStartDate, filters.startDateFrom!));
    }
    if (filters.startDateTo) {
      tempFiltered = tempFiltered.filter(p => p.collectionStartDate && isValid(p.collectionStartDate) && !isAfter(p.collectionStartDate, filters.startDateTo!));
    }
    if (filters.endDateFrom) {
      tempFiltered = tempFiltered.filter(p => p.collectionEndDate && isValid(p.collectionEndDate) && !isBefore(p.collectionEndDate, filters.endDateFrom!));
    }
    if (filters.endDateTo) {
      tempFiltered = tempFiltered.filter(p => p.collectionEndDate && isValid(p.collectionEndDate) && !isAfter(p.collectionEndDate, filters.endDateTo!));
    }
    
    setFilteredProducts(tempFiltered);
  }, [allProducts]);

  const handleProcessingStart = () => setIsLoading(true);
  const handleProcessingEnd = () => setIsLoading(false);

  return (
    // Removed AppHeader as it's now in (app)/layout.tsx
    // The main container styling (mx-auto, p-4 etc.) is now in (app)/layout.tsx's main tag
    <div className="space-y-6">
      <ExcelUploadSection 
        onDataParsed={handleDataParsed} 
        onProcessingStart={handleProcessingStart}
        onProcessingEnd={handleProcessingEnd}
      />

      {allProducts.length > 0 && (
        <>
          <FilterControlsSection
            products={allProducts}
            onFilterChange={handleFilterChange}
            availableCollections={availableCollections}
          />
          <ProductDataTableSection
            products={filteredProducts}
            isLoading={isLoading && filteredProducts.length === 0} 
          />
          <GapAnalysisSection
            productsForAnalysis={filteredProducts}
          />
        </>
      )}
        {allProducts.length === 0 && !isLoading && (
        <div className="text-center py-10 bg-card shadow-md rounded-lg">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Bem-vindo ao Analisador de Gaps de Coleção.
          </h2>
          <p className="text-muted-foreground">
            Por favor, carregue um arquivo Excel para começar.
          </p>
        </div>
      )}
    </div>
  );
}
