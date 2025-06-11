
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { useProducts } from '@/contexts/ProductsContext';
import type { Product, AggregatedLinhaBrancaItem, LinhaBrancaStockStatus, LinhaBrancaItemType, SortCriteria, SortOrder } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Loader2, AlertTriangle, ShieldHalf, ShoppingBag, TrendingDown, PackageX, BarChart3, ListFilter, HelpCircle, Repeat, ThumbsUp, PlusCircle, MinusCircle, Layers, Percent, Eye, Inbox, Activity, TrendingUp as TrendingUpIcon, PackageCheck, CalendarDays, Search, ArrowUpDown, Zap } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format as formatDateFns } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { LinhaBrancaItemCard } from '@/components/domain/LinhaBrancaItemCard';
import { cn } from '@/lib/utils';

const LINHA_BRANCA_COLLECTION_NAME = "Linha Branca";
const LINHA_BRANCA_TARGET_COVERAGE_DAYS = 45;
const LINHA_BRANCA_MIN_SIGNIFICANT_DAILY_SALES = 0.1;
const LINHA_BRANCA_OVERSTOCK_FACTOR = 1.75;
const LINHA_BRANCA_LOW_STOCK_DAYS_THRESHOLD = 15;
const LINHA_BRANCA_CRITICAL_STOCK_DAYS_THRESHOLD = 5;
const LINHA_BRANCA_URGENT_STOCK_DAYS_THRESHOLD = 7;
const PILLOW_SALES_BASED_HIGH_SALES_THRESHOLD = 10;

const ALL_FILTER_VALUE = "_ALL_";

const getStatusProps = (status: LinhaBrancaStockStatus, daysOfStock?: number | null) => {
  switch (status) {
    case 'Critical':
      return { icon: PackageX, text: "CRÍTICO", color: "bg-red-600 text-white", tooltip: "Ruptura de estoque com VENDA RELEVANTE e sem pedidos em aberto ou reposição insuficiente." };
    case 'Urgent':
      return { icon: Zap, text: "URGENTE", color: "bg-orange-500 text-white", tooltip: `VENDA ALTA e cobertura de estoque muito baixa (<${daysOfStock?.toFixed(0) ?? '7'} dias). Ação rápida necessária.` };
    case 'Low':
      return { icon: TrendingDown, text: "BAIXO", color: "bg-yellow-500 text-black", tooltip: "Estoque baixo em relação à meta de cobertura de vendas. Monitorar/Repor." };
    case 'Healthy':
      return { icon: ThumbsUp, text: "SAUDÁVEL", color: "bg-green-500 text-white", tooltip: "Estoque alinhado com a demanda de vendas." };
    case 'Overstocked':
      return { icon: Repeat, text: "EXCESSO", color: "bg-blue-500 text-white", tooltip: "Estoque significativamente acima do ideal para a demanda atual." };
    case 'NoSales':
      return { icon: MinusCircle, text: "ESTAGNADO", color: "bg-slate-500 text-white", tooltip: "Produto com estoque, mas sem vendas significativas recentes." };
    default: // N/A
      return { icon: HelpCircle, text: "N/A", color: "bg-gray-400 text-white", tooltip: "Estoque zerado e sem vendas significativas recentes, ou dados insuficientes." };
  }
};

