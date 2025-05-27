
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
    // Initial filter application will be triggered by useEffect or button click
  }, []);

  const availableCollections = useMemo(() => {
    const collections = new Set(allProducts.map(p => p.collection).filter(Boolean));
    return Array.from(collections).sort();
  }, [allProducts]);

  const applyAllFilters = useCallback(() => {
    setIsLoading(true); // Indicate loading during filtering
    let tempFiltered = [...allProducts];
    const effectiveThreshold = parseInt(lowStockThreshold, 10);
    
    const currentThreshold = isNaN(effectiveThreshold) ? DEFAULT_LOW_STOCK_THRESHOLD : effectiveThreshold;
    if (isNaN(effectiveThreshold)) {
        toast({ title: "Aviso", description: `Limite de baixo estoque inválido, usando padrão: ${DEFAULT_LOW_STOCK_THRESHOLD}.`, variant: "default" });
    }

    // 1. Apply base filters (collection, dates, etc.)
    if (baseFilters) {
      if (baseFilters.collection && baseFilters.collection !== ALL_COLLECTIONS_VALUE) {
        tempFiltered = tempFiltered.filter(p => p.collection === baseFilters.collection);
      }
      if (baseFilters.stockMin && baseFilters.stockMin.trim() !== '') { 
        tempFiltered = tempFiltered.filter(p => p.stock >= parseInt(baseFilters.stockMin!, 10));
      }
      if (baseFilters.stockMax && baseFilters.stockMax.trim() !== '') {
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
    setIsLoading(false); // Filtering complete
  }, [allProducts, baseFilters, lowStockThreshold, toast]);


  const handleBaseFilterChange = useCallback((filters: FilterState) => {
    setBaseFilters(filters);
    // Filters will be applied by the button or useEffect
  }, []);
  
  // Apply filters when relevant state changes and after initial load
  useEffect(() => {
   if(allProducts.length > 0) {
    applyAllFilters();
   }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts, lowStockThreshold, baseFilters]); // Added baseFilters to dependencies

  const handleProcessingStart = () => setIsLoading(true);
  const handleProcessingEnd = () => {
    // applyAllFilters will be called by the useEffect when allProducts changes
    // If allProducts hasn't changed but we want to re-filter (e.g. after initial load with default filters)
    // ensure applyAllFilters is called.
    if (allProducts.length > 0) {
        applyAllFilters();
    } else {
        setIsLoading(false); // Explicitly set loading to false if no products
    }
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
      "Nome Produto": p.name,
      "Produto-Derivação": p.productDerivation,
      "Estoque": p.stock,
      "Pronta Entrega": p.readyToShip,
      "Pedido": p.order,
      "Coleção": p.collection,
      "Descrição (Estampa)": p.description, 
      "Tamanho": p.size,
      "Tipo Produto": p.productType,
      "Data Início Coleção": p.collectionStartDate && isValid(new Date(p.collectionStartDate)) ? new Date(p.collectionStartDate).toLocaleDateString('pt-BR') : p.rawCollectionStartDate || 'N/A',
      "Data Fim Coleção": p.collectionEndDate && isValid(new Date(p.collectionEndDate)) ? new Date(p.collectionEndDate).toLocaleDateString('pt-BR') : p.rawCollectionEndDate || 'N/A',
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
        collectionColumnKey="COLEÇÃO" // Consistent with Gap Analyzer for collection definition
        cardTitle="Upload de Dados para Oportunidades de Reabastecimento"
        cardDescription="Carregue o arquivo Excel. Itens com baixo estoque e disponibilidade em 'Pronta Entrega' ou 'Pedido' serão destacados."
      />

      {allProducts.length > 0 && (
        <>
          <Card className="shadow-lg">
            <CardHeader>
              <CardTitle className="flex items-center">
                <PackageSearch className="mr-2 h-5 w-5 text-primary" />
                Definir Limite de Baixo Estoque e Aplicar Filtros Gerais
              </CardTitle>
              <CardDescription>
                Produtos com estoque igual ou inferior a este valor (e com Pronta Entrega ou Pedido > 0) serão mostrados.
                Abaixo, você também pode aplicar filtros de coleção, datas, etc. Clique em "Aplicar Filtros" para atualizar.
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
          
          <div className="flex justify-end my-4">
            <Button onClick={handleExportToExcel} disabled={filteredProducts.length === 0 || isLoading}>
              <Download className="mr-2 h-5 w-5" />
              Exportar para Excel
            </Button>
          </div>

          <ProductDataTableSection
            products={filteredProducts}
            isLoading={isLoading && filteredProducts.length === 0} // Show skeleton only if loading AND no products
            cardIcon={PackageSearch}
            cardTitle="Oportunidades de Reabastecimento Identificadas"
            showVtexIdColumn={true}
            showNameColumn={true}
            showProductDerivationColumn={true} // Exibir Produto-Derivação
            showStockColumn={true}
            showReadyToShipColumn={true}
            showOrderColumn={true}
            showCollectionColumn={true}
            showDescriptionColumn={true} 
            showSizeColumn={true}        
            showProductTypeColumn={true} 
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
                <CardTitle className="flex items-center text-accent-foreground"> {/* Changed to accent for less alarming color */}
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
                    Tente ajustar o limite de baixo estoque ou os filtros gerais e clique em "Aplicar Todos os Filtros".
                </p>
            </CardContent>
        </Card>
      )}
    </div>
  );
}
