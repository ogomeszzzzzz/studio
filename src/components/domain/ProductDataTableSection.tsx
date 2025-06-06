
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types';
import { format, isValid, addDays, isBefore, parseISO } from 'date-fns';
import { ArrowUpDown, ListChecks, ChevronLeft, ChevronRight, TrendingUp, DollarSign, ShoppingCart, LayersIcon } from 'lucide-react'; // Added DollarSign, ShoppingCart, LayersIcon
import { Skeleton } from '@/components/ui/skeleton';
import { cn } from '@/lib/utils';

interface ProductDataTableSectionProps {
  products: Product[];
  isLoading: boolean;
  itemsPerPage?: number;
  showVtexIdColumn?: boolean;
  showNameColumn?: boolean;
  showStockColumn?: boolean;
  showReadyToShipColumn?: boolean;
  showRegulatorStockColumn?: boolean;
  showOpenOrdersColumn?: boolean;
  showCollectionColumn?: boolean;
  showStartDateColumn?: boolean;
  showEndDateColumn?: boolean;
  showStatusColumn?: boolean;
  showDescriptionColumn?: boolean;
  showSizeColumn?: boolean;
  showProductTypeColumn?: boolean;
  showProductDerivationColumn?: boolean;
  showCanRestockAmountColumn?: boolean;
  lowStockThresholdForRestock?: number;
  cardTitle?: string;
  cardDescription?: string;
  cardIcon?: React.ElementType;

  // New props for ABC Analysis
  showPriceColumn?: boolean;
  showSales30dColumn?: boolean;
  showRevenue30dColumn?: boolean;
  showAbcCurveColumn?: boolean;
}

type SortKey = keyof Product | 'canRestockAmount' | 'revenue30d' | ''; // Added revenue30d
type SortOrder = 'asc' | 'desc';

const getCollectionStatus = (product: Product): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline', colorClass?: string } => {
  const today = new Date();
  today.setHours(0,0,0,0);

  const endDateInput = product.collectionEndDate;
  let endDate: Date | null = null;

  if (endDateInput instanceof Date && isValid(endDateInput)) {
    endDate = new Date(endDateInput.valueOf()); 
  } else if (typeof endDateInput === 'string') {
    const parsedDate = parseISO(endDateInput); // Use parseISO for better ISO string handling
    if (isValid(parsedDate)) {
      endDate = parsedDate;
    }
  } else if (typeof endDateInput === 'number' && !isNaN(endDateInput)) { 
      const excelBaseDate = new Date(Date.UTC(1899, 11, 30)); 
      const d = new Date(excelBaseDate.getTime() + endDateInput * 24 * 60 * 60 * 1000);
      if (isValid(d)) endDate = d;
  }


  if (endDate && isValid(endDate)) {
    endDate.setHours(0,0,0,0);

    if (isBefore(endDate, today)) {
      return product.stock > 0
        ? { text: 'Coleção Passada (Em Estoque)', variant: 'destructive', colorClass: 'bg-destructive/80 text-destructive-foreground' }
        : { text: 'Coleção Passada (Sem Estoque)', variant: 'outline', colorClass: 'border-muted-foreground text-muted-foreground' };
    }
    if (isBefore(endDate, addDays(today, 30))) {
      return { text: 'Próximo ao Fim', variant: 'default', colorClass: 'bg-amber-500 text-white' };
    }
  }
  if (product.isCurrentCollection === false && product.stock > 0) {
     return { text: 'Não Atual (Em Estoque)', variant: 'secondary' };
  }
  if (product.isCurrentCollection === true) {
    return { text: 'Coleção Atual', variant: 'default', colorClass: 'bg-primary/80 text-primary-foreground' };
  }
  return { text: 'Status N/A', variant: 'outline' };
};


