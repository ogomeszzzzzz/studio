
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useProducts } from '@/contexts/ProductsContext';
import type { Product, AggregatedLinhaBrancaItem, LinhaBrancaStockStatus, LinhaBrancaItemType, LinhaBrancaBedSizeSummary } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ShieldHalf, ShoppingBag, TrendingDown, PackageX, BarChart3, ListFilter, HelpCircle, Repeat, ThumbsUp, PlusCircle, MinusCircle, Layers, Percent, Eye } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format as formatDateFns } from 'date-fns';
import { ptBR } from 'date-fns/locale';

const LINHA_BRANCA_COLLECTION_NAME = "Linha Branca";
const LINHA_BRANCA_TARGET_COVERAGE_DAYS = 45;
const LINHA_BRANCA_MIN_SIGNIFICANT_DAILY_SALES = 0.1;
const LINHA_BRANCA_OVERSTOCK_FACTOR = 1.75; // More than 175% of target stock is overstock
const LINHA_BRANCA_LOW_STOCK_DAYS = 15;
const LINHA_BRANCA_CRITICAL_STOCK_DAYS = 5;

const COMMON_SIZES_ORDER = ['Solteiro', 'Solteiro King', 'Casal', 'Queen', 'King', 'Super King', 'Berço'];

const getItemTypeAndCleanName = (productName: string, productType?: string): { itemType: LinhaBrancaItemType, cleanedName: string } => {
  const pNameLower = productName.toLowerCase();
  const pTypeLower = productType?.toLowerCase() || '';

  if ((pNameLower.includes('protetor') && pNameLower.includes('colchão')) || pTypeLower.includes('protetor de colchao')) {
     return { itemType: 'Protetor de Colchão', cleanedName: productName.replace(/protetor de colchão/gi, '').trim() };
  }
  if ((pNameLower.includes('protetor') && pNameLower.includes('travesseiro')) || pTypeLower.includes('protetor de travesseiro')) {
     return { itemType: 'Protetor de Travesseiro', cleanedName: productName.replace(/protetor de travesseiro/gi, '').trim() };
  }
  if ((pNameLower.includes('saia') && pNameLower.includes('box')) || pTypeLower.includes('saia box')) {
     return { itemType: 'Saia Box', cleanedName: productName.replace(/saia box/gi, '').trim() };
  }
  if (pTypeLower.includes('protetor') && pTypeLower.includes('colchao')) {
    return { itemType: 'Protetor de Colchão', cleanedName: productName };
  }
  if (pTypeLower.includes('protetor') && pTypeLower.includes('travesseiro')) {
    return { itemType: 'Protetor de Travesseiro', cleanedName: productName };
  }
  if (pTypeLower.includes('saia')) {
    return { itemType: 'Saia Box', cleanedName: productName };
  }

  return { itemType: 'Outros', cleanedName: productName };
};

interface LinhaBrancaItemWidgetProps {
  item: AggregatedLinhaBrancaItem;
}

const LinhaBrancaItemWidget: React.FC<LinhaBrancaItemWidgetProps> = ({ item }) => {
  let statusText = item.status;
  let statusBadgeCombinedClasses = "bg-gray-500 text-white";
  let statusIcon = <HelpCircle className="h-4 w-4" />;
  let statusBadgeVariant: "default" | "destructive" | "outline" | "secondary" = 'outline';


  switch (item.status) {
    case 'Critical':
      statusBadgeCombinedClasses = "bg-red-600 text-white";
      statusIcon = <PackageX className="h-4 w-4" />;
      statusBadgeVariant = 'destructive';
      break;
    case 'Low': // Handles both "Low" and "Imbalanced" (which is now set as Low)
      statusBadgeCombinedClasses = "bg-yellow-500 text-black";
      statusIcon = <TrendingDown className="h-4 w-4" />;
      statusBadgeVariant = 'destructive'; // Still a concerning state
      break;
    case 'Healthy':
      statusBadgeCombinedClasses = "bg-green-600 text-white";
      statusIcon = <ThumbsUp className="h-4 w-4" />;
      statusBadgeVariant = 'default';
      break;
    case 'Overstocked':
      statusBadgeCombinedClasses = "bg-blue-500 text-white";
      statusIcon = <Repeat className="h-4 w-4" />;
      statusBadgeVariant = 'default';
      break;
    case 'NoSales':
      statusBadgeCombinedClasses = "bg-slate-500 text-white";
      statusIcon = <MinusCircle className="h-4 w-4" />;
      statusBadgeVariant = 'secondary';
      break;
    default: // N/A or undefined
      statusBadgeCombinedClasses = "bg-gray-400 text-white";
      statusIcon = <HelpCircle className="h-4 w-4" />;
      statusBadgeVariant = 'secondary';
      break;
  }

  let stockPercentage = 0;
  if (item.targetStock > 0) {
    stockPercentage = Math.min((item.totalStock / item.targetStock) * 100, 150);
  } else if (item.totalStock > 0) {
    stockPercentage = 5;
  }

  const progressFillClass = statusBadgeCombinedClasses.split(' ')[0] || "bg-gray-500";

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
                   <Badge variant={statusBadgeVariant} className={`text-xs ${statusBadgeCombinedClasses} self-start`}>
                     {statusIcon} <span className="ml-1">{statusText}</span>
                   </Badge>
                </CardHeader>
                <CardContent className="p-3 pt-1 space-y-1.5 text-xs flex-grow flex flex-col justify-between">
                  <div>
                    <div className="flex justify-between">
                      <span>Estoque Agreg.:</span>
                      <span className="font-bold">{item.totalStock.toLocaleString()}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>VMD Agreg.:</span>
                      <span className="font-medium">{item.dailyAverageSales.toFixed(1)}</span>
                    </div>
                    <div className="flex justify-between">
                      <span>Cob (dias) Agreg.:</span>
                      <span className="font-medium">{item.daysOfStock === null ? 'N/A' : Number.isFinite(item.daysOfStock) ? item.daysOfStock.toFixed(0) : '∞'}</span>
                    </div>
                     <div className="flex justify-between">
                      <span>Abertos Agreg.:</span>
                      <span className="font-medium">{item.totalOpenOrders.toLocaleString()}</span>
                    </div>
                  </div>
                  <div className="mt-auto">
                    {item.replenishmentSuggestion > 0 && (
                      <Badge variant="default" className="w-full justify-center bg-green-600 hover:bg-green-700 text-white text-xs mt-1">
                        <PlusCircle className="mr-1 h-3 w-3" /> Repor Agreg.: {item.replenishmentSuggestion.toLocaleString()}
                      </Badge>
                    )}
                    <Progress value={Math.min(stockPercentage, 100)} className={`h-2 mt-1.5 ${progressFillClass}`} />
                     <p className="text-xxs text-muted-foreground text-center mt-0.5">Est.Agreg. vs Alvo ({item.targetStock.toLocaleString()} un)</p>
                  </div>
                </CardContent>
              </Card>
            </DialogTrigger>
          </TooltipTrigger>
          <TooltipContent side="top">
            <p>Status Agregado: {item.status}. Estoque Alvo Agregado: {item.targetStock.toLocaleString()} un.</p>
            <p>Clique para ver SKUs detalhados e códigos de referência.</p>
          </TooltipContent>
        </Tooltip>
      </TooltipProvider>
      <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
        <DialogHeader>
          <DialogTitle className="text-xl">SKUs Detalhados para: {item.displayName}</DialogTitle>
          <DialogDescription>
            Lista de SKUs individuais que compõem o item agregado "{item.displayName}".
            Total Agregado: Estoque {item.totalStock}, VMD {item.dailyAverageSales.toFixed(1)}, Ped.Abertos {item.totalOpenOrders}, Sug.Repor {item.replenishmentSuggestion}.
          </DialogDescription>
        </DialogHeader>
        <div className="max-h-[60vh] overflow-y-auto mt-4">
          {item.contributingSkus.length > 0 ? (
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead className="min-w-[250px]">Nome Produto (SKU)</TableHead>
                  <TableHead>ID VTEX</TableHead>
                  <TableHead className="text-right">Estoque SKU</TableHead>
                  <TableHead className="text-right">Venda 30d SKU</TableHead>
                  <TableHead className="text-right">Ped.Abertos SKU</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {item.contributingSkus.map(sku => (
                  <TableRow key={String(sku.vtexId) + '-' + sku.name}>
                    <TableCell className="text-xs font-medium">{sku.name}</TableCell>
                    <TableCell className="text-xs">{String(sku.vtexId)}</TableCell>
                    <TableCell className="text-right text-xs">{sku.stock.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs">{(sku.sales30d || 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs">{(sku.openOrders || 0).toLocaleString()}</TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
          ) : (
            <p className="text-muted-foreground text-center py-4">Nenhum SKU individual encontrado para este item agregado.</p>
          )}
        </div>
        <DialogFooter className="mt-4">
            <DialogClose asChild>
                <Button variant="outline">Fechar</Button>
            </DialogClose>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
};


export default function LinhaBrancaEcosystemPage() {
  const { products: allProducts, isLoadingProducts, productsError, refetchProducts, lastDataUpdateTimestamp } = useProducts();
  const { toast } = useToast();
  const [processedLinhaBrancaData, setProcessedLinhaBrancaData] = useState<LinhaBrancaBedSizeSummary[]>([]);
  const [detailedItemForUrgentAction, setDetailedItemForUrgentAction] = useState<AggregatedLinhaBrancaItem | null>(null);


  useEffect(() => {
    if (isLoadingProducts || productsError) {
        if(productsError && !isLoadingProducts) {
            toast({title: "Erro ao carregar dados de Linha Branca", description: productsError, variant: "destructive"});
        }
        setProcessedLinhaBrancaData([]);
        return;
    }

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
      entry.totalStock += (p.stock || 0);
      entry.totalSales30d += (p.sales30d || 0);
      entry.totalOpenOrders += (p.openOrders || 0);
      entry.contributingSkus.push(p);
      aggregatedMap.set(id, entry);
    });

    const finalAggregatedItems: AggregatedLinhaBrancaItem[] = [];
    aggregatedMap.forEach(item => {
      item.dailyAverageSales = item.totalSales30d > 0 ? item.totalSales30d / 30 : 0;
      item.targetStock = Math.round(item.dailyAverageSales * LINHA_BRANCA_TARGET_COVERAGE_DAYS);
      item.daysOfStock = item.dailyAverageSales > 0 ? item.totalStock / item.dailyAverageSales : (item.totalStock > 0 ? Infinity : 0);

      const neededForTarget = item.targetStock - (item.totalStock + item.totalOpenOrders);
      item.replenishmentSuggestion = item.dailyAverageSales > 0 ? Math.max(0, Math.round(neededForTarget)) : 0;

      const hasSignificantZeroStockSku = item.contributingSkus.some(
        sku => (sku.stock || 0) === 0 && ((sku.sales30d || 0) / 30) >= LINHA_BRANCA_MIN_SIGNIFICANT_DAILY_SALES
      );

      if (item.dailyAverageSales < LINHA_BRANCA_MIN_SIGNIFICANT_DAILY_SALES) {
        item.status = item.totalStock > 0 ? 'NoSales' : 'N/A';
      } else {
        const effectiveCoverageWithOC = item.dailyAverageSales > 0 ? (item.totalStock + item.totalOpenOrders) / item.dailyAverageSales : Infinity;

        if (item.daysOfStock !== null && item.daysOfStock < LINHA_BRANCA_CRITICAL_STOCK_DAYS && effectiveCoverageWithOC < LINHA_BRANCA_LOW_STOCK_DAYS) {
          item.status = 'Critical';
        } else if ((item.daysOfStock !== null && item.daysOfStock < LINHA_BRANCA_LOW_STOCK_DAYS) || hasSignificantZeroStockSku) {
          item.status = 'Low'; // If overall low, or any significant SKU is zero, it's 'Low'
        } else if (item.targetStock > 0 && (item.totalStock / item.targetStock) > LINHA_BRANCA_OVERSTOCK_FACTOR && item.daysOfStock && item.daysOfStock > (LINHA_BRANCA_TARGET_COVERAGE_DAYS * LINHA_BRANCA_OVERSTOCK_FACTOR)) {
          item.status = 'Overstocked'; // This is now only reached if not Critical, Low (due to days or gaps)
        } else {
          item.status = 'Healthy';
        }
      }
      finalAggregatedItems.push(item);
    });

    const bySize: Record<string, AggregatedLinhaBrancaItem[]> = {};
    finalAggregatedItems.forEach(item => {
      if (!bySize[item.size]) {
        bySize[item.size] = [];
      }
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

  }, [allProducts, isLoadingProducts, productsError, toast]);

  const kpis = useMemo(() => {
    const allAggregatedItems = processedLinhaBrancaData.flatMap(s => s.items);
    if (allAggregatedItems.length === 0) {
      return { totalStockValue: 0, outOfStockSkus: 0, overstockedSkus: 0, replenishmentNeededUnits: 0, criticalStatusCount: 0, lowStatusCount: 0 };
    }

    return {
      totalStockValue: 0, // Placeholder, not calculated
      outOfStockSkus: 0, // Placeholder, needs SKU level definition
      overstockedSkus: allAggregatedItems.filter(i => i.status === 'Overstocked').length,
      replenishmentNeededUnits: allAggregatedItems.reduce((sum, item) => sum + item.replenishmentSuggestion, 0),
      criticalStatusCount: allAggregatedItems.filter(i => i.status === 'Critical').length,
      lowStatusCount: allAggregatedItems.filter(i => i.status === 'Low').length,
    };
  }, [processedLinhaBrancaData]);

  const urgentActions = useMemo(() => {
    return processedLinhaBrancaData
      .flatMap(s => s.items)
      .filter(item => (item.status === 'Critical' || item.status === 'Low') && item.replenishmentSuggestion > 0)
      .sort((a, b) => {
        const statusOrder = { 'Critical': 1, 'Low': 2, 'Healthy': 3, 'Overstocked': 4, 'NoSales': 5, 'N/A': 6 } as Record<LinhaBrancaStockStatus, number>;
        const statusComparison = statusOrder[a.status] - statusOrder[b.status];
        if (statusComparison !== 0) return statusComparison;
        return (b.dailyAverageSales) - (a.dailyAverageSales);
      })
      .slice(0, 5);
  }, [processedLinhaBrancaData]);


  if (isLoadingProducts && allProducts.length === 0 && !productsError) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando dados...</p></div>;
  }

  if (productsError && allProducts.length === 0 && !isLoadingProducts) {
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

      {linhaBrancaOriginalProducts.length === 0 && !isLoadingProducts && !productsError && (
         <Card className="shadow-md text-center py-10">
            <CardHeader><CardTitle className="flex items-center justify-center text-xl"><Layers className="mr-2 h-7 w-7 text-primary" />Nenhum Produto "Linha Branca"</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Não foram encontrados produtos com a coleção "{LINHA_BRANCA_COLLECTION_NAME}" nos dados carregados.</p></CardContent>
         </Card>
      )}

      {linhaBrancaOriginalProducts.length > 0 && !productsError && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-lg">Painel de Controle Geral - Linha Branca</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
              <Card className="bg-card shadow-sm border-destructive border-l-4">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-destructive">Itens Agreg. Críticos</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-destructive">{kpis.criticalStatusCount.toLocaleString()}</p><p className="text-xs text-muted-foreground">Venda relevante, cob. &lt; {LINHA_BRANCA_CRITICAL_STOCK_DAYS}d</p></CardContent>
              </Card>
              <Card className="bg-card shadow-sm border-yellow-500 border-l-4">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-yellow-600">Itens Agreg. Baixos/Falhas</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-yellow-600">{kpis.lowStatusCount.toLocaleString()}</p><p className="text-xs text-muted-foreground">Cob. &lt; {LINHA_BRANCA_LOW_STOCK_DAYS}d ou SKU chave zerado</p></CardContent>
              </Card>
              <Card className="bg-card shadow-sm border-blue-500 border-l-4">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-blue-600">Itens Agreg. Superestocados</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-blue-600">{kpis.overstockedSkus}</p><p className="text-xs text-muted-foreground">Estoque &gt; {LINHA_BRANCA_OVERSTOCK_FACTOR * 100}% do alvo</p></CardContent>
              </Card>
              <Card className="bg-card shadow-sm border-green-500 border-l-4">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium text-green-600">Total Reposição Sugerida</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold text-green-600">{kpis.replenishmentNeededUnits.toLocaleString()} un.</p><p className="text-xs text-muted-foreground">Para cobrir {LINHA_BRANCA_TARGET_COVERAGE_DAYS} dias</p></CardContent>
              </Card>
               <Card className="bg-card shadow-sm">
                <CardHeader className="pb-2"><CardTitle className="text-sm font-medium">Itens Agregados Analisados</CardTitle></CardHeader>
                <CardContent><p className="text-2xl font-bold">{processedLinhaBrancaData.flatMap(s => s.items).length}</p><p className="text-xs text-muted-foreground">(Tipo + Tamanho)</p></CardContent>
              </Card>
            </CardContent>
          </Card>

          {urgentActions.length > 0 && (
            <Card className="border-red-500/70 shadow-md">
              <CardHeader className="bg-red-500/10">
                <CardTitle className="text-red-700 flex items-center"><AlertTriangle className="mr-2"/>Ações Urgentes Sugeridas ({urgentActions.length})</CardTitle>
                <CardDescription className="text-red-600">Itens agregados críticos ou baixos/com falhas, com maior VMD e precisando de reposição. Clique para ver detalhes.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4">
                <ul className="space-y-2 text-sm">
                  {urgentActions.map(item => (
                    <DialogTrigger key={item.id} asChild>
                      <li
                        onClick={() => setDetailedItemForUrgentAction(item)}
                        className="p-2.5 border border-red-500/30 rounded-md bg-red-500/5 hover:bg-red-500/10 transition-colors cursor-pointer"
                      >
                        <span className="font-semibold text-red-800">{item.displayName}</span>: Repor <span className="font-bold text-red-800">{item.replenishmentSuggestion} un</span>. (Est.Agreg: {item.totalStock}, VMD Agreg: {item.dailyAverageSales.toFixed(1)}, Status Agreg: <span className="font-medium">{item.status}</span>)
                      </li>
                    </DialogTrigger>
                  ))}
                </ul>
              </CardContent>
            </Card>
          )}
           {/* Dialog for Urgent Action Item Details */}
            <Dialog open={!!detailedItemForUrgentAction} onOpenChange={(open) => { if (!open) setDetailedItemForUrgentAction(null); }}>
                {detailedItemForUrgentAction && (
                <DialogContent className="sm:max-w-2xl md:max-w-3xl lg:max-w-4xl">
                    <DialogHeader>
                    <DialogTitle className="text-xl">SKUs Detalhados para Ação Urgente: {detailedItemForUrgentAction.displayName}</DialogTitle>
                    <DialogDescription>
                        Lista de SKUs individuais que compõem o item agregado "{detailedItemForUrgentAction.displayName}".
                        Total Agregado: Estoque {detailedItemForUrgentAction.totalStock}, VMD {detailedItemForUrgentAction.dailyAverageSales.toFixed(1)}, Ped.Abertos {detailedItemForUrgentAction.totalOpenOrders}, Sug.Repor {detailedItemForUrgentAction.replenishmentSuggestion}.
                    </DialogDescription>
                    </DialogHeader>
                    <div className="max-h-[60vh] overflow-y-auto mt-4">
                    {detailedItemForUrgentAction.contributingSkus.length > 0 ? (
                        <Table>
                        <TableHeader>
                            <TableRow>
                            <TableHead className="min-w-[250px]">Nome Produto (SKU)</TableHead>
                            <TableHead>ID VTEX</TableHead>
                            <TableHead className="text-right">Estoque SKU</TableHead>
                            <TableHead className="text-right">Venda 30d SKU</TableHead>
                            <TableHead className="text-right">Ped.Abertos SKU</TableHead>
                            </TableRow>
                        </TableHeader>
                        <TableBody>
                            {detailedItemForUrgentAction.contributingSkus.map(sku => (
                            <TableRow key={String(sku.vtexId) + '-' + sku.name}>
                                <TableCell className="text-xs font-medium">{sku.name}</TableCell>
                                <TableCell className="text-xs">{String(sku.vtexId)}</TableCell>
                                <TableCell className="text-right text-xs">{sku.stock.toLocaleString()}</TableCell>
                                <TableCell className="text-right text-xs">{(sku.sales30d || 0).toLocaleString()}</TableCell>
                                <TableCell className="text-right text-xs">{(sku.openOrders || 0).toLocaleString()}</TableCell>
                            </TableRow>
                            ))}
                        </TableBody>
                        </Table>
                    ) : (
                        <p className="text-muted-foreground text-center py-4">Nenhum SKU individual encontrado para este item.</p>
                    )}
                    </div>
                    <DialogFooter className="mt-4">
                        <DialogClose asChild><Button variant="outline">Fechar</Button></DialogClose>
                    </DialogFooter>
                </DialogContent>
                )}
            </Dialog>


          {processedLinhaBrancaData.length === 0 && linhaBrancaOriginalProducts.length > 0 && !isLoadingProducts && (
             <Card className="shadow-md text-center py-10">
                <CardHeader><CardTitle className="flex items-center justify-center text-xl"><Layers className="mr-2 h-7 w-7 text-primary" />Processando Dados da Linha Branca...</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground">Aguarde enquanto os dados são agregados e analisados.</p></CardContent>
             </Card>
          )}

          <div className="space-y-8">
            {processedLinhaBrancaData.map(bedSizeSummary => (
              <Card key={bedSizeSummary.size} className="overflow-hidden shadow-md">
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
                  <CardDescription className={
                    bedSizeSummary.overallHarmonyStatus === 'Critical' ? 'text-red-700' :
                    bedSizeSummary.overallHarmonyStatus === 'NeedsAttention' ? 'text-yellow-700' :
                    'text-green-700'
                  }>
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

