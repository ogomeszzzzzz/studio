
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import { FilterControlsSection } from '@/components/domain/FilterControlsSection';
import { ProductDataTableSection } from '@/components/domain/ProductDataTableSection';
import type { Product, FilterState } from '@/types';
import { isAfter, isBefore, isValid, parseISO } from 'date-fns';
import { PackageSearch, AlertTriangle, Download, TrendingUp, PackageCheck, ClipboardList, ListFilter, HelpCircle } from 'lucide-react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Button } from '@/components/ui/button';
import { useToast } from '@/hooks/use-toast';
import * as XLSX from 'xlsx';
import {
  Tooltip,
  TooltipContent,
  TooltipProvider,
  TooltipTrigger,
} from "@/components/ui/tooltip";


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
  }, []);

  const availableCollections = useMemo(() => {
    const collections = new Set(allProducts.map(p => p.collection).filter(Boolean));
    return Array.from(collections).sort();
  }, [allProducts]);

  const applyAllFilters = useCallback(() => {
    setIsLoading(true); 
    let tempFiltered = [...allProducts];
    const effectiveThreshold = parseInt(lowStockThreshold, 10);
    
    const currentThreshold = isNaN(effectiveThreshold) ? DEFAULT_LOW_STOCK_THRESHOLD : effectiveThreshold;
    if (isNaN(effectiveThreshold) && lowStockThreshold.trim() !== '') { 
        toast({ title: "Aviso", description: `Limite de baixo estoque inválido, usando padrão: ${DEFAULT_LOW_STOCK_THRESHOLD}.`, variant: "default" });
    }

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
    
    tempFiltered = tempFiltered.filter(p => 
        p.stock <= currentThreshold && 
        (p.readyToShip > 0 || p.regulatorStock > 0) // Usando regulatorStock
    );
    
    setFilteredProducts(tempFiltered);
    setIsLoading(false);
  }, [allProducts, baseFilters, lowStockThreshold, toast]);


  const handleBaseFilterChange = useCallback((filters: FilterState) => {
    setBaseFilters(filters);
  }, []);
  
  useEffect(() => {
   if(allProducts.length > 0) {
    applyAllFilters();
   }
  // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [allProducts, lowStockThreshold, baseFilters]); // Adicionado baseFilters

  const handleProcessingStart = () => setIsLoading(true);
  const handleProcessingEnd = () => {
    // Não chama applyAllFilters aqui, pois o useEffect já cuidará disso
    // quando allProducts for atualizado. Apenas ajusta isLoading.
    setIsLoading(false); 
  };

  const summaryStats = useMemo(() => {
    const totalSkusToRestock = filteredProducts.length;
    // Usando regulatorStock em vez de order
    const totalUnitsAvailableForRestock = filteredProducts.reduce((sum, p) => sum + p.readyToShip + p.regulatorStock, 0);
    const potentialStockAtRiskUnits = filteredProducts.reduce((sum, p) => {
      if (p.stock === 0) return sum + p.readyToShip + p.regulatorStock; 
      return sum + Math.max(0, (p.readyToShip + p.regulatorStock) - p.stock);
    }, 0);

    return {
      totalSkusToRestock,
      totalUnitsAvailableForRestock,
      potentialStockAtRiskUnits
    };
  }, [filteredProducts]);

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
      "Estoque Atual": p.stock,
      "Pronta Entrega": p.readyToShip,
      "Regulador": p.regulatorStock, // Exportando Regulator
      "Coleção (Desc. Linha Comercial)": p.collection, // Coleção vindo de "Descrição Linha Comercial"
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
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
            <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
                <TrendingUp className="mr-3 h-8 w-8 text-primary" />
                Oportunidades de Reabastecimento
            </h1>
            <p className="text-muted-foreground">
                Identifique produtos com baixo estoque que possuem unidades em "Pronta Entrega" ou "Regulador" para reposição.
            </p>
        </div>
      </div>

      <ExcelUploadSection 
        onDataParsed={handleDataParsed} 
        onProcessingStart={handleProcessingStart}
        onProcessingEnd={handleProcessingEnd}
        collectionColumnKey="Descrição Linha Comercial" // Usando Descrição Linha Comercial para 'collection'
        cardTitle="1. Carregar Dados do Excel"
        cardDescription="Faça o upload da planilha de produtos. A coluna 'Descrição Linha Comercial' será usada para 'Coleção'."
      />

      {allProducts.length > 0 && (
        <>
          <Card className="shadow-lg border-primary border-l-4">
            <CardHeader>
              <CardTitle className="flex items-center">
                <ListFilter className="mr-2 h-5 w-5 text-primary" />
                2. Definir Critérios de Reabastecimento
              </CardTitle>
              <CardDescription>
                Ajuste o limite de estoque para considerar um item como "baixo" e aplique filtros adicionais se necessário.
                As oportunidades são itens com estoque atual &lt;= ao limite definido E com unidades em "Pronta Entrega" ou "Regulador".
              </CardDescription>
            </CardHeader>
            <CardContent className="space-y-4">
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4 items-end">
                    <div>
                        <Label htmlFor="lowStockThreshold" className="flex items-center">
                            Estoque Máximo para Oportunidade
                            <TooltipProvider>
                                <Tooltip>
                                    <TooltipTrigger asChild>
                                        <HelpCircle className="ml-1.5 h-4 w-4 text-muted-foreground cursor-help" />
                                    </TooltipTrigger>
                                    <TooltipContent>
                                        <p>Produtos com estoque atual igual ou inferior a este valor serão considerados.</p>
                                    </TooltipContent>
                                </Tooltip>
                            </TooltipProvider>
                        </Label>
                        <Input 
                        id="lowStockThreshold"
                        type="number"
                        value={lowStockThreshold}
                        onChange={(e) => setLowStockThreshold(e.target.value)}
                        placeholder={`Padrão: ${DEFAULT_LOW_STOCK_THRESHOLD}`}
                        min="0"
                        className="mt-1"
                        />
                    </div>
                    <Button onClick={applyAllFilters} className="w-full md:w-auto" disabled={isLoading}>
                        {isLoading ? 'Aplicando...' : 'Aplicar Critérios e Filtros'}
                    </Button>
                </div>
                <FilterControlsSection
                    products={allProducts} // Passando allProducts para popular as coleções disponíveis
                    onFilterChange={handleBaseFilterChange}
                    availableCollections={availableCollections}
                />
            </CardContent>
          </Card>
        
          <Card className="shadow-lg">
            <CardHeader>
                <CardTitle className="flex items-center">
                    <PackageSearch className="mr-2 h-5 w-5 text-primary" />
                    3. Resultados da Análise de Reabastecimento
                </CardTitle>
                <CardDescription>
                    Visão geral e lista detalhada dos produtos que representam oportunidades de reabastecimento.
                </CardDescription>
            </CardHeader>
            <CardContent className="space-y-6">
                <div className="grid gap-4 md:grid-cols-3">
                    <Card className="border-accent border-l-4">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">SKUs para Reabastecer</CardTitle>
                            <PackageSearch className="h-5 w-5 text-accent" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-accent">{summaryStats.totalSkusToRestock.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Produtos únicos identificados.</p>
                        </CardContent>
                    </Card>
                    <Card className="border-green-500 border-l-4">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Unidades Disponíveis</CardTitle>
                            <PackageCheck className="h-5 w-5 text-green-500" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-green-600">{summaryStats.totalUnitsAvailableForRestock.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Total em Pronta Entrega + Regulador.</p>
                        </CardContent>
                    </Card>
                    <Card className="border-destructive border-l-4">
                        <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                            <CardTitle className="text-sm font-medium">Estoque em Risco (Un.)</CardTitle>
                            <AlertTriangle className="h-5 w-5 text-destructive" />
                        </CardHeader>
                        <CardContent>
                            <div className="text-2xl font-bold text-destructive">{summaryStats.potentialStockAtRiskUnits.toLocaleString()}</div>
                            <p className="text-xs text-muted-foreground">Unidades de Pronta Entrega/Regulador que podem faltar.</p>
                        </CardContent>
                    </Card>
                </div>
                
                <div className="flex justify-end">
                    <Button onClick={handleExportToExcel} disabled={filteredProducts.length === 0 || isLoading}>
                    <Download className="mr-2 h-5 w-5" />
                    Exportar Lista para Excel
                    </Button>
                </div>

                <ProductDataTableSection
                    products={filteredProducts}
                    isLoading={isLoading && filteredProducts.length === 0} 
                    cardIcon={PackageSearch}
                    cardTitle="Produtos com Oportunidade de Reabastecimento"
                    showVtexIdColumn={true}
                    showNameColumn={true}
                    showProductDerivationColumn={true} 
                    showStockColumn={true}
                    showReadyToShipColumn={true}
                    showRegulatorStockColumn={true} // Mostrando Regulador
                    showCollectionColumn={true} // Coleção virá de Descrição Linha Comercial
                    showDescriptionColumn={false} // Estampa não é prioritária aqui
                    showSizeColumn={true}        
                    showProductTypeColumn={true} 
                    showStartDateColumn={false} 
                    showEndDateColumn={true}  
                    showStatusColumn={true}   
                />
                 {allProducts.length > 0 && filteredProducts.length === 0 && !isLoading && (
                    <Card className="shadow-md my-6 border-info border-l-4">
                        <CardHeader>
                            <CardTitle className="flex items-center text-info-foreground">
                                <AlertTriangle className="mr-2 h-5 w-5 text-info" />
                                Nenhuma Oportunidade Encontrada
                            </CardTitle>
                        </CardHeader>
                        <CardContent>
                            <p className="text-muted-foreground">
                                Nenhum produto com estoque atual &le; <span className="font-semibold">{parseInt(lowStockThreshold, 10) || DEFAULT_LOW_STOCK_THRESHOLD}</span> unidades e com disponibilidade em "Pronta Entrega" ou "Regulador" foi encontrado com os filtros atuais.
                            </p>
                            <p className="text-muted-foreground mt-2">
                                Tente ajustar o "Estoque Máximo para Oportunidade" ou os filtros gerais e clique em "Aplicar Critérios e Filtros".
                            </p>
                        </CardContent>
                    </Card>
                  )}
            </CardContent>
          </Card>
        </>
      )}
      {allProducts.length === 0 && !isLoading && (
        <Card className="shadow-lg text-center py-10">
          <CardHeader>
            <CardTitle className="flex items-center justify-center">
                <PackageSearch className="mr-2 h-7 w-7 text-primary" />
                Comece Analisando as Oportunidades
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">
              Carregue um arquivo Excel no passo "1. Carregar Dados do Excel" para identificar produtos com baixo estoque que podem ser reabastecidos a partir da "Pronta Entrega" ou "Regulador".
            </p>
          </CardContent>
        </Card>
      )}
    </div>
  );
}