export function ProductDataTableSection({
  products,
  isLoading,
  itemsPerPage = 20,
  showVtexIdColumn = false,
  showNameColumn = true,
  showStockColumn = true,
  showReadyToShipColumn = false,
  showRegulatorStockColumn = false,
  showOpenOrdersColumn = false,
  showCollectionColumn = true,
  showStartDateColumn = false, // Defaulted to false as per last changes
  showEndDateColumn = false,   // Defaulted to false
  showStatusColumn = true,
  showDescriptionColumn = false,
  showSizeColumn = false,
  showProductTypeColumn = false,
  showProductDerivationColumn = false,
  showCanRestockAmountColumn = false,
  lowStockThresholdForRestock = 0,
  cardTitle = "Dados dos Produtos",
  cardDescription = "Lista detalhada de produtos. Clique nos cabeçalhos das colunas para ordenar.",
  cardIcon: CardIconPassed = ListChecks,
  showPriceColumn = false,
  showSales30dColumn = false,
  showRevenue30dColumn = false,
  showAbcCurveColumn = false,
}: ProductDataTableSectionProps) {
  const [sortKey, setSortKey] = useState<SortKey>('');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const CardIcon = CardIconPassed || ListChecks;


  const augmentedProducts = useMemo(() => {
    if (!showCanRestockAmountColumn) return products;
    return products.map(p => ({
        ...p,
    }));
  }, [products, showCanRestockAmountColumn, lowStockThresholdForRestock]);


  const sortedProducts = useMemo(() => {
    let productsToSort = showCanRestockAmountColumn ? augmentedProducts : [...products]; // Ensure we work with a copy for sorting
    if (!sortKey) return productsToSort;

    return productsToSort.sort((a, b) => {
      const valA = a[sortKey as keyof Product];
      const valB = b[sortKey as keyof Product];

      let comparison = 0;
      if (valA instanceof Date && valB instanceof Date) {
        comparison = valA.getTime() - valB.getTime();
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        comparison = valA === valB ? 0 : (valA ? -1 : 1);
      } else if (valA === null || valA === undefined) {
        comparison = (valB === null || valB === undefined) ? 0 : 1;
      } else if (valB === null || valB === undefined) {
        comparison = -1;
      } else { // Handle cases where one might be number and other string (e.g. vtexId) or for abcCurve
        const strA = String(valA).toLowerCase();
        const strB = String(valB).toLowerCase();
        comparison = strA.localeCompare(strB);
      }


      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [products, augmentedProducts, showCanRestockAmountColumn, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (currentPage === 0 && totalPages > 0) {
        setCurrentPage(1);
    } else if (totalPages === 0 && sortedProducts.length === 0) {
        setCurrentPage(1);
    }
  }, [sortedProducts.length, currentPage, itemsPerPage, totalPages]);


  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedProducts.slice(startIndex, endIndex);
  }, [sortedProducts, currentPage, itemsPerPage]);


  const handleSort = (key: SortKey) => {
    if (!key) return;
    if (sortKey === key) {
      setSortOrder(prevOrder => (prevOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (key: SortKey) => {
    if (!key) return null;
    if (sortKey === key) {
      return sortOrder === 'asc' ? <ArrowUpDown className="h-4 w-4 inline ml-1 transform rotate-180" /> : <ArrowUpDown className="h-4 w-4 inline ml-1" />;
    }
    return <ArrowUpDown className="h-4 w-4 inline ml-1 opacity-30" />;
  };

  const TableSkeleton = () => {
    const colCount = [
        showVtexIdColumn, showNameColumn, showProductDerivationColumn, 
        showPriceColumn, showSales30dColumn, showRevenue30dColumn, showAbcCurveColumn, // ABC columns
        showStockColumn, showReadyToShipColumn, showRegulatorStockColumn, showOpenOrdersColumn,
        showCanRestockAmountColumn, showCollectionColumn, showDescriptionColumn,
        showSizeColumn, showProductTypeColumn, showStartDateColumn, showEndDateColumn, showStatusColumn
    ].filter(Boolean).length || 1;

    return (
        <>
            {[...Array(itemsPerPage > 10 ? 10 : itemsPerPage)].map((_, i) => (
                <TableRow key={`skeleton-row-${i}`}>
                    <TableCell colSpan={colCount > 0 ? colCount : 1}>
                        <Skeleton className="h-8 w-full" />
                    </TableCell>
                </TableRow>
            ))}
        </>
    );
  };

  const formatCurrency = (value?: number) => {
    if (value === undefined || value === null || isNaN(value)) return 'N/A';
    return value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });
  };

  return (
    <Card className="shadow-sm">
      <CardHeader className="pt-4 pb-2">
        <CardTitle className="flex items-center text-lg">
          {CardIcon && <CardIcon className="mr-2 h-5 w-5 text-primary" />}
          {cardTitle}
        </CardTitle>
        <CardDescription className="text-sm">
          {cardDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-2">
        {(products.length === 0 && !isLoading) ? (
          <p className="text-center text-muted-foreground py-6">Nenhum produto corresponde aos critérios selecionados.</p>
        ) : (
          <>
            <div className="rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {showVtexIdColumn && <TableHead onClick={() => handleSort('vtexId')} className="cursor-pointer hover:bg-muted/50 min-w-[100px] whitespace-nowrap px-2 py-3 text-xs sm:text-sm">ID VTEX {renderSortIcon('vtexId')}</TableHead>}
                    {showNameColumn && <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/50 min-w-[200px] px-2 py-3 text-xs sm:text-sm">Nome Produto {renderSortIcon('name')}</TableHead>}
                    {showProductDerivationColumn && <TableHead onClick={() => handleSort('productDerivation')} className="cursor-pointer hover:bg-muted/50 min-w-[150px] whitespace-nowrap px-2 py-3 text-xs sm:text-sm">Produto-Derivação {renderSortIcon('productDerivation')}</TableHead>}
                    
                    {showPriceColumn && <TableHead onClick={() => handleSort('price')} className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap px-2 py-3 text-xs sm:text-sm">Preço {renderSortIcon('price')}</TableHead>}
                    {showSales30dColumn && <TableHead onClick={() => handleSort('sales30d')} className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap px-2 py-3 text-xs sm:text-sm">Venda 30d {renderSortIcon('sales30d')}</TableHead>}
                    {showRevenue30dColumn && <TableHead onClick={() => handleSort('revenue30d')} className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap font-semibold text-green-600 px-2 py-3 text-xs sm:text-sm">Fat. 30d {renderSortIcon('revenue30d')}</TableHead>}
                    {showAbcCurveColumn && <TableHead onClick={() => handleSort('abcCurve')} className="cursor-pointer hover:bg-muted/50 text-center whitespace-nowrap px-2 py-3 text-xs sm:text-sm">Curva ABC {renderSortIcon('abcCurve')}</TableHead>}
                    
                    {showStockColumn && <TableHead onClick={() => handleSort('stock')} className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap px-2 py-3 text-xs sm:text-sm">Est. Atual {renderSortIcon('stock')}</TableHead>}
                    {showReadyToShipColumn && <TableHead onClick={() => handleSort('readyToShip')} className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap font-semibold text-green-600 px-2 py-3 text-xs sm:text-sm">Pronta Ent. {renderSortIcon('readyToShip')}</TableHead>}
                    {showRegulatorStockColumn && <TableHead onClick={() => handleSort('regulatorStock')} className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap font-semibold text-orange-600 px-2 py-3 text-xs sm:text-sm">Regulador {renderSortIcon('regulatorStock')}</TableHead>}
                    {showOpenOrdersColumn && <TableHead onClick={() => handleSort('openOrders')} className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap font-semibold text-blue-600 px-2 py-3 text-xs sm:text-sm">Ped. Aberto {renderSortIcon('openOrders')}</TableHead>}
                    {showCanRestockAmountColumn && <TableHead onClick={() => handleSort('canRestockAmount')} className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap font-semibold text-teal-600 px-2 py-3 text-xs sm:text-sm"><TrendingUp className="inline h-4 w-4 mr-1" />Pode Repor {renderSortIcon('canRestockAmount')}</TableHead>}
                    
                    {showCollectionColumn && <TableHead onClick={() => handleSort('collection')} className="cursor-pointer hover:bg-muted/50 min-w-[150px] px-2 py-3 text-xs sm:text-sm">Coleção {renderSortIcon('collection')}</TableHead>}
                    {showDescriptionColumn && <TableHead onClick={() => handleSort('description')} className="cursor-pointer hover:bg-muted/50 min-w-[150px] px-2 py-3 text-xs sm:text-sm">Estampa {renderSortIcon('description')}</TableHead>}
                    {showSizeColumn && <TableHead onClick={() => handleSort('size')} className="cursor-pointer hover:bg-muted/50 min-w-[100px] px-2 py-3 text-xs sm:text-sm">Tamanho {renderSortIcon('size')}</TableHead>}
                    {showProductTypeColumn && <TableHead onClick={() => handleSort('productType')} className="cursor-pointer hover:bg-muted/50 min-w-[150px] px-2 py-3 text-xs sm:text-sm">Tipo Produto {renderSortIcon('productType')}</TableHead>}
                    {showStartDateColumn && <TableHead onClick={() => handleSort('collectionStartDate')} className="cursor-pointer hover:bg-muted/50 whitespace-nowrap px-2 py-3 text-xs sm:text-sm">Data Início {renderSortIcon('collectionStartDate')}</TableHead>}
                    {showEndDateColumn && <TableHead onClick={() => handleSort('collectionEndDate')} className="cursor-pointer hover:bg-muted/50 whitespace-nowrap px-2 py-3 text-xs sm:text-sm">Data Fim {renderSortIcon('collectionEndDate')}</TableHead>}
                    {showStatusColumn && <TableHead className="min-w-[120px] px-2 py-3 text-xs sm:text-sm">Status Coleção</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? <TableSkeleton /> : paginatedProducts.map((product, index) => {
                    const status = getCollectionStatus(product);
                    return (
                      <TableRow key={`${product.vtexId}-${product.name}-${product.productDerivation}-${index}-${currentPage}`}>
                        {showVtexIdColumn && <TableCell className="whitespace-nowrap px-2 py-2 text-xs sm:text-sm">{String(product.vtexId ?? '')}</TableCell>}
                        {showNameColumn && <TableCell className="font-medium px-2 py-2 text-xs sm:text-sm">{product.name}</TableCell>}
                        {showProductDerivationColumn && <TableCell className="whitespace-nowrap px-2 py-2 text-xs sm:text-sm">{product.productDerivation}</TableCell>}
                        
                        {showPriceColumn && <TableCell className="text-right whitespace-nowrap px-2 py-2 text-xs sm:text-sm">{formatCurrency(product.price)}</TableCell>}
                        {showSales30dColumn && <TableCell className="text-right whitespace-nowrap px-2 py-2 text-xs sm:text-sm">{(product.sales30d ?? 0).toLocaleString()}</TableCell>}
                        {showRevenue30dColumn && <TableCell className="text-right whitespace-nowrap font-semibold text-green-700 px-2 py-2 text-xs sm:text-sm">{formatCurrency(product.revenue30d)}</TableCell>}
                        {showAbcCurveColumn && <TableCell className="text-center font-bold px-2 py-2 text-xs sm:text-sm">{product.abcCurve || 'N/A'}</TableCell>}

                        {showStockColumn && <TableCell className="text-right px-2 py-2 text-xs sm:text-sm">{product.stock.toLocaleString()}</TableCell>}
                        {showReadyToShipColumn && <TableCell className="text-right font-semibold text-green-700 px-2 py-2 text-xs sm:text-sm">{product.readyToShip.toLocaleString()}</TableCell>}
                        {showRegulatorStockColumn && <TableCell className="text-right font-semibold text-orange-700 px-2 py-2 text-xs sm:text-sm">{product.regulatorStock.toLocaleString()}</TableCell>}
                        {showOpenOrdersColumn && <TableCell className="text-right font-semibold text-blue-700 px-2 py-2 text-xs sm:text-sm">{product.openOrders.toLocaleString()}</TableCell>}
                        {showCanRestockAmountColumn && <TableCell className="text-right font-bold text-teal-700 px-2 py-2 text-xs sm:text-sm">{(product.canRestockAmount ?? 0).toLocaleString()}</TableCell>}
                        
                        {showCollectionColumn && <TableCell className="px-2 py-2 text-xs sm:text-sm">{product.collection}</TableCell>}
                        {showDescriptionColumn && <TableCell className="px-2 py-2 text-xs sm:text-sm">{product.description}</TableCell>}
                        {showSizeColumn && <TableCell className="px-2 py-2 text-xs sm:text-sm">{product.size}</TableCell>}
                        {showProductTypeColumn && <TableCell className="px-2 py-2 text-xs sm:text-sm">{product.productType}</TableCell>}
                        {showStartDateColumn && <TableCell className="whitespace-nowrap px-2 py-2 text-xs sm:text-sm">
                          {product.collectionStartDate && isValid(new Date(product.collectionStartDate))
                            ? format(new Date(product.collectionStartDate), 'dd/MM/yy')
                            : product.rawCollectionStartDate || 'N/A'}
                        </TableCell>}
                        {showEndDateColumn && <TableCell className="whitespace-nowrap px-2 py-2 text-xs sm:text-sm">
                          {product.collectionEndDate && isValid(new Date(product.collectionEndDate))
                            ? format(new Date(product.collectionEndDate), 'dd/MM/yy')
                            : product.rawCollectionEndDate || 'N/A'}
                        </TableCell>}
                        {showStatusColumn && <TableCell className="px-2 py-2 text-xs sm:text-sm">
                          <Badge variant={status.variant} className={cn("whitespace-nowrap text-xs px-1.5 py-0.5", status.colorClass)}>{status.text}</Badge>
                        </TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))}
                  disabled={currentPage === 1}
                  aria-label="Página anterior"
                >
                  <ChevronLeft className="h-4 w-4 mr-1" />
                  Anterior
                </Button>
                <span className="text-sm text-muted-foreground">
                  Página {currentPage} de {totalPages} (Total: {sortedProducts.length.toLocaleString()} produtos)
                </span>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))}
                  disabled={currentPage === totalPages || sortedProducts.length === 0}
                  aria-label="Próxima página"
                >
                  Próxima
                  <ChevronRight className="h-4 w-4 ml-1" />
                </Button>
              </div>
            )}
          </>
        )}
      </CardContent>
    </Card>
  );
}
