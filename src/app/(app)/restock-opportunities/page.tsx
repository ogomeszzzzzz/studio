
'use client';

import { useState, useMemo, useCallback } from 'react';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import { FilterControlsSection } from '@/components/domain/FilterControlsSection';
import { ProductDataTableSection } from '@/components/domain/ProductDataTableSection';
import type { Product, FilterState } from '@/types';
import { isAfter, isBefore, isValid, parseISO } from 'date-fns';
import { PackageSearch, AlertTriangle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';


const ALL_COLLECTIONS_VALUE = "_ALL_COLLECTIONS_";
const DEFAULT_LOW_STOCK_THRESHOLD = 10;

export default function RestockOpportunitiesPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [baseFilters, setBaseFilters] = useState<FilterState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState<string>(DEFAULT_LOW_STOCK_THRESHOLD.toString());


  const handleDataParsed = useCallback((data: Product[]) => {
    setAllProducts(data);
    // Apply initial restock-specific filtering immediately after data parsing
    const effectiveThreshold = parseInt(lowStockThreshold, 10) || DEFAULT_LOW_STOCK_THRESHOLD;
    const initialFiltered = data.filter(p => 
        p.stock <= effectiveThreshold && 
        (p.readyToShip > 0 || p.order > 0)
    );
    setFilteredProducts(initialFiltered);
    setBaseFilters(null); // Reset general filters
  }, [lowStockThreshold]);

  const availableCollections = useMemo(() => {
    const collections = new Set(allProducts.map(p => p.collection).filter(Boolean));
    return Array.from(collections).sort();
  }, [allProducts]);

  const applyAllFilters = useCallback(() => {
    let tempFiltered = [...allProducts];
    const effectiveThreshold = parseInt(lowStockThreshold, 10) || DEFAULT_LOW_STOCK_THRESHOLD;

    // 1. Apply base filters (collection, dates, etc.)
    if (baseFilters) {
      if (baseFilters.collection && baseFilters.collection !== ALL_COLLECTIONS_VALUE) {
        tempFiltered = tempFiltered.filter(p => p.collection === baseFilters.collection);
      }
      if (baseFilters.stockMin) { // Note: stockMin from general filters might conflict with lowStockThreshold concept
        tempFiltered = tempFiltered.filter(p => p.stock >= parseInt(baseFilters.stockMin!, 10));
      }
      // stockMax from general filters is ignored here, as lowStockThreshold takes precedence.
      if (baseFilters.startDateFrom) {
        const filterDate = baseFilters.startDateFrom;
        tempFiltered = tempFiltered.filter(p => {
            if (!p.collectionStartDate) return false;
            const productDate = p.collectionStartDate instanceof Date ? p.collectionStartDate : parseISO(p.collectionStartDate.toString());
            return isValid(productDate) && !isBefore(productDate, filterDate);
        });
      }
      if (baseFilters.startDateTo) {
        const filterDate = baseFilters.startDateTo;
        tempFiltered = tempFiltered.filter(p => {
            if (!p.collectionStartDate) return false;
            const productDate = p.collectionStartDate instanceof Date ? p.collectionStartDate : parseISO(p.collectionStartDate.toString());
            return isValid(productDate) && !isAfter(productDate, filterDate);
        });
      }
      if (baseFilters.endDateFrom) {
        const filterDate = baseFilters.endDateFrom;
        tempFiltered = tempFiltered.filter(p => {
            if (!p.collectionEndDate) return false;
            const productDate = p.collectionEndDate instanceof Date ? p.collectionEndDate : parseISO(p.collectionEndDate.toString());
            return isValid(productDate) && !isBefore(productDate, filterDate);
        });
      }
      if (baseFilters.endDateTo) {
        const filterDate = baseFilters.endDateTo;
        tempFiltered = tempFiltered.filter(p => {
            if (!p.collectionEndDate) return false;
            const productDate = p.collectionEndDate instanceof Date ? p.collectionEndDate : parseISO(p.collectionEndDate.toString());
            return isValid(productDate) && !isAfter(productDate, filterDate);
        });
      }
    }
    
    // 2. Apply the core restock opportunity filter
    tempFiltered = tempFiltered.filter(p => 
        p.stock <= effectiveThreshold && 
        (p.readyToShip > 0 || p.order > 0)
    );
    
    setFilteredProducts(tempFiltered);
  }, [allProducts, baseFilters, lowStockThreshold]);


  const handleBaseFilterChange = useCallback((filters: FilterState) => {
    setBaseFilters(filters);
    // Defer actual filtering to a button click or when lowStockThreshold changes for clarity
  }, []);
  
  // Apply filters when lowStockThreshold changes or explicitly via button
  // useEffect(() => {
  //  applyAllFilters();
  // }, [applyAllFilters]); // Can lead to too many re-renders if not careful

  const handleProcessingStart = () => setIsLoading(true);
  const handleProcessingEnd = () => {
    setIsLoading(false);
    // Re-apply filters after new data is processed and loading ends
    // This ensures the lowStockThreshold and other filters are respected with new data.
    // A slight delay might be good if data parsing is very fast and causes UI flicker.
    setTimeout(applyAllFilters, 0); 
  };
  
  return (
    <div className="space-y-6">
      <ExcelUploadSection 
        onDataParsed={handleDataParsed} 
        onProcessingStart={handleProcessingStart}
        onProcessingEnd={handleProcessingEnd}
        collectionColumnKey="COLEÇÃO" // Using 'COLEÇÃO' for item-level analysis here
        cardTitle="Upload de Dados para Oportunidades de Reabastecimento"
        cardDescription="Carregue o arquivo Excel. Itens com baixo estoque e disponibilidade em 'Pronta Entrega' ou 'Pedido' serão destacados."
      />

      {allProducts.length > 0 && (
        <>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <PackageSearch className="mr-2 h-5 w-5 text-primary" />
                Definir Limite de Baixo Estoque
              </CardTitle>
              <CardDescription>
                Produtos com estoque igual ou inferior a este valor (e com Pronta Entrega ou Pedido > 0) serão mostrados.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex items-end gap-4">
              <div className="flex-grow">
                <Label htmlFor="lowStockThreshold">Estoque Máximo para Considerar Baixo</Label>
                <Input 
                  id="lowStockThreshold"
                  type="number"
                  value={lowStockThreshold}
                  onChange={(e) => setLowStockThreshold(e.target.value)}
                  placeholder={`Padrão: ${DEFAULT_LOW_STOCK_THRESHOLD}`}
                  min="0"
                />
              </div>
              <Button onClick={applyAllFilters}>Aplicar Filtros</Button>
            </CardContent>
          </Card>

          <FilterControlsSection
            products={allProducts}
            onFilterChange={handleBaseFilterChange}
            availableCollections={availableCollections}
            // Hide stockMax from general filters as we use dedicated lowStockThreshold
            // This would require modifying FilterControlsSection or accepting its behavior
          />

          <ProductDataTableSection
            products={filteredProducts}
            isLoading={isLoading && filteredProducts.length === 0}
            cardIcon={PackageSearch}
            cardTitle="Oportunidades de Reabastecimento"
            showVtexIdColumn={true}
            showNameColumn={true}
            showStockColumn={true}
            showReadyToShipColumn={true}
            showOrderColumn={true}
            showCollectionColumn={true}
            showStartDateColumn={false} // Less relevant for this view
            showEndDateColumn={false}   // Less relevant for this view
            showStatusColumn={false}    // Less relevant for this view
          />
        </>
      )}
      {allProducts.length === 0 && !isLoading && (
        <div className="text-center py-10 bg-card shadow-md rounded-lg">
          <h2 className="text-xl font-semibold text-foreground mb-2">
            Oportunidades de Reabastecimento
          </h2>
          <p className="text-muted-foreground">
            Carregue um arquivo Excel para identificar produtos com baixo estoque que podem ser reabastecidos.
          </p>
        </div>
      )}
      {allProducts.length > 0 && filteredProducts.length === 0 && !isLoading && (
         <Card className="shadow-lg my-6">
            <CardHeader>
                <CardTitle className="flex items-center text-destructive">
                    <AlertTriangle className="mr-2 h-5 w-5" />
                    Nenhuma Oportunidade Encontrada
                </CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-muted-foreground">
                    Nenhum produto com estoque baixo (considerando o limite de <span className="font-semibold">{parseInt(lowStockThreshold, 10) || DEFAULT_LOW_STOCK_THRESHOLD}</span> unidades) 
                    e disponibilidade em "Pronta Entrega" ou "Pedido" foi encontrado com os filtros atuais.
                </p>
                <p className="text-muted-foreground mt-2">
                    Tente ajustar o limite de baixo estoque ou os filtros gerais.
                </p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