export default function LinhaBrancaEcosystemPage() {
  const { products: allProducts, isLoadingProducts, productsError, refetchProducts, lastDataUpdateTimestamp } = useProducts();
  const { toast } = useToast();
  
  const [aggregatedItems, setAggregatedItems] = useState<AggregatedLinhaBrancaItem[]>([]);
  const [filteredItems, setFilteredItems] = useState<AggregatedLinhaBrancaItem[]>([]);
  const [detailedItemForModal, setDetailedItemForModal] = useState<AggregatedLinhaBrancaItem | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedItemType, setSelectedItemType] = useState<string>(ALL_FILTER_VALUE);
  const [selectedSize, setSelectedSize] = useState<string>(ALL_FILTER_VALUE);
  const [selectedStatus, setSelectedStatus] = useState<LinhaBrancaStockStatus | typeof ALL_FILTER_VALUE>(ALL_FILTER_VALUE);
  const [sortCriteria, setSortCriteria] = useState<SortCriteria>('status');
  const [sortOrder, setSortOrder] = useState<SortOrder>('asc');

  const linhaBrancaProducts = useMemo(() => {
    return allProducts.filter(p => p.collection === LINHA_BRANCA_COLLECTION_NAME);
  }, [allProducts]);

  useEffect(() => {
    if (isLoadingProducts || productsError) {
      if (productsError && !isLoadingProducts) {
        toast({ title: "Erro ao carregar dados de Linha Branca", description: productsError, variant: "destructive" });
      }
      setAggregatedItems([]);
      return;
    }

    if (linhaBrancaProducts.length === 0) {
      setAggregatedItems([]);
      return;
    }

    const itemsMap = new Map<string, AggregatedLinhaBrancaItem>();

    linhaBrancaProducts.forEach(p => {
      const productNameNormalized = (p.name || 'desconhecido').toLowerCase().trim();
      const productSizeNormalized = (p.size || 'sem-tamanho').toLowerCase().trim();
      const aggregationId = `${productNameNormalized}-${productSizeNormalized}`;
      const itemType = p.productType || 'Outros';

      let entry = itemsMap.get(aggregationId);
      if (!entry) {
        entry = {
          id: aggregationId,
          productName: p.name || 'Produto Desconhecido',
          itemType: itemType,
          size: p.size || 'Sem Tamanho',
          totalStock: 0, totalSales30d: 0, totalOpenOrders: 0,
          dailyAverageSales: 0, daysOfStock: null, targetStock: 0,
          replenishmentSuggestion: 0, status: 'N/A', contributingSkus: [],
          vtexIdSample: p.vtexId,
          avgPrice: 0,
        };
      }
      entry.totalStock += (p.stock || 0);
      entry.totalSales30d += (p.sales30d || 0);
      entry.totalOpenOrders += (p.openOrders || 0);
      entry.contributingSkus.push(p);
      itemsMap.set(aggregationId, entry);
    });

    const finalAggregatedItems: AggregatedLinhaBrancaItem[] = [];
    itemsMap.forEach(item => {
      item.dailyAverageSales = item.totalSales30d > 0 ? item.totalSales30d / 30 : 0;
      item.targetStock = Math.round(item.dailyAverageSales * LINHA_BRANCA_TARGET_COVERAGE_DAYS);
      item.daysOfStock = item.dailyAverageSales > 0 ? item.totalStock / item.dailyAverageSales : (item.totalStock > 0 ? Infinity : 0);
      
      const totalEffectiveStock = item.totalStock + item.totalOpenOrders;
      item.replenishmentSuggestion = item.dailyAverageSales > 0 ? Math.max(0, Math.round(item.targetStock - totalEffectiveStock)) : 0;
      
      const skusWithPrice = item.contributingSkus.filter(s => typeof s.price === 'number');
      item.avgPrice = skusWithPrice.length > 0 ? skusWithPrice.reduce((sum, s) => sum + (s.price!), 0) / skusWithPrice.length : 0;

      if (item.dailyAverageSales < LINHA_BRANCA_MIN_SIGNIFICANT_DAILY_SALES) {
        item.status = item.totalStock > 0 ? 'NoSales' : 'N/A';
      } else {
        const effectiveCoverageWithOC = item.dailyAverageSales > 0 ? totalEffectiveStock / item.dailyAverageSales : (totalEffectiveStock > 0 ? Infinity : 0);
        
        if (item.totalStock === 0 && item.totalOpenOrders === 0) {
            item.status = 'Critical';
        } else if (item.daysOfStock < LINHA_BRANCA_CRITICAL_STOCK_DAYS_THRESHOLD && effectiveCoverageWithOC < LINHA_BRANCA_LOW_STOCK_DAYS_THRESHOLD) {
          item.status = 'Critical';
        } else if (item.daysOfStock < LINHA_BRANCA_URGENT_STOCK_DAYS_THRESHOLD && item.totalSales30d > PILLOW_SALES_BASED_HIGH_SALES_THRESHOLD) {
          item.status = 'Urgent';
        } else if (item.daysOfStock < LINHA_BRANCA_LOW_STOCK_DAYS_THRESHOLD) {
          item.status = 'Low';
        } else if (item.targetStock > 0 && (item.totalStock / item.targetStock) > LINHA_BRANCA_OVERSTOCK_FACTOR && item.daysOfStock > (LINHA_BRANCA_TARGET_COVERAGE_DAYS * LINHA_BRANCA_OVERSTOCK_FACTOR)) {
          item.status = 'Overstocked';
        } else {
          item.status = 'Healthy';
        }
      }
      finalAggregatedItems.push(item);
    });
    setAggregatedItems(finalAggregatedItems);
  }, [linhaBrancaProducts, isLoadingProducts, productsError, toast]);

  useEffect(() => {
    let tempFiltered = [...aggregatedItems];

    if (searchTerm) {
      tempFiltered = tempFiltered.filter(item =>
        item.productName.toLowerCase().includes(searchTerm.toLowerCase()) ||
        item.itemType.toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedItemType !== ALL_FILTER_VALUE) {
      tempFiltered = tempFiltered.filter(item => item.itemType === selectedItemType);
    }
    if (selectedSize !== ALL_FILTER_VALUE) {
      tempFiltered = tempFiltered.filter(item => item.size === selectedSize);
    }
    if (selectedStatus !== ALL_FILTER_VALUE) {
      tempFiltered = tempFiltered.filter(item => item.status === selectedStatus);
    }

    tempFiltered.sort((a, b) => {
      let comparison = 0;
      const valA = a[sortCriteria as keyof AggregatedLinhaBrancaItem];
      const valB = b[sortCriteria as keyof AggregatedLinhaBrancaItem];

      if (sortCriteria === 'status') {
        const orderMap: Record<LinhaBrancaStockStatus, number> = { 'Critical': 1, 'Urgent': 2, 'Low': 3, 'Healthy': 4, 'Overstocked': 5, 'NoSales': 6, 'N/A': 7 };
        comparison = (orderMap[a.status] || 99) - (orderMap[b.status] || 99);
      } else if (sortCriteria === 'daysOfStock') {
        const daysA = a.daysOfStock === null ? -1 : (Number.isFinite(a.daysOfStock) ? a.daysOfStock : Infinity);
        const daysB = b.daysOfStock === null ? -1 : (Number.isFinite(b.daysOfStock) ? b.daysOfStock : Infinity);
        comparison = daysA - daysB;
      } else if (typeof valA === 'number' && typeof valB === 'number') {
        comparison = (valA || 0) - (valB || 0);
      } else if (typeof valA === 'string' && typeof valB === 'string') {
        comparison = (valA || '').localeCompare(valB || '');
      }
      return sortOrder === 'asc' ? comparison : -comparison;
    });

    setFilteredItems(tempFiltered);
  }, [searchTerm, selectedItemType, selectedSize, selectedStatus, sortCriteria, sortOrder, aggregatedItems]);

  const availableItemTypes = useMemo(() => Array.from(new Set(aggregatedItems.map(item => item.itemType))).sort(), [aggregatedItems]);
  const availableSizes = useMemo(() => Array.from(new Set(aggregatedItems.map(item => item.size))).sort(), [aggregatedItems]);
  const availableStatuses: LinhaBrancaStockStatus[] = ['Critical', 'Urgent', 'Low', 'Healthy', 'Overstocked', 'NoSales', 'N/A'];

  const kpis = useMemo(() => {
    if (filteredItems.length === 0 && aggregatedItems.length > 0 && !isLoadingProducts) {
      return { criticalCount: 0, urgentCount: 0, lowCount: 0, healthyCount: 0, overstockedCount: 0, noSalesCount: 0, naCount:0, replenishmentNeededUnits: 0, totalItems: 0};
    }
    return {
      criticalCount: filteredItems.filter(i => i.status === 'Critical').length,
      urgentCount: filteredItems.filter(i => i.status === 'Urgent').length,
      lowCount: filteredItems.filter(i => i.status === 'Low').length,
      healthyCount: filteredItems.filter(i => i.status === 'Healthy').length,
      overstockedCount: filteredItems.filter(i => i.status === 'Overstocked').length,
      noSalesCount: filteredItems.filter(i => i.status === 'NoSales').length,
      naCount: filteredItems.filter(i => i.status === 'N/A').length,
      replenishmentNeededUnits: filteredItems.reduce((sum, item) => sum + item.replenishmentSuggestion, 0),
      totalItems: filteredItems.length,
    };
  }, [filteredItems, aggregatedItems, isLoadingProducts]);

  const urgentActions = useMemo(() => {
    return aggregatedItems
      .filter(item => (item.status === 'Critical' || item.status === 'Urgent') && item.replenishmentSuggestion > 0)
      .sort((a, b) => {
        const statusOrderVal = (status: LinhaBrancaStockStatus) => ({ 'Critical': 1, 'Urgent': 2, 'Low': 3, 'Healthy': 4, 'Overstocked': 5, 'NoSales': 6, 'N/A': 7 }[status] || 7);
        const statusComparison = statusOrderVal(a.status) - statusOrderVal(b.status);
        if (statusComparison !== 0) return statusComparison;
        return (b.dailyAverageSales) - (a.dailyAverageSales);
      })
      .slice(0, 5);
  }, [aggregatedItems]);

  const handleSort = (key: SortCriteria) => {
    if (sortCriteria === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortCriteria(key);
      setSortOrder('asc');
    }
  };

  if (isLoadingProducts && linhaBrancaProducts.length === 0 && !productsError) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando dados da Linha Branca...</p></div>;
  }

  if (productsError && linhaBrancaProducts.length === 0 && !isLoadingProducts) {
    return (
      <Card className="m-auto mt-10 max-w-lg text-center shadow-xl">
        <CardHeader><AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl">Erro ao Carregar Dados</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">{productsError}</p><Button onClick={() => refetchProducts()} className="mt-6">Tentar Novamente</Button></CardContent>
      </Card>
    );
  }
  
  const noLinhaBrancaProductsFound = allProducts.length > 0 && linhaBrancaProducts.length === 0 && !isLoadingProducts && !productsError;

  return (
    <div className="space-y-6">
      <Card className="shadow-lg border-t-4 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-bold">
            <ShieldHalf className="mr-3 h-8 w-8 text-primary" /> Análise Detalhada de Estoque: Linha Branca
          </CardTitle>
          <CardDescription>
            Visão granular da saúde do estoque, vendas e necessidades de reposição para cada item da Linha Branca.
            {lastDataUpdateTimestamp && (
                <span className="block text-xs text-muted-foreground mt-1 flex items-center"><CalendarDays className="h-3.5 w-3.5 mr-1.5"/>Dados atualizados em: {formatDateFns(lastDataUpdateTimestamp, 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {noLinhaBrancaProductsFound && (
         <Card className="shadow-md text-center py-10 border-l-4 border-blue-500">
            <CardHeader><CardTitle className="flex items-center justify-center text-xl"><Layers className="mr-2 h-7 w-7 text-primary" />Nenhum Produto "{LINHA_BRANCA_COLLECTION_NAME}"</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Não foram encontrados produtos com a coleção "{LINHA_BRANCA_COLLECTION_NAME}" nos dados carregados. Verifique a planilha no Dashboard.</p></CardContent>
         </Card>
      )}

      {linhaBrancaProducts.length > 0 && !productsError && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-lg font-semibold flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary"/>Painel de Controle Agregado (Filtros Aplicados)</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-5 xl:grid-cols-5 gap-3 text-xs">
                <KpiCardSmall title="Itens Exibidos" value={kpis.totalItems.toLocaleString()} icon={Eye} />
                <KpiCardSmall title="Críticos" value={kpis.criticalCount.toLocaleString()} icon={PackageX} color="text-red-600" />
                <KpiCardSmall title="Urgentes" value={kpis.urgentCount.toLocaleString()} icon={Zap} color="text-orange-500" />
                <KpiCardSmall title="Baixo Estoque" value={kpis.lowCount.toLocaleString()} icon={TrendingDown} color="text-yellow-600" />
                <KpiCardSmall title="Saudáveis" value={kpis.healthyCount.toLocaleString()} icon={ThumbsUp} color="text-green-600" />
                <KpiCardSmall title="Excesso" value={kpis.overstockedCount.toLocaleString()} icon={Repeat} color="text-blue-600" />
                <KpiCardSmall title="Estagnados" value={kpis.noSalesCount.toLocaleString()} icon={MinusCircle} color="text-slate-600" />
                <KpiCardSmall title="N/A" value={kpis.naCount.toLocaleString()} icon={HelpCircle} color="text-gray-500" />
                <KpiCardSmall title="Reposição Sug. (Total)" value={`${kpis.replenishmentNeededUnits.toLocaleString()} un.`} icon={PlusCircle} color="text-teal-600" className="xl:col-span-2"/>
            </CardContent>
          </Card>

          {urgentActions.length > 0 && (
            <Card className="border-red-600 shadow-lg">
              <CardHeader className="bg-red-600/5">
                <CardTitle className="text-red-700 flex items-center text-lg"><AlertTriangle className="mr-2 h-5 w-5"/>Top Ações Urgentes Sugeridas (Geral)</CardTitle>
                <CardDescription className="text-red-700/80 text-xs">Itens críticos ou urgentes com maior VMD e necessidade de reposição (baseado em todos os dados, não apenas nos filtros atuais).</CardDescription>
              </CardHeader>
              <CardContent className="pt-3 space-y-1.5">
                  {urgentActions.map(item => (
                    <div key={item.id} className="p-2 border border-red-400/30 rounded-md bg-red-500/5 hover:bg-red-500/10 transition-colors">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-red-800 text-xs truncate" title={item.productName}>{item.productName}</span>
                             <Badge variant="destructive" className="text-xxs flex-shrink-0">{item.status.toUpperCase()}</Badge>
                        </div>
                        <p className="text-xxs text-red-700/80">
                            Repor: <span className="font-bold">{item.replenishmentSuggestion.toLocaleString()} un.</span>
                            (Est.Agreg: {item.totalStock.toLocaleString()}, VMD Agreg: {item.dailyAverageSales.toFixed(1)})
                        </p>
                        <Button onClick={() => setDetailedItemForModal(item)} variant="link" size="xs" className="text-red-600 hover:text-red-700 p-0 h-auto text-xxs mt-0.5">
                           <Eye className="mr-1 h-3 w-3"/> Ver SKUs
                        </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}

          <Card>
            <CardHeader>
              <CardTitle className="text-lg font-semibold flex items-center"><ListFilter className="mr-2 h-5 w-5 text-primary"/>Filtros e Ordenação</CardTitle>
            </CardHeader>
            <CardContent className="space-y-4">
              <div>
                <Label htmlFor="searchTermLBE">Buscar por Nome/Tipo do Item</Label>
                <Input id="searchTermLBE" placeholder="Digite para buscar..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="mt-1"/>
              </div>
              <div className="grid grid-cols-2 md:grid-cols-3 gap-4">
                <div>
                  <Label htmlFor="itemTypeFilter">Tipo de Item</Label>
                  <Select value={selectedItemType} onValueChange={setSelectedItemType}><SelectTrigger id="itemTypeFilter" className="mt-1"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value={ALL_FILTER_VALUE}>Todos os Tipos</SelectItem>{availableItemTypes.map(type => <SelectItem key={type} value={type}>{type}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="sizeFilter">Tamanho</Label>
                  <Select value={selectedSize} onValueChange={setSelectedSize}><SelectTrigger id="sizeFilter" className="mt-1"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value={ALL_FILTER_VALUE}>Todos os Tamanhos</SelectItem>{availableSizes.map(size => <SelectItem key={size} value={size}>{size}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
                <div>
                  <Label htmlFor="statusFilter">Status de Vendas</Label>
                  <Select value={selectedStatus} onValueChange={(val) => setSelectedStatus(val as any)}><SelectTrigger id="statusFilter" className="mt-1"><SelectValue/></SelectTrigger>
                    <SelectContent><SelectItem value={ALL_FILTER_VALUE}>Todos os Status</SelectItem>{availableStatuses.map(s => <SelectItem key={s} value={s}>{getStatusProps(s).text}</SelectItem>)}</SelectContent>
                  </Select>
                </div>
              </div>
              <div className="grid grid-cols-2 gap-4">
                 <div>
                    <Label htmlFor="sortCriteriaLBE">Ordenar Por</Label>
                    <Select value={sortCriteria} onValueChange={(v) => setSortCriteria(v as SortCriteria)}><SelectTrigger id="sortCriteriaLBE" className="mt-1"><SelectValue /></SelectTrigger>
                        <SelectContent>
                            <SelectItem value="status">Status de Vendas</SelectItem>
                            <SelectItem value="productName">Nome do Produto</SelectItem>
                            <SelectItem value="daysOfStock">Dias de Cobertura</SelectItem>
                            <SelectItem value="replenishmentSuggestion">Sugestão de Reposição</SelectItem>
                            <SelectItem value="dailyAverageSales">VMD</SelectItem>
                            <SelectItem value="totalStock">Estoque Total</SelectItem>
                            <SelectItem value="itemType">Tipo de Item</SelectItem>
                            <SelectItem value="size">Tamanho</SelectItem>
                        </SelectContent>
                    </Select>
                 </div>
                 <div>
                    <Label htmlFor="sortOrderLBE">Ordem</Label>
                    <Button variant="outline" className="w-full mt-1" onClick={() => setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc')}>
                        {sortOrder === 'asc' ? "Crescente" : "Decrescente"} <ArrowUpDown className="ml-2 h-4 w-4 opacity-70"/>
                    </Button>
                 </div>
              </div>
            </CardContent>
          </Card>

          {isLoadingProducts && aggregatedItems.length === 0 && <div className="text-center py-6"><Loader2 className="mx-auto h-8 w-8 animate-spin text-primary"/><p className="mt-2 text-muted-foreground">Processando itens da Linha Branca...</p></div>}
          
          {!isLoadingProducts && filteredItems.length === 0 && aggregatedItems.length > 0 && (
            <Card className="text-center py-10 shadow-sm">
              <CardHeader><CardTitle className="flex items-center justify-center text-lg"><Search className="mr-2 h-6 w-6 text-muted-foreground"/>Nenhum Item Encontrado</CardTitle></CardHeader>
              <CardContent><p className="text-muted-foreground">Nenhum item da Linha Branca corresponde aos filtros selecionados.</p></CardContent>
            </Card>
          )}

          {filteredItems.length > 0 && (
            <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
              {filteredItems.map(item => (
                <LinhaBrancaItemCard key={item.id} item={item} onViewDetailsClick={setDetailedItemForModal} targetCoverageDays={LINHA_BRANCA_TARGET_COVERAGE_DAYS} />
              ))}
            </div>
          )}
        </>
      )}

      {detailedItemForModal && (
        <Dialog open={!!detailedItemForModal} onOpenChange={(isOpen) => { if (!isOpen) setDetailedItemForModal(null); }}>
          <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl">
            <DialogHeader>
              <DialogTitle className="text-xl">SKUs Detalhados para: {detailedItemForModal.productName}</DialogTitle>
              <DialogDescription>
                Tipo: {detailedItemForModal.itemType}, Tamanho: {detailedItemForModal.size}.
                <br/>
                Métricas Agregadas: Estoque {detailedItemForModal.totalStock}, VMD {detailedItemForModal.dailyAverageSales.toFixed(1)}, 
                Ped. Abertos {detailedItemForModal.totalOpenOrders}, Sug. Repor {detailedItemForModal.replenishmentSuggestion}. 
                Status: <span className="font-semibold">{getStatusProps(detailedItemForModal.status).text}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[60vh] overflow-y-auto mt-4 rounded-md border">
              {detailedItemForModal.contributingSkus.length > 0 ? (
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="min-w-[250px] whitespace-nowrap">Nome Produto (SKU)</TableHead>
                      <TableHead className="whitespace-nowrap">ID VTEX</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Estoque</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Venda 30d</TableHead>
                      <TableHead className="text-right whitespace-nowrap">VMD</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Ped. Abertos</TableHead>
                      <TableHead className="text-right whitespace-nowrap">Preço</TableHead>
                    </TableRow>
                  </TableHeader>
                  <TableBody>
                    {detailedItemForModal.contributingSkus.map(sku => (
                      <TableRow key={String(sku.vtexId) + '-' + sku.name + '-' + sku.productDerivation}>
                        <TableCell className="text-xs font-medium py-1.5" title={sku.name}>{sku.name} ({sku.productDerivation || 'SKU Base'})</TableCell>
                        <TableCell className="text-xs py-1.5">{String(sku.vtexId)}</TableCell>
                        <TableCell className="text-right text-xs py-1.5">{sku.stock.toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs py-1.5">{(sku.sales30d || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs py-1.5">{((sku.sales30d || 0) / 30).toFixed(1)}</TableCell>
                        <TableCell className="text-right text-xs py-1.5">{(sku.openOrders || 0).toLocaleString()}</TableCell>
                        <TableCell className="text-right text-xs py-1.5">{sku.price ? sku.price.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' }) : 'N/A'}</TableCell>
                      </TableRow>
                    ))}
                  </TableBody>
                </Table>
              ) : (
                <p className="text-muted-foreground text-center py-6">Nenhum SKU individual encontrado para este item agregado.</p>
              )}
            </div>
            <DialogFooter className="mt-4">
                <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
            </DialogFooter>
          </DialogContent>
        </Dialog>
      )}
    </div>
  );
}

interface KpiCardSmallProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  className?: string;
}

const KpiCardSmall: React.FC<KpiCardSmallProps> = ({ title, value, icon: Icon, color = "text-foreground", className }) => {
  return (
    <Card className={cn("shadow-sm hover:shadow transition-shadow p-2", className)}>
      <div className="flex items-center justify-between space-x-1">
        <p className="text-xxs font-medium text-muted-foreground truncate" title={title}>{title}</p>
        <Icon className={cn("h-3.5 w-3.5 flex-shrink-0", color)} />
      </div>
      <p className={`text-base font-bold ${color} truncate`} title={String(value)}>{value}</p>
    </Card>
  );
};

