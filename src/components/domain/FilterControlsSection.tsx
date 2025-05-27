
'use client';

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
// Popover, Calendar, CalendarIcon, format, cn from 'date-fns' and 'lucide-react' imports removed as date filters are gone
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Product, FilterState } from '@/types';
import { FilterXIcon, SearchIcon } from 'lucide-react';


interface FilterControlsSectionProps {
  products: Product[]; // products prop might not be directly used here if availableCollections and availableProductTypes are passed
  onFilterChange: (filters: FilterState) => void;
  availableCollections: string[];
  availableProductTypes: string[]; // New prop
}

const ALL_COLLECTIONS_VALUE = "_ALL_COLLECTIONS_";
const ALL_PRODUCT_TYPES_VALUE = "_ALL_PRODUCT_TYPES_"; // New constant

const initialFilterState: FilterState = {
  collection: ALL_COLLECTIONS_VALUE,
  stockMin: '',
  stockMax: '',
  productType: ALL_PRODUCT_TYPES_VALUE, // Added productType
  // Removed date fields
};

export function FilterControlsSection({ 
  onFilterChange, 
  availableCollections,
  availableProductTypes 
}: FilterControlsSectionProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilterState);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  // handleDateChange removed as date filters are gone

  const applyFilters = () => {
    onFilterChange(filters);
  };

  const clearFilters = () => {
    setFilters(initialFilterState);
    onFilterChange(initialFilterState);
  };
  
  return (
    <Card className="shadow-sm border-border">
      <CardHeader className="pb-4">
        <CardTitle className="flex items-center text-lg">
          <SearchIcon className="mr-2 h-5 w-5 text-primary" />
          Filtros Adicionais
        </CardTitle>
        <CardDescription className="text-sm">
          Refine a lista de produtos por coleção, tipo, níveis de estoque.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4 pt-0">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
          <div>
            <Label htmlFor="collection">Coleção (Desc. Linha Comercial)</Label>
            <Select
              name="collection"
              value={filters.collection}
              onValueChange={(value) => handleSelectChange('collection', value)}
            >
              <SelectTrigger id="collection" className="mt-1">
                <SelectValue placeholder="Todas as Coleções" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COLLECTIONS_VALUE}>Todas as Coleções</SelectItem>
                {availableCollections.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="productType">Tipo de Produto (Excel)</Label>
            <Select
              name="productType"
              value={filters.productType}
              onValueChange={(value) => handleSelectChange('productType', value)}
            >
              <SelectTrigger id="productType" className="mt-1">
                <SelectValue placeholder="Todos os Tipos" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_PRODUCT_TYPES_VALUE}>Todos os Tipos</SelectItem>
                {availableProductTypes.map(pt => (
                  <SelectItem key={pt} value={pt}>{pt}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="stockMin">Estoque Mín.</Label>
            <Input
              type="number"
              id="stockMin"
              name="stockMin"
              value={filters.stockMin}
              onChange={handleInputChange}
              placeholder="Ex: 0"
              className="mt-1"
            />
          </div>
          <div>
            <Label htmlFor="stockMax">Estoque Máx. (para filtros gerais)</Label>
            <Input
              type="number"
              id="stockMax"
              name="stockMax"
              value={filters.stockMax}
              onChange={handleInputChange}
              placeholder="Ex: 50"
              className="mt-1"
            />
          </div>
        </div>

        {/* Date filter sections removed */}

        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={clearFilters} size="sm">
            <FilterXIcon className="mr-2 h-4 w-4" />
            Limpar Filtros
          </Button>
          {/* The applyFilters button is now part of the parent component (RestockOpportunitiesPage)
              to explicitly trigger filtering along with the low stock threshold.
              If general filters should apply immediately, onFilterChange can be called
              directly in handleInputChange/handleSelectChange or via a useEffect.
              For now, we keep the explicit "Apply" button in the parent.
          */}
        </div>
      </CardContent>
    </Card>
  );
}
