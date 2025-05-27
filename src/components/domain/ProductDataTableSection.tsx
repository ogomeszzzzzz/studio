
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types';
import { format, isValid, addDays, isBefore } from 'date-fns';
import { ArrowUpDown, ListChecks, ChevronLeft, ChevronRight } from 'lucide-react';
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
  showRegulatorStockColumn?: boolean; // Nova prop
  showCollectionColumn?: boolean;
  showStartDateColumn?: boolean;
  showEndDateColumn?: boolean;
  showStatusColumn?: boolean;
  showDescriptionColumn?: boolean; 
  showSizeColumn?: boolean;
  showProductTypeColumn?: boolean;
  showProductDerivationColumn?: boolean; 
  cardTitle?: string;
  cardDescription?: string; 
  cardIcon?: React.ElementType;
}

type SortKey = keyof Product | '';
type SortOrder = 'asc' | 'desc';

const getCollectionStatus = (product: Product): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline', colorClass?: string } => {
  const today = new Date();
  today.setHours(0,0,0,0); 

  if (product.collectionEndDate && isValid(product.collectionEndDate)) {
    const endDate = new Date(product.collectionEndDate); 
    endDate.setHours(0,0,0,0); 

    if (isBefore(endDate, today)) {
      return product.stock > 0 
        ? { text: 'Coleção Passada (Em Estoque)', variant: 'destructive', colorClass: 'bg-destructive/80 text-destructive-foreground' } 
        : { text: 'Coleção Passada (Sem Estoque)', variant: 'outline' };
    }
    if (isBefore(endDate, addDays(today, 30))) {
      return { text: 'Próximo ao Fim', variant: 'default', colorClass: 'bg-accent text-accent-foreground' };
    }
  }
  if (!product.isCurrentCollection && product.stock > 0) {
     return { text: 'Não Atual (Em Estoque)', variant: 'secondary' };
  }
  if (product.isCurrentCollection) {
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
  showRegulatorStockColumn = false, // Default para false
  showCollectionColumn = true,
  showStartDateColumn = true,
  showEndDateColumn = true,
  showStatusColumn = true,
  showDescriptionColumn = false, 
  showSizeColumn = false,
  showProductTypeColumn = false,
  showProductDerivationColumn = false,
  cardTitle = "Dados dos Produtos",
  cardDescription = "Lista detalhada de produtos. Clique nos cabeçalhos das colunas para ordenar.",
  cardIcon: CardIcon = ListChecks,
}: ProductDataTableSectionProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const sortedProducts = useMemo(() => {
    if (!sortKey) return products;
    return [...products].sort((a, b) => {
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
        comparison = (valB === null || valB === undefined) ? 0 : 1; // nulls/undefined last
      } else if (valB === null || valB === undefined) {
        comparison = -1; // nulls/undefined last
      }

      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [products, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);

  useEffect(() => {
    if (currentPage > totalPages && totalPages > 0) {
      setCurrentPage(totalPages);
    } else if (totalPages === 0 && sortedProducts.length > 0) { 
      setCurrentPage(1);
    } else if (totalPages === 0 && sortedProducts.length === 0) { 
      setCurrentPage(1);
    } else if (currentPage === 0 && totalPages > 0) { 
        setCurrentPage(1);
    }
  }, [sortedProducts, currentPage, itemsPerPage, totalPages]);


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
        showVtexIdColumn, showNameColumn, showProductDerivationColumn, showStockColumn, 
        showReadyToShipColumn, showRegulatorStockColumn, showCollectionColumn, showDescriptionColumn, 
        showSizeColumn, showProductTypeColumn, showStartDateColumn, showEndDateColumn, showStatusColumn
    ].filter(Boolean).length || 1;

    return (
        <>
            {[...Array(5)].map((_, i) => (
                <TableRow key={`skeleton-row-${i}`}>
                    <TableCell colSpan={colCount}>
                        <Skeleton className="h-8 w-full" />
                    </TableCell>
                </TableRow>
            ))}
        </>
    );
  };


  return (
    <Card className="shadow-sm"> 
      <CardHeader className="pt-4 pb-2"> 
        <CardTitle className="flex items-center text-lg"> 
          <CardIcon className="mr-2 h-5 w-5 text-primary" />
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
            <div className="overflow-x-auto rounded-md border">
              <Table>
                <TableHeader>
                  <TableRow>
                    {showVtexIdColumn && <TableHead onClick={() => handleSort('vtexId')} className="cursor-pointer hover:bg-muted/50 min-w-[100px] whitespace-nowrap">ID VTEX {renderSortIcon('vtexId')}</TableHead>}
                    {showNameColumn && <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/50 min-w-[250px]">Nome Produto {renderSortIcon('name')}</TableHead>}
                    {showProductDerivationColumn && <TableHead onClick={() => handleSort('productDerivation')} className="cursor-pointer hover:bg-muted/50 min-w-[180px] whitespace-nowrap">Produto-Derivação {renderSortIcon('productDerivation')}</TableHead>}
                    {showStockColumn && <TableHead onClick={() => handleSort('stock')} className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap">Est. Atual {renderSortIcon('stock')}</TableHead>}
                    {showReadyToShipColumn && <TableHead onClick={() => handleSort('readyToShip')} className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap font-semibold text-green-600">Pronta Ent. {renderSortIcon('readyToShip')}</TableHead>}
                    {showRegulatorStockColumn && <TableHead onClick={() => handleSort('regulatorStock')} className="cursor-pointer hover:bg-muted/50 text-right whitespace-nowrap font-semibold text-orange-600">Regulador {renderSortIcon('regulatorStock')}</TableHead>}
                    {showCollectionColumn && <TableHead onClick={() => handleSort('collection')} className="cursor-pointer hover:bg-muted/50 min-w-[150px]">Coleção {renderSortIcon('collection')}</TableHead>}
                    {showDescriptionColumn && <TableHead onClick={() => handleSort('description')} className="cursor-pointer hover:bg-muted/50 min-w-[150px]">Estampa {renderSortIcon('description')}</TableHead>}
                    {showSizeColumn && <TableHead onClick={() => handleSort('size')} className="cursor-pointer hover:bg-muted/50 min-w-[100px]">Tamanho {renderSortIcon('size')}</TableHead>}
                    {showProductTypeColumn && <TableHead onClick={() => handleSort('productType')} className="cursor-pointer hover:bg-muted/50 min-w-[150px]">Tipo Produto {renderSortIcon('productType')}</TableHead>}
                    {showStartDateColumn && <TableHead onClick={() => handleSort('collectionStartDate')} className="cursor-pointer hover:bg-muted/50 whitespace-nowrap">Data Início {renderSortIcon('collectionStartDate')}</TableHead>}
                    {showEndDateColumn && <TableHead onClick={() => handleSort('collectionEndDate')} className="cursor-pointer hover:bg-muted/50 whitespace-nowrap">Data Fim {renderSortIcon('collectionEndDate')}</TableHead>}
                    {showStatusColumn && <TableHead className="min-w-[120px]">Status Coleção</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? <TableSkeleton /> : paginatedProducts.map((product, index) => {
                    const status = getCollectionStatus(product);
                    return (
                      <TableRow key={`${product.vtexId}-${product.name}-${product.productDerivation}-${index}-${currentPage}`}>
                        {showVtexIdColumn && <TableCell className="whitespace-nowrap">{product.vtexId}</TableCell>}
                        {showNameColumn && <TableCell className="font-medium">{product.name}</TableCell>}
                        {showProductDerivationColumn && <TableCell className="whitespace-nowrap">{product.productDerivation}</TableCell>}
                        {showStockColumn && <TableCell className="text-right">{product.stock.toLocaleString()}</TableCell>}
                        {showReadyToShipColumn && <TableCell className="text-right font-semibold text-green-700">{product.readyToShip.toLocaleString()}</TableCell>}
                        {showRegulatorStockColumn && <TableCell className="text-right font-semibold text-orange-700">{product.regulatorStock.toLocaleString()}</TableCell>}
                        {showCollectionColumn && <TableCell>{product.collection}</TableCell>}
                        {showDescriptionColumn && <TableCell>{product.description}</TableCell>}
                        {showSizeColumn && <TableCell>{product.size}</TableCell>}
                        {showProductTypeColumn && <TableCell>{product.productType}</TableCell>}
                        {showStartDateColumn && <TableCell className="whitespace-nowrap">
                          {product.collectionStartDate && isValid(new Date(product.collectionStartDate))
                            ? format(new Date(product.collectionStartDate), 'dd/MM/yy')
                            : product.rawCollectionStartDate || 'N/A'}
                        </TableCell>}
                        {showEndDateColumn && <TableCell className="whitespace-nowrap">
                          {product.collectionEndDate && isValid(new Date(product.collectionEndDate))
                            ? format(new Date(product.collectionEndDate), 'dd/MM/yy')
                            : product.rawCollectionEndDate || 'N/A'}
                        </TableCell>}
                        {showStatusColumn && <TableCell>
                          <Badge variant={status.variant} className={cn("whitespace-nowrap text-xs", status.colorClass)}>{status.text}</Badge>
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
                  disabled={currentPage === totalPages}
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
    
