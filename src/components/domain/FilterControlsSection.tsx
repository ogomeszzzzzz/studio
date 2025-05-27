'use client';

import type { ChangeEvent } from 'react';
import { useState, useEffect } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Popover, PopoverContent, PopoverTrigger } from '@/components/ui/popover';
import { Calendar } from '@/components/ui/calendar';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import type { Product, FilterState } from '@/types';
import { format, isValid } from 'date-fns';
import { CalendarIcon, FilterXIcon, SearchIcon } from 'lucide-react';
import { cn } from '@/lib/utils';

interface FilterControlsSectionProps {
  products: Product[];
  onFilterChange: (filters: FilterState) => void;
  availableCollections: string[];
}

const initialFilterState: FilterState = {
  collection: '',
  stockMin: '',
  stockMax: '',
  startDateFrom: undefined,
  startDateTo: undefined,
  endDateFrom: undefined,
  endDateTo: undefined,
};

export function FilterControlsSection({ products, onFilterChange, availableCollections }: FilterControlsSectionProps) {
  const [filters, setFilters] = useState<FilterState>(initialFilterState);

  const handleInputChange = (e: ChangeEvent<HTMLInputElement>) => {
    const { name, value } = e.target;
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleSelectChange = (name: string, value: string) => {
    setFilters(prev => ({ ...prev, [name]: value }));
  };

  const handleDateChange = (name: keyof FilterState, date: Date | undefined) => {
    setFilters(prev => ({ ...prev, [name]: date }));
  };

  const applyFilters = () => {
    onFilterChange(filters);
  };

  const clearFilters = () => {
    setFilters(initialFilterState);
    onFilterChange(initialFilterState);
  };
  
  // Effect to apply filters when 'filters' state changes, useful for immediate feedback or if a dedicated "Apply" button is not always desired.
  // For now, we rely on the explicit "Apply Filters" button.
  // useEffect(() => {
  //   onFilterChange(filters);
  // }, [filters, onFilterChange]);


  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <SearchIcon className="mr-2 h-6 w-6 text-primary" />
          Filter Products
        </CardTitle>
        <CardDescription>
          Refine the product list by collection, stock levels, and date ranges.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          <div>
            <Label htmlFor="collection">Collection</Label>
            <Select
              name="collection"
              value={filters.collection}
              onValueChange={(value) => handleSelectChange('collection', value)}
            >
              <SelectTrigger id="collection">
                <SelectValue placeholder="All Collections" />
              </SelectTrigger>
              <SelectContent>
                <SelectItem value="">All Collections</SelectItem>
                {availableCollections.map(c => (
                  <SelectItem key={c} value={c}>{c}</SelectItem>
                ))}
              </SelectContent>
            </Select>
          </div>
          <div>
            <Label htmlFor="stockMin">Min Stock</Label>
            <Input
              type="number"
              id="stockMin"
              name="stockMin"
              value={filters.stockMin}
              onChange={handleInputChange}
              placeholder="e.g., 10"
            />
          </div>
          <div>
            <Label htmlFor="stockMax">Max Stock</Label>
            <Input
              type="number"
              id="stockMax"
              name="stockMax"
              value={filters.stockMax}
              onChange={handleInputChange}
              placeholder="e.g., 100"
            />
          </div>
        </div>

        <div className="grid grid-cols-1 md:grid-cols-2 gap-6">
          <fieldset className="space-y-2 p-4 border rounded-md">
            <legend className="text-sm font-medium px-1">Collection Start Date</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="startDateFrom">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="startDateFrom"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.startDateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.startDateFrom ? format(filters.startDateFrom, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.startDateFrom}
                      onSelect={(date) => handleDateChange('startDateFrom', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="startDateTo">To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="startDateTo"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.startDateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.startDateTo ? format(filters.startDateTo, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.startDateTo}
                      onSelect={(date) => handleDateChange('startDateTo', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </fieldset>

          <fieldset className="space-y-2 p-4 border rounded-md">
            <legend className="text-sm font-medium px-1">Collection End Date</legend>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
              <div>
                <Label htmlFor="endDateFrom">From</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="endDateFrom"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.endDateFrom && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.endDateFrom ? format(filters.endDateFrom, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.endDateFrom}
                      onSelect={(date) => handleDateChange('endDateFrom', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
              <div>
                <Label htmlFor="endDateTo">To</Label>
                <Popover>
                  <PopoverTrigger asChild>
                    <Button
                      id="endDateTo"
                      variant="outline"
                      className={cn(
                        "w-full justify-start text-left font-normal",
                        !filters.endDateTo && "text-muted-foreground"
                      )}
                    >
                      <CalendarIcon className="mr-2 h-4 w-4" />
                      {filters.endDateTo ? format(filters.endDateTo, "PPP") : <span>Pick a date</span>}
                    </Button>
                  </PopoverTrigger>
                  <PopoverContent className="w-auto p-0">
                    <Calendar
                      mode="single"
                      selected={filters.endDateTo}
                      onSelect={(date) => handleDateChange('endDateTo', date)}
                      initialFocus
                    />
                  </PopoverContent>
                </Popover>
              </div>
            </div>
          </fieldset>
        </div>
        <div className="flex justify-end space-x-2 pt-4">
          <Button variant="outline" onClick={clearFilters}>
            <FilterXIcon className="mr-2 h-4 w-4" />
            Clear Filters
          </Button>
          <Button onClick={applyFilters}>
            Apply Filters
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}
