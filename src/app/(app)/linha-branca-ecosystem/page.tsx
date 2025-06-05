
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useProducts } from '@/contexts/ProductsContext';
import type { Product, AggregatedLinhaBrancaItem, LinhaBrancaStockStatus, LinhaBrancaItemType } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ShieldHalf, ShoppingBag, TrendingDown, PackageX, BarChart3, ListFilter, HelpCircle, Repeat, ThumbsUp, PlusCircle, MinusCircle, Layers, Percent, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format as formatDateFns } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LINHA_BRANCA_COLLECTION_NAME = "Linha Branca";
const LINHA_BRANCA_TARGET_COVERAGE_DAYS = 45;
const LINHA_BRANCA_MIN_SIGNIFICANT_DAILY_SALES = 0.1; // Approx 3 sales/month
const LINHA_BRANCA_OVERSTOCK_FACTOR = 1.75; // If stock is > 175% of ideal for target coverage
const LINHA_BRANCA_LOW_STOCK_DAYS = 15; // Less than this is considered low
const LINHA_BRANCA_CRITICAL_STOCK_DAYS = 5; // Less than this is critical if sales are significant

const COMMON_SIZES_ORDER = ['Solteiro', 'Solteiro King', 'Casal', 'Queen', 'King', 'Super King', 'Berço'];

const getItemTypeAndCleanName = (productName: string, productType?: string): { itemType: LinhaBrancaItemType, cleanedName: string } => {
  const pNameLower = productName.toLowerCase();
  const pTypeLower = productType?.toLowerCase() || '';

  if (pNameLower.includes('protetor') && pNameLower.includes('colchão') || pTypeLower.includes('protetor de colchao')) return { itemType: 'Protetor de Colchão', cleanedName: productName.replace(/protetor de colchão/gi, '').trim() };
  if (pNameLower.includes('protetor') && pNameLower.includes('travesseiro') || pTypeLower.includes('protetor de travesseiro')) return { itemType: 'Protetor de Travesseiro', cleanedName: productName.replace(/protetor de travesseiro/gi, '').trim() };
  if (pNameLower.includes('saia') && pNameLower.includes('box') || pTypeLower.includes('saia box')) return { itemType: 'Saia Box', cleanedName: productName.replace(/saia box/gi, '').trim() };
  
  // Fallback using productType more broadly if specific keywords aren't in name
  if (pTypeLower.includes('protetor') && pTypeLower.includes('colchao')) return { itemType: 'Protetor de Colchão', cleanedName: productName };
  if (pTypeLower.includes('protetor') && pTypeLower.includes('travesseiro')) return { itemType: 'Protetor de Travesseiro', cleanedName: productName };
  if (pTypeLower.includes('saia')) return { itemType: 'Saia Box', cleanedName: productName };

  return { itemType: 'Outros', cleanedName: productName };
};

interface LinhaBrancaItemWidgetProps {
  item: AggregatedLinhaBrancaItem;
}

