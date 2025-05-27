'use client';

import { useState, useMemo } from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import type { Product } from '@/types';
import { format, isBefore, isAfter, addDays, isValid } from 'date-fns';
import { ArrowUpDown, ListChecks } from 'lucide-react';
import { Skeleton } from '@/components/ui/skeleton';

interface ProductDataTableSectionProps {
  products: Product[];
  isLoading: boolean;
}

type SortKey = keyof Product | '';
type SortOrder = 'asc' | 'desc';

const getCollectionStatus = (product: Product): { text: string; variant: 'default' | 'secondary' | 'destructive' | 'outline', colorClass?: string } => {
  const today = new Date();
  today.setHours(0,0,0,0); // Normalize today to start of day

  if (product.collectionEndDate && isValid(product.collectionEndDate)) {
    const endDate = product.collectionEndDate;
    endDate.setHours(0,0,0,0); // Normalize end date

    if (isBefore(endDate, today)) {
      return product.stock > 0 
        ? { text: 'Past Collection (Stocked)', variant: 'destructive', colorClass: 'bg-destructive/80 text-destructive-foreground' } 
        : { text: 'Past Collection (OOS)', variant: 'outline' };
    }
    if (isBefore(endDate, addDays(today, 30))) {
      return { text: 'Nearing End', variant: 'default', colorClass: 'bg-accent text-accent-foreground' };
    }
  }
  if (!product.isCurrentCollection && product.stock > 0) {
     return { text: 'Not Current (Stocked)', variant: 'secondary' };
  }
  if (product.isCurrentCollection) {
    return { text: 'Current Collection', variant: 'default', colorClass: 'bg-primary/80 text-primary-foreground' };
  }
  return { text: 'Status N/A', variant: 'outline' };
};


export function ProductDataTableSection({ products, isLoading }: ProductDataTableSectionProps) {
  const [sortKey, setSortKey] = useState<SortKey>('name');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

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

  const handleSort = (key: SortKey) => {
    if (sortKey === key) {
      setSortOrder(prevOrder => (prevOrder === 'asc' ? 'desc' : 'asc'));
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
  };

  const renderSortIcon = (key: SortKey) => {
    if (sortKey === key) {
      return sortOrder === 'asc' ? <ArrowUpDown className="h-4 w-4 inline ml-1 transform rotate-180" /> : <ArrowUpDown className="h-4 w-4 inline ml-1" />;
    }
    return <ArrowUpDown className="h-4 w-4 inline ml-1 opacity-30" />;
  };
  
  const TableSkeleton = () => (
    <TableRow>
      <TableCell colSpan={6}>
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
          <ListChecks className="mr-2 h-6 w-6 text-primary" />
          Product Data
        </CardTitle>
        <CardDescription>
          Detailed list of products from the uploaded file. Click headers to sort.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {products.length === 0 && !isLoading ? (
          <p className="text-center text-muted-foreground py-8">No product data to display. Upload an Excel file and process it.</p>
        ) : (
          <div className="overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/50 min-w-[200px]">Name {renderSortIcon('name')}</TableHead>
                  <TableHead onClick={() => handleSort('stock')} className="cursor-pointer hover:bg-muted/50 text-right">Stock {renderSortIcon('stock')}</TableHead>
                  <TableHead onClick={() => handleSort('collection')} className="cursor-pointer hover:bg-muted/50">Collection {renderSortIcon('collection')}</TableHead>
                  <TableHead onClick={() => handleSort('collectionStartDate')} className="cursor-pointer hover:bg-muted/50">Start Date {renderSortIcon('collectionStartDate')}</TableHead>
                  <TableHead onClick={() => handleSort('collectionEndDate')} className="cursor-pointer hover:bg-muted/50">End Date {renderSortIcon('collectionEndDate')}</TableHead>
                  <TableHead>Status</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {isLoading ? <TableSkeleton /> : sortedProducts.map((product, index) => {
                  const status = getCollectionStatus(product);
                  return (
                    <TableRow key={`${product.vtexId}-${index}`}>
                      <TableCell className="font-medium">{product.name}</TableCell>
                      <TableCell className="text-right">{product.stock}</TableCell>
                      <TableCell>{product.collection}</TableCell>
                      <TableCell>
                        {product.collectionStartDate && isValid(product.collectionStartDate)
                          ? format(product.collectionStartDate, 'dd/MM/yyyy')
                          : product.rawCollectionStartDate || 'N/A'}
                      </TableCell>
                      <TableCell>
                        {product.collectionEndDate && isValid(product.collectionEndDate)
                          ? format(product.collectionEndDate, 'dd/MM/yyyy')
                          : product.rawCollectionEndDate || 'N/A'}
                      </TableCell>
                      <TableCell>
                        <Badge variant={status.variant} className={cn("whitespace-nowrap", status.colorClass)}>{status.text}</Badge>
                      </TableCell>
                    </TableRow>
                  );
                })}
              </TableBody>
            </Table>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
