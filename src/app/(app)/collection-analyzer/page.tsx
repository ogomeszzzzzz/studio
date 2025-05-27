
'use client';

import { useState, useMemo, useCallback } from 'react';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import { FilterControlsSection } from '@/components/domain/FilterControlsSection';
import { ProductDataTableSection } from '@/components/domain/ProductDataTableSection';
import { GapAnalysisSection } from '@/components/domain/GapAnalysisSection';
import type { Product, FilterState } from '@/types';
import { isAfter, isBefore, isValid, parseISO } from 'date-fns';
import { ListChecks } from 'lucide-react';

const ALL_COLLECTIONS_VALUE = "_ALL_COLLECTIONS_";

export default function CollectionGapAnalyzerPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [activeFilters, setActiveFilters] = useState<FilterState | null>(null);
  const [isLoading, setIsLoading] = useState(false); 

  const handleDataParsed = useCallback((data: Product[]) => {
    setAllProducts(data);
    setFilteredProducts(data); 
    setActiveFilters(null); 
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
        const filterDate = filters.startDateFrom;
        tempFiltered = tempFiltered.filter(p => {
            if (!p.collectionStartDate) return false;
            const productDate = p.collectionStartDate instanceof Date ? p.collectionStartDate : parseISO(p.collectionStartDate.toString());
            return isValid(productDate) && !isBefore(productDate, filterDate);
        });
    }
    if (filters.startDateTo) {
        const filterDate = filters.startDateTo;
        tempFiltered = tempFiltered.filter(p => {
            if (!p.collectionStartDate) return false;
            const productDate = p.collectionStartDate instanceof Date ? p.collectionStartDate : parseISO(p.collectionStartDate.toString());
            return isValid(productDate) && !isAfter(productDate, filterDate);
        });
    }
    if (filters.endDateFrom) {
        const filterDate = filters.endDateFrom;
        tempFiltered = tempFiltered.filter(p => {
            if (!p.collectionEndDate) return false;
            const productDate = p.collectionEndDate instanceof Date ? p.collectionEndDate : parseISO(p.collectionEndDate.toString());
            return isValid(productDate) && !isBefore(productDate, filterDate);
        });
    }
    if (filters.endDateTo) {
        const filterDate = filters.endDateTo;
        tempFiltered = tempFiltered.filter(p => {
            if (!p.collectionEndDate) return false;
            const productDate = p.collectionEndDate instanceof Date ? p.collectionEndDate : parseISO(p.collectionEndDate.toString());
            return isValid(productDate) && !isAfter(productDate, filterDate);
        });
    }
    
    setFilteredProducts(tempFiltered);
  }, [allProducts]);

  const handleProcessingStart = () => setIsLoading(true);
  const handleProcessingEnd = () => setIsLoading(false);

  return (
    <div className="space-y-6">
      <ExcelUploadSection 
        onDataParsed={handleDataParsed} 
        onProcessingStart={handleProcessingStart}
        onProcessingEnd={handleProcessingEnd}
        collectionColumnKey="COLEÇÃO" 
        cardTitle="Upload Dados da Coleção (para Gap Analyzer)"
        cardDescription="Carregue um arquivo Excel com detalhes do produto. A coluna 'COLEÇÃO' será usada para agrupar."
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
            cardIcon={ListChecks}
            cardTitle="Dados dos Produtos Filtrados (Gap Analyzer)"
            showVtexIdColumn={true}
            showNameColumn={true}
            showStockColumn={true}
            showCollectionColumn={true}
            showStartDateColumn={true}
            showEndDateColumn={true}
            showStatusColumn={true}
            showReadyToShipColumn={false} // Not primary for this view
            showOrderColumn={false}      // Not primary for this view
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