const LinhaBrancaItemWidget: React.FC<LinhaBrancaItemWidgetProps> = ({ item }) => {
  let statusColorClass = "bg-gray-500";
  let statusIcon = <HelpCircle className="h-4 w-4" />;
  let stockPercentage = 0;
  if (item.targetStock > 0) {
    stockPercentage = Math.min((item.totalStock / item.targetStock) * 100, 150); // Cap at 150% for visual
  } else if (item.totalStock > 0) {
    stockPercentage = 150; // Show as overstocked if target is 0 but stock exists
  }


  switch (item.status) {
    case 'Critical': statusColorClass = 'bg-red-600'; statusIcon = <PackageX className="h-4 w-4" />; break;
    case 'Low': statusColorClass = 'bg-yellow-500'; statusIcon = <TrendingDown className="h-4 w-4" />; break;
    case 'Healthy': statusColorClass = 'bg-green-600'; statusIcon = <ThumbsUp className="h-4 w-4" />; break;
    case 'Overstocked': statusColorClass = 'bg-blue-500'; statusIcon = <Repeat className="h-4 w-4" />; break;
    case 'NoSales': statusColorClass = 'bg-slate-500'; statusIcon = <MinusCircle className="h-4 w-4" />; break;
    default: statusIcon = <HelpCircle className="h-4 w-4" />; break;
  }

  return (
    <Dialog>
      <TooltipProvider>
        <Tooltip>
          <TooltipTrigger asChild>
            <DialogTrigger asChild>
              <Card className="hover:shadow-lg transition-shadow cursor-pointer flex flex-col h-full">
                <CardHeader className="p-3 pb-1">
                  <CardTitle className="text-sm font-semibold leading-tight truncate" title={item.displayName}>
                    {item.displayName}
                  </CardTitle>
                   <Badge variant={item.status === 'Critical' || item.status === 'Low' ? 'destructive' : item.status === 'Overstocked' ? 'default': 'outline'} className={`text-xs ${statusColorClass} text-white self-start`}>
                     {statusIcon} <span className="ml-1">{item.status}</span>
                   </Badge>
                </CardHeader>
                <CardContent className="p-3 pt-1 space-y-1.5 text-xs flex-grow flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between">
                      <span>Estoque:</span>
                      <span className="font-bold">{item.totalStock.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VMD:</span>
                      <span className="font-medium">{item.dailyAverageSales.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cob (dias):</span>
                      <span className="font-medium">{item.daysOfStock === null ? 'N/A' : Number.isFinite(item.daysOfStock) ? item.daysOfStock.toFixed(0) : '∞'}</span>
                    </div>
                     <div className="flex justify-between">
                      <span>Abertos:</span>
                      <span className="font-medium">{item.totalOpenOrders.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-auto">
                    {item.replenishmentSuggestion > 0 && (
                      <Badge variant="default" className="w-full justify-center bg-green-600 hover:bg-green-700 text-xs mt-1">
                        <PlusCircle className="mr-1 h-3 w-3" /> Repor: {item.replenishmentSuggestion.toLocaleString()}
                      </Badge>
                    )}
                    <Progress value={stockPercentage} className={`h-2 mt-1.5 ${statusColorClass}`} />
                     <p className="text-xxs text-muted-foreground text-center mt-0.5">Est. vs Alvo ({item.targetStock.toLocaleString()} un)</p>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Status: {item.status}. Estoque Alvo: {item.targetStock.toLocaleString()} un.</p>
            <p>Clique para ver SKUs detalhados.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-xl">
        <DialogHeader>
          <DialogTitle>{item.displayName} - SKUs Detalhados</DialogTitle>
          <DialogDescription>
            Lista de SKUs que compõem este item agregado.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Nome Produto</TableHead>
                <TableHead>ID VTEX</TableHead>
                <TableHead className="text-right">Estoque</TableHead>
                <TableHead className="text-right">Venda 30d</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {item.contributingSkus.map(sku => (
                <TableRow key={sku.vtexId + '-' + sku.name}>
                  <TableCell className="text-xs">{sku.name}</TableCell>
                  <TableCell className="text-xs">{String(sku.vtexId)}</TableCell>
                  <TableCell className="text-right text-xs">{sku.stock.toLocaleString()}</TableCell>
                  <TableCell className="text-right text-xs">{sku.sales30d?.toLocaleString() || '0'}</TableCell>
                </TableRow>
              ))}
            </TableBody>
          </Table>
        </div>
      </DialogContent>
    </Dialog>
  );
};


export default function LinhaBrancaEcosystemPage() {
  const { products: allProducts, isLoadingProducts, productsError, refetchProducts, lastDataUpdateTimestamp } = useProducts();
  const { toast } = useToast();

  const [processedLinhaBrancaData, setProcessedLinhaBrancaData] = useState<LinhaBrancaBedSizeSummary[]>([]);

  useEffect(() => {
    if (isLoadingProducts || productsError) return;

    const linhaBrancaProducts = allProducts.filter(p => p.collection === LINHA_BRANCA_COLLECTION_NAME);

    if (linhaBrancaProducts.length === 0) {
      setProcessedLinhaBrancaData([]);
      return;
    }

    const aggregatedMap = new Map<string, AggregatedLinhaBrancaItem>();

    linhaBrancaProducts.forEach(p => {
      const { itemType } = getItemTypeAndCleanName(p.name, p.productType);
      const size = p.size || 'Tamanho Único';
      const id = `${itemType}-${size}`;

      let entry = aggregatedMap.get(id);
      if (!entry) {
        entry = {
          id,
          itemType,
          size,
          displayName: `${itemType} ${size}`,
          totalStock: 0,
          totalSales30d: 0,
          totalOpenOrders: 0,
          dailyAverageSales: 0,
          daysOfStock: null,
          targetStock: 0,
          replenishmentSuggestion: 0,
          status: 'N/A',
          contributingSkus: [],
        };
      }
      entry.totalStock += p.stock || 0;
      entry.totalSales30d += p.sales30d || 0;
      entry.totalOpenOrders += p.openOrders || 0;
      entry.contributingSkus.push(p);
      aggregatedMap.set(id, entry);
    });

    const finalAggregatedItems: AggregatedLinhaBrancaItem[] = [];
    aggregatedMap.forEach(item => {
      item.dailyAverageSales = item.totalSales30d > 0 ? item.totalSales30d / 30 : 0;
      item.targetStock = Math.round(item.dailyAverageSales * LINHA_BRANCA_TARGET_COVERAGE_DAYS);
      item.daysOfStock = item.dailyAverageSales > 0 ? item.totalStock / item.dailyAverageSales : (item.totalStock > 0 ? Infinity : 0);
      item.replenishmentSuggestion = item.dailyAverageSales > 0 ? Math.max(0, Math.round(item.targetStock - item.totalStock - item.totalOpenOrders)) : 0;

      if (item.dailyAverageSales < LINHA_BRANCA_MIN_SIGNIFICANT_DAILY_SALES) {
        item.status = item.totalStock > 0 ? 'NoSales' : 'N/A';
      } else {
        if (item.daysOfStock !== null && item.daysOfStock < LINHA_BRANCA_CRITICAL_STOCK_DAYS && item.totalOpenOrders < item.replenishmentSuggestion ) item.status = 'Critical';
        else if (item.daysOfStock !== null && item.daysOfStock < LINHA_BRANCA_LOW_STOCK_DAYS) item.status = 'Low';
        else if (item.targetStock > 0 && (item.totalStock / item.targetStock) > LINHA_BRANCA_OVERSTOCK_FACTOR && item.daysOfStock && item.daysOfStock > (LINHA_BRANCA_TARGET_COVERAGE_DAYS * LINHA_BRANCA_OVERSTOCK_FACTOR)) item.status = 'Overstocked';
        else item.status = 'Healthy';
      }
      finalAggregatedItems.push(item);
    });

    const bySize: Record<string, AggregatedLinhaBrancaItem[]> = {};
    finalAggregatedItems.forEach(item => {
      if (!bySize[item.size]) bySize[item.size] = [];
      bySize[item.size].push(item);
    });
    
    const bedSizeSummaries: LinhaBrancaBedSizeSummary[] = Object.entries(bySize)
      .map(([size, items]) => {
        let criticalCount = 0;
        let lowCount = 0;
        items.forEach(it => {
          if (it.status === 'Critical') criticalCount++;
          if (it.status === 'Low') lowCount++;
        });
        let overallHarmonyStatus: LinhaBrancaBedSizeSummary['overallHarmonyStatus'] = 'Good';
        if (criticalCount > 0) overallHarmonyStatus = 'Critical';
        else if (lowCount > 0) overallHarmonyStatus = 'NeedsAttention';
        
        return { size, items: items.sort((a,b) => a.itemType.localeCompare(b.itemType)), overallHarmonyStatus };
      })
      .sort((a, b) => {
        const indexA = COMMON_SIZES_ORDER.indexOf(a.size);
        const indexB = COMMON_SIZES_ORDER.indexOf(b.size);
        if (indexA !== -1 && indexB !== -1) return indexA - indexB;
        if (indexA !== -1) return -1;
        if (indexB !== -1) return 1;
        return a.size.localeCompare(b.size);
      });

    setProcessedLinhaBrancaData(bedSizeSummaries);

  }, [allProducts, isLoadingProducts, productsError]);

  const kpis = useMemo(() => {
    const allAggregatedItems = processedLinhaBrancaData.flatMap(s => s.items);
    if (allAggregatedItems.length === 0) return { totalStockValue: 0, outOfStockSkus: 0, overstockedSkus: 0, replenishmentNeededUnits: 0 };

    let totalStockValue = 0; // Placeholder, price not available in Product for now
    let outOfStockSkus = 0;
    let overstockedSkus = 0;
    let replenishmentNeededUnits = 0;

    allAggregatedItems.forEach(item => {
      // totalStockValue += item.totalStock * (item.contributingSkus[0]?.price || 0); // Needs price
      if (item.status === 'Critical' || (item.status === 'Low' && item.totalStock === 0)) {
         item.contributingSkus.filter(s => s.stock === 0).forEach(() => outOfStockSkus++);
      }
      if (item.status === 'Overstocked') {
         item.contributingSkus.forEach(() => overstockedSkus++);
      }
      replenishmentNeededUnits += item.replenishmentSuggestion;
    });

    return { totalStockValue, outOfStockSkus, overstockedSkus, replenishmentNeededUnits };
  }, [processedLinhaBrancaData]);
  
  const urgentActions = useMemo(() => {
    return processedLinhaBrancaData
      .flatMap(s => s.items)
      .filter(item => (item.status === 'Critical' || item.status === 'Low') && item.replenishmentSuggestion > 0)
      .sort((a, b) => (b.dailyAverageSales) - (a.dailyAverageSales)) // Higher VMD first
      .sort((a,b) => (a.status === 'Critical' ? -1 : 1) - (b.status === 'Critical' ? -1 : 1)) // Critical first
      .slice(0, 5);
  }, [processedLinhaBrancaData]);


  if (isLoadingProducts) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando dados...</p></div>;
  }

  if (productsError) {
    return (
      <Card className="m-auto mt-10 max-w-lg text-center shadow-xl">
        <CardHeader><AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl">Erro ao Carregar Dados</CardTitle></CardHeader>
        <CardContent><p className="text-muted-foreground">{productsError}</p><Button onClick={() => refetchProducts()} className="mt-6">Tentar Novamente</Button></CardContent>
      </Card>
    );
  }
  
  const linhaBrancaOriginalProducts = allProducts.filter(p => p.collection === LINHA_BRANCA_COLLECTION_NAME);

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-bold">
            <ShieldHalf className="mr-3 h-8 w-8 text-primary" /> Ecossistema de Estoque Linha Branca
          </CardTitle>
          <CardDescription>
            Visão integrada do estoque de itens da Linha Branca (Protetores, Saias) por tamanho de cama,
            analisando saúde do estoque, vendas e necessidades de reposição.
            {lastDataUpdateTimestamp && (
                <span className="block text-xs text-muted-foreground mt-1">Dados atualizados em: {formatDateFns(lastDataUpdateTimestamp, 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {linhaBrancaOriginalProducts.length === 0 && !isLoadingProducts && (
         <Card className="shadow-md text-center py-10">
            <CardHeader><CardTitle className="flex items-center justify-center text-xl"><Layers className="mr-2 h-7 w-7 text-primary" />Nenhum Produto "Linha Branca"</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Não foram encontrados produtos com a coleção "{LINHA_BRANCA_COLLECTION_NAME}" nos dados carregados.</p></CardContent>
         </Card>
      )}

      {linhaBrancaOriginalProducts.length > 0 && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-lg">Painel de Controle Geral - Linha Branca</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
              <Card className="bg-card shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">SKUs Críticos/Baixos (Venda)</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-destructive">{kpis.outOfStockSkus.toLocaleString()}</p><p className="text-xs text-muted-foreground">SKUs com VMD > {LINHA_BRANCA_MIN_SIGNIFICANT_DAILY_SALES.toFixed(1)} e status Crítico/Baixo</p></CardContent>
              </Card>
              <Card className="bg-card shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">SKUs Superestocados (Venda)</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-blue-600">{kpis.overstockedSkus.toLocaleString()}</p><p className="text-xs text-muted-foreground">SKUs com estoque > {LINHA_BRANCA_OVERSTOCK_FACTOR * 100}% do alvo de vendas</p></CardContent>
              </Card>
              <Card className="bg-card shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Total Reposição Sugerida</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-green-600">{kpis.replenishmentNeededUnits.toLocaleString()} un.</p><p className="text-xs text-muted-foreground">Para cobrir {LINHA_BRANCA_TARGET_COVERAGE_DAYS} dias de venda</p></CardContent>
              </Card>
               <Card className="bg-card shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Itens Agregados Analisados</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{processedLinhaBrancaData.flatMap(s => s.items).length}</p><p className="text-xs text-muted-foreground">(Tipo + Tamanho)</p></CardContent>
              </Card>
            </CardContent>
          </Card>

          {urgentActions.length > 0 && (
            <Card className="border-destructive">
              <CardHeader>
                <CardTitle className="text-destructive flex items-center"><AlertTriangle className="mr-2"/>Ações Urgentes Sugeridas ({urgentActions.length})</CardTitle>
                <CardDescription>Itens críticos ou baixos com maior VMD precisando de reposição.</CardDescription>
              </CardHeader>
              <CardContent>
                <ul className="space-y-1 text-sm">
                  {urgentActions.map(item => (
                    <li key={item.id} className="p-1.5 bg-destructive/5 rounded-md">
                      <span className="font-semibold">{item.displayName}</span>: Repor <span className="font-bold">{item.replenishmentSuggestion} un</span>. (Est: {item.totalStock}, VMD: {item.dailyAverageSales.toFixed(1)}, Status: <span className="font-medium">{item.status}</span>)
                    </li>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}

          <div className="space-y-8">
            {processedLinhaBrancaData.map(bedSizeSummary => (
              <Card key={bedSizeSummary.size} className="overflow-hidden">
                <CardHeader className={`p-4 ${
                    bedSizeSummary.overallHarmonyStatus === 'Critical' ? 'bg-red-500/20' : 
                    bedSizeSummary.overallHarmonyStatus === 'NeedsAttention' ? 'bg-yellow-500/20' : 
                    'bg-green-500/10'
                  }`}>
                  <CardTitle className="text-xl flex items-center">
                    {bedSizeSummary.overallHarmonyStatus === 'Critical' ? <AlertTriangle className="mr-2 h-6 w-6 text-red-700" /> : 
                     bedSizeSummary.overallHarmonyStatus === 'NeedsAttention' ? <Eye className="mr-2 h-6 w-6 text-yellow-700" /> :
                     <ThumbsUp className="mr-2 h-6 w-6 text-green-700" /> }
                    Ecossistema Cama: {bedSizeSummary.size}
                  </CardTitle>
                  <CardDescription>
                    Status geral dos itens Linha Branca para camas {bedSizeSummary.size}.
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {bedSizeSummary.items.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4 xl:grid-cols-5 gap-4">
                      {bedSizeSummary.items.map(item => (
                        <LinhaBrancaItemWidget key={item.id} item={item} />
                      ))}
                    </div>
                  ) : (
                    <p className="text-muted-foreground text-center py-4">Nenhum item da Linha Branca encontrado para este tamanho de cama.</p>
                  )}
                </CardContent>
              </Card>
            ))}
          </div>
        </>
      )}
    </div>
  );
}

