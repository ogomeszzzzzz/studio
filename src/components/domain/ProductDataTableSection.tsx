
'use client';

import { useState, useMemo, useEffect } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types';
import { format, isValid, addDays, isBefore } from 'date-fns';
import { ArrowUpDown, ListChecks, ChevronLeft, ChevronRight, PackageSearch } from 'lucide-react';
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
  showOrderColumn?: boolean;
  showCollectionColumn?: boolean;
  showStartDateColumn?: boolean;
  showEndDateColumn?: boolean;
  showStatusColumn?: boolean;
  cardTitle?: string;
  cardIcon?: React.ElementType;
}

type SortKey = keyof Product | '';
type SortOrder = 'asc' | 'desc';

const getCollectionStatus = (product: Product): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline', colorClass?: string } => {
  const today = new Date();
  today.setHours(0,0,0,0); 

  if (product.collectionEndDate && isValid(product.collectionEndDate)) {
    const endDate = new Date(product.collectionEndDate); // Ensure it's a Date object
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
  showOrderColumn = false,
  showCollectionColumn = true,
  showStartDateColumn = true,
  showEndDateColumn = true,
  showStatusColumn = true,
  cardTitle = "Dados dos Produtos",
  cardIcon: CardIcon = ListChecks,
}: ProductDataTableSectionProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');
  const [currentPage, setCurrentPage] = useState(1);

  const sortedProducts = useMemo(() => {
    if (!sortKey) return products;
    return [...products].sort((a, b) => {
      const valA = a[sortKey];
      const valB = b[sortKey];

      let comparison = 0;
      if (valA instanceof Date && valB instanceof Date) {
        comparison = valA.getTime() - valB.getTime();
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = valA - valB;
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = valA.localeCompare(valB);
      } else if (typeof valA === 'boolean' && typeof valB === 'boolean') {
        comparison = valA === valB ? 0 : (valA ? -1 : 1)
      }


      return sortOrder === 'asc' ? comparison : -comparison;
    });
  }, [products, sortKey, sortOrder]);

  const totalPages = Math.ceil(sortedProducts.length / itemsPerPage);

  useEffect(() => {
    const newTotalPages = Math.ceil(sortedProducts.length / itemsPerPage);
    if (currentPage > newTotalPages && newTotalPages > 0) {
      setCurrentPage(newTotalPages);
    } else if (newTotalPages === 0 && sortedProducts.length > 0) { 
      setCurrentPage(1);
    } else if (newTotalPages === 0 && sortedProducts.length === 0) { 
      setCurrentPage(1);
    } else if (currentPage === 0 && newTotalPages > 0) { 
        setCurrentPage(1);
    }
  }, [sortedProducts, currentPage, itemsPerPage]);


  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    const endIndex = startIndex + itemsPerPage;
    return sortedProducts.slice(startIndex, endIndex);
  }, [sortedProducts, currentPage, itemsPerPage]);


  const handleSort = (key: SortKey) => {
    if (!key) return; // Do not sort if key is empty (e.g. for columns that shouldn't be sortable)
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
  
  const TableSkeleton = () => (
    <TableRow>
      <TableCell colSpan={
        (showVtexIdColumn ? 1 : 0) +
        (showNameColumn ? 1 : 0) +
        (showStockColumn ? 1 : 0) +
        (showReadyToShipColumn ? 1 : 0) +
        (showOrderColumn ? 1 : 0) +
        (showCollectionColumn ? 1 : 0) +
        (showStartDateColumn ? 1 : 0) +
        (showEndDateColumn ? 1 : 0) +
        (showStatusColumn ? 1 : 0) || 1 // At least 1 colSpan
      }>
        <div className="space-y-2">
          {[...Array(5)].map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </TableCell>
    </TableRow>
  );


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <CardIcon className="mr-2 h-6 w-6 text-primary" />
          {cardTitle}
        </CardTitle>
        <CardDescription>
          Lista detalhada de produtos. Clique nos cabeçalhos das colunas para ordenar.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {(products.length === 0 && !isLoading) ? (
          <p className="text-center text-muted-foreground py-8">Nenhum dado de produto para exibir. Faça o upload de um arquivo Excel e processe-o.</p>
        ) : (
          <>
            <div className="overflow-x-auto">
              <Table>
                <TableHeader>
                  <TableRow>
                    {showVtexIdColumn && <TableHead onClick={() => handleSort('vtexId')} className="cursor-pointer hover:bg-muted/50 min-w-[100px]">ID VTEX {renderSortIcon('vtexId')}</TableHead>}
                    {showNameColumn && <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/50 min-w-[200px]">Nome {renderSortIcon('name')}</TableHead>}
                    {showStockColumn && <TableHead onClick={() => handleSort('stock')} className="cursor-pointer hover:bg-muted/50 text-right">Estoque {renderSortIcon('stock')}</TableHead>}
                    {showReadyToShipColumn && <TableHead onClick={() => handleSort('readyToShip')} className="cursor-pointer hover:bg-muted/50 text-right">Pronta Entrega {renderSortIcon('readyToShip')}</TableHead>}
                    {showOrderColumn && <TableHead onClick={() => handleSort('order')} className="cursor-pointer hover:bg-muted/50 text-right">Pedido {renderSortIcon('order')}</TableHead>}
                    {showCollectionColumn && <TableHead onClick={() => handleSort('collection')} className="cursor-pointer hover:bg-muted/50">Coleção {renderSortIcon('collection')}</TableHead>}
                    {showStartDateColumn && <TableHead onClick={() => handleSort('collectionStartDate')} className="cursor-pointer hover:bg-muted/50">Data Início {renderSortIcon('collectionStartDate')}</TableHead>}
                    {showEndDateColumn && <TableHead onClick={() => handleSort('collectionEndDate')} className="cursor-pointer hover:bg-muted/50">Data Fim {renderSortIcon('collectionEndDate')}</TableHead>}
                    {showStatusColumn && <TableHead>Status</TableHead>}
                  </TableRow>
                </TableHeader>
                <TableBody>
                  {isLoading ? <TableSkeleton /> : paginatedProducts.map((product, index) => {
                    const status = getCollectionStatus(product);
                    return (
                      <TableRow key={`${product.vtexId}-${index}-${currentPage}`}>
                        {showVtexIdColumn && <TableCell>{product.vtexId}</TableCell>}
                        {showNameColumn && <TableCell className="font-medium">{product.name}</TableCell>}
                        {showStockColumn && <TableCell className="text-right">{product.stock}</TableCell>}
                        {showReadyToShipColumn && <TableCell className="text-right">{product.readyToShip}</TableCell>}
                        {showOrderColumn && <TableCell className="text-right">{product.order}</TableCell>}
                        {showCollectionColumn && <TableCell>{product.collection}</TableCell>}
                        {showStartDateColumn && <TableCell>
                          {product.collectionStartDate && isValid(new Date(product.collectionStartDate))
                            ? format(new Date(product.collectionStartDate), 'dd/MM/yyyy')
                            : product.rawCollectionStartDate || 'N/A'}
                        </TableCell>}
                        {showEndDateColumn && <TableCell>
                          {product.collectionEndDate && isValid(new Date(product.collectionEndDate))
                            ? format(new Date(product.collectionEndDate), 'dd/MM/yyyy')
                            : product.rawCollectionEndDate || 'N/A'}
                        </TableCell>}
                        {showStatusColumn && <TableCell>
                          <Badge variant={status.variant} className={cn("whitespace-nowrap", status.colorClass)}>{status.text}</Badge>
                        </TableCell>}
                      </TableRow>
                    );
                  })}
                </TableBody>
              </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-6">
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
                  Página {currentPage} de {totalPages}
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
