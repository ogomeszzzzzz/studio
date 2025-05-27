
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import { FilterControlsSection } from '@/components/domain/FilterControlsSection';
import { ProductDataTableSection } from '@/components/domain/ProductDataTableSection';
import type { Product, FilterState } from '@/types';
import { isAfter, isBefore, isValid, parseISO } from 'date-fns';
import { PackageSearch, AlertTriangle, Download } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';


const ALL_COLLECTIONS_VALUE = "_ALL_COLLECTIONS_";
const DEFAULT_LOW_STOCK_THRESHOLD = 10;

export default function RestockOpportunitiesPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [filteredProducts, setFilteredProducts] = useState<Product[]>([]);
  const [baseFilters, setBaseFilters] = useState<FilterState | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [lowStockThreshold, setLowStockThreshold] = useState<string>(DEFAULT_LOW_STOCK_THRESHOLD.toString());
  const { toast } = useToast();

  const handleDataParsed = useCallback((data: Product[]) => {
    setAllProducts(data);
    // Apply initial restock-specific filtering immediately after data parsing
    // This will be re-applied by applyAllFilters called in onProcessingEnd
  }, []);

  const availableCollections = useMemo(() => {
    const collections = new Set(allProducts.map(p => p.collection).filter(Boolean));
    return Array.from(collections).sort();
  }, [allProducts]);

  const applyAllFilters = useCallback(() => {
    let tempFiltered = [...allProducts];
    const effectiveThreshold = parseInt(lowStockThreshold, 10);
    if (isNaN(effectiveThreshold)) {
        toast({ title: "Aviso", description: `Limite de baixo estoque inválido, usando padrão: ${DEFAULT_LOW_STOCK_THRESHOLD}.`, variant: "default" });
    }
    const currentThreshold = isNaN(effectiveThreshold) ? DEFAULT_LOW_STOCK_THRESHOLD : effectiveThreshold;


    // 1. Apply base filters (collection, dates, etc.)
    if (baseFilters) {
      if (baseFilters.collection && baseFilters.collection !== ALL_COLLECTIONS_VALUE) {
        tempFiltered = tempFiltered.filter(p => p.collection === baseFilters.collection);
      }
      if (baseFilters.stockMin) { 
        tempFiltered = tempFiltered.filter(p => p.stock >= parseInt(baseFilters.stockMin!, 10));
      }
      // stockMax from general filters is not directly used here; lowStockThreshold takes precedence for the primary logic.
      // However, if a user explicitly sets a stockMax in general filters, it might interact unexpectedly.
      // For "Restock Opportunities", the main stock upper bound is lowStockThreshold.
      // We could choose to ignore baseFilters.stockMax or let it apply. For now, let it apply.
      if (baseFilters.stockMax) {
        tempFiltered = tempFiltered.filter(p => p.stock <= parseInt(baseFilters.stockMax!, 10));
      }

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
        p.stock <= currentThreshold && 
        (p.readyToShip > 0 || p.order > 0)
    );
    
    setFilteredProducts(tempFiltered);
  }, [allProducts, baseFilters, lowStockThreshold, toast]);


  const handleBaseFilterChange = useCallback((filters: FilterState) => {
    setBaseFilters(filters);
    // applyAllFilters will be called by the "Apply Filters" button
  }, []);
  
  // Apply filters when lowStockThreshold or allProducts change and after initial load
  useEffect(() => {
   if(allProducts.length > 0) {
    applyAllFilters();
   }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts, lowStockThreshold]); // Removed applyAllFilters from deps to avoid loop, explicit call is preferred

  const handleProcessingStart = () => setIsLoading(true);
  const handleProcessingEnd = () => {
    setIsLoading(false);
    // Re-apply filters after new data is processed and loading ends.
    applyAllFilters();
  };

  const handleExportToExcel = () => {
    if (filteredProducts.length === 0) {
      toast({
        title: "Nenhum Dado para Exportar",
        description: "Não há produtos filtrados para exportar.",
        variant: "default",
      });
      return;
    }

    const dataToExport = filteredProducts.map(p => ({
      "ID VTEX": p.vtexId,
      "Nome": p.name,
      "Estoque": p.stock,
      "Pronta Entrega": p.readyToShip,
      "Pedido": p.order,
      "Coleção": p.collection,
      "Descrição": p.description, // Estampa
      "Tamanho": p.size,
      "Tipo Produto": p.productType,
      "Data Início Coleção": p.collectionStartDate ? p.collectionStartDate.toLocaleDateString('pt-BR') : p.rawCollectionStartDate || 'N/A',
      "Data Fim Coleção": p.collectionEndDate ? p.collectionEndDate.toLocaleDateString('pt-BR') : p.rawCollectionEndDate || 'N/A',
    }));

    const worksheet = XLSX.utils.json_to_sheet(dataToExport);
    const workbook = XLSX.utils.book_new();
    XLSX.utils.book_append_sheet(workbook, worksheet, "OportunidadesReabastecimento");
    XLSX.writeFile(workbook, `Oportunidades_Reabastecimento_${new Date().toISOString().split('T')[0]}.xlsx`);
    toast({
      title: "Exportação Concluída",
      description: "Os dados de oportunidades de reabastecimento foram exportados para Excel.",
    });
  };
  
  return (
    <div className="space-y-6">
      <ExcelUploadSection 
        onDataParsed={handleDataParsed} 
        onProcessingStart={handleProcessingStart}
        onProcessingEnd={handleProcessingEnd}
        collectionColumnKey="COLEÇÃO" 
        cardTitle="Upload de Dados para Oportunidades de Reabastecimento"
        cardDescription="Carregue o arquivo Excel. Itens com baixo estoque e disponibilidade em 'Pronta Entrega' ou 'Pedido' serão destacados."
      />

      {allProducts.length > 0 && (
        <>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <PackageSearch className="mr-2 h-5 w-5 text-primary" />
                Definir Limite de Baixo Estoque e Aplicar Filtros
              </CardTitle>
              <CardDescription>
                Produtos com estoque igual ou inferior a este valor (e com Pronta Entrega ou Pedido > 0) serão mostrados.
                Abaixo, você também pode aplicar filtros gerais de coleção, datas, etc.
              </CardDescription>
            </CardHeader>
            <CardContent className="flex flex-col sm:flex-row items-end gap-4">
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
              <Button onClick={applyAllFilters} className="w-full sm:w-auto">Aplicar Todos os Filtros</Button>
            </CardContent>
          </Card>

          <FilterControlsSection
            products={allProducts}
            onFilterChange={handleBaseFilterChange}
            availableCollections={availableCollections}
          />
          
          <div className="flex justify-end mb-4">
            <Button onClick={handleExportToExcel} disabled={filteredProducts.length === 0}>
              <Download className="mr-2 h-5 w-5" />
              Exportar para Excel
            </Button>
          </div>

          <ProductDataTableSection
            products={filteredProducts}
            isLoading={isLoading && filteredProducts.length === 0}
            cardIcon={PackageSearch}
            cardTitle="Oportunidades de Reabastecimento Identificadas"
            showVtexIdColumn={true}
            showNameColumn={true}
            showStockColumn={true}
            showReadyToShipColumn={true}
            showOrderColumn={true}
            showCollectionColumn={true}
            showDescriptionColumn={true} // Mostrar Estampa
            showSizeColumn={true}        // Mostrar Tamanho
            showProductTypeColumn={true} // Mostrar Tipo Produto
            showStartDateColumn={true} 
            showEndDateColumn={true}  
            showStatusColumn={true}   
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

    