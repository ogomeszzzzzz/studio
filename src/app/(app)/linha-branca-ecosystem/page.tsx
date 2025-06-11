
'use client';

import { useState, useMemo, useEffect } from 'react';
import { useProducts } from '@/contexts/ProductsContext';
import type { Product, AggregatedLinhaBrancaItem, LinhaBrancaStockStatus, LinhaBrancaItemType, LinhaBrancaBedSizeSummary } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Loader2, AlertTriangle, ShieldHalf, ShoppingBag, TrendingDown, PackageX, BarChart3, ListFilter, HelpCircle, Repeat, ThumbsUp, PlusCircle, MinusCircle, Layers, Percent, Eye, Inbox, Activity, TrendingUp as TrendingUpIcon, PackageCheck, CalendarDays } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Dialog, DialogContent, DialogHeader, DialogTitle, DialogTrigger, DialogDescription, DialogFooter, DialogClose } from '@/components/ui/dialog';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { format as formatDateFns } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { cn } from '@/lib/utils';

const LINHA_BRANCA_COLLECTION_NAME = "Linha Branca";
const LINHA_BRANCA_TARGET_COVERAGE_DAYS = 45;
const LINHA_BRANCA_MIN_SIGNIFICANT_DAILY_SALES = 0.1;
const LINHA_BRANCA_OVERSTOCK_FACTOR = 1.75; // Estoque > 175% do alvo = excesso
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
  onViewDetailsClick: (item: AggregatedLinhaBrancaItem) => void;
}

const LinhaBrancaItemWidget: React.FC<LinhaBrancaItemWidgetProps> = ({ item, onViewDetailsClick }) => {
  let statusText = item.status;
  let StatusIconComponent = HelpCircle;
  let badgeVariant: "default" | "destructive" | "outline" | "secondary" = 'secondary';
  let badgeClasses = "bg-gray-400 hover:bg-gray-500 text-white";
  let progressBarColor = "bg-gray-400";

  switch (item.status) {
    case 'Critical':
      StatusIconComponent = PackageX; badgeClasses = "bg-red-600 hover:bg-red-700 text-white"; badgeVariant = 'destructive'; progressBarColor = "bg-red-600";
      break;
    case 'Low':
      StatusIconComponent = TrendingDown; badgeClasses = "bg-yellow-500 hover:bg-yellow-600 text-black"; badgeVariant = 'destructive'; progressBarColor = "bg-yellow-500";
      break;
    case 'Healthy':
      StatusIconComponent = ThumbsUp; badgeClasses = "bg-green-600 hover:bg-green-700 text-white"; badgeVariant = 'default'; progressBarColor = "bg-green-600";
      break;
    case 'Overstocked':
      StatusIconComponent = Repeat; badgeClasses = "bg-blue-500 hover:bg-blue-600 text-white"; badgeVariant = 'default'; progressBarColor = "bg-blue-500";
      break;
    case 'NoSales':
      StatusIconComponent = MinusCircle; badgeClasses = "bg-slate-500 hover:bg-slate-600 text-white"; badgeVariant = 'secondary'; progressBarColor = "bg-slate-500";
      break;
  }

  const stockPercentageOfTarget = item.targetStock > 0 ? Math.min((item.totalStock / item.targetStock) * 100, 150) : (item.totalStock > 0 ? 5 : 0); // Cap at 150% for visual sanity

  return (
      <Card className="hover:shadow-lg transition-shadow flex flex-col h-full border-l-4" style={{ borderColor: progressBarColor }}>
        <CardHeader className="p-3 pb-1 space-y-1">
            <TooltipProvider delayDuration={300}>
                <Tooltip>
                    <TooltipTrigger className="w-full">
                        <Badge variant={badgeVariant} className={cn("text-xs font-semibold w-full justify-center py-1", badgeClasses)}>
                            <StatusIconComponent className="h-4 w-4 mr-1.5" /> {statusText.toUpperCase()}
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>{item.status === 'Critical' ? `Risco Crítico de Ruptura! Cobertura: ${item.daysOfStock?.toFixed(0) ?? 'N/A'} dias.` : 
                            item.status === 'Low' ? `Estoque Baixo! Cobertura: ${item.daysOfStock?.toFixed(0) ?? 'N/A'} dias.` :
                            item.status === 'Healthy' ? `Estoque Saudável. Cobertura: ${item.daysOfStock?.toFixed(0) ?? 'N/A'} dias.` :
                            item.status === 'Overstocked' ? `Excesso de Estoque! Cobertura: ${item.daysOfStock?.toFixed(0) ?? 'N/A'} dias.` :
                            item.status === 'NoSales' ? `Estoque Estagnado (sem vendas significativas).` : `Status não aplicável (sem estoque e sem vendas).`}</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
          <CardTitle className="text-base font-bold leading-tight truncate pt-1" title={item.displayName}>
            {item.displayName}
          </CardTitle>
        </CardHeader>
        <CardContent className="p-3 pt-0 space-y-1.5 text-xs flex-grow flex flex-col justify-between">
          <div className="space-y-0.5">
            <div className="flex justify-between"><span>Estoque Agreg.:</span><span className="font-bold">{item.totalStock.toLocaleString()} un.</span></div>
            <div className="flex justify-between"><span>VMD Agreg.:</span><span className="font-medium">{item.dailyAverageSales.toFixed(1)} un/dia</span></div>
            <div className="flex justify-between"><span>Cob (dias) Agreg.:</span><span className="font-medium">{item.daysOfStock === null ? 'N/A' : Number.isFinite(item.daysOfStock) ? item.daysOfStock.toFixed(0) : '∞'}</span></div>
            {item.totalOpenOrders > 0 && <div className="flex justify-between text-blue-600"><span><Inbox className="inline h-3 w-3 mr-1"/>Ped. Abertos:</span><span className="font-medium">{item.totalOpenOrders.toLocaleString()} un.</span></div>}
          </div>
          <div className="mt-auto space-y-1.5">
            {item.replenishmentSuggestion > 0 && (
              <Badge variant="default" className="w-full justify-center bg-green-600 hover:bg-green-700 text-white text-xs py-1">
                <PlusCircle className="mr-1 h-3.5 w-3.5" /> Repor Agreg.: {item.replenishmentSuggestion.toLocaleString()} un.
              </Badge>
            )}
             <TooltipProvider delayDuration={300}>
                <Tooltip>
                    <TooltipTrigger className="w-full">
                        <Progress value={stockPercentageOfTarget} className={cn("h-2.5", progressBarColor)} />
                    </TooltipTrigger>
                    <TooltipContent>
                        <p>Estoque Atual: {item.totalStock.toLocaleString()} un.</p>
                        <p>Estoque Alvo ({LINHA_BRANCA_TARGET_COVERAGE_DAYS} dias): {item.targetStock.toLocaleString()} un.</p>
                        <p>{stockPercentageOfTarget.toFixed(0)}% do Alvo</p>
                    </TooltipContent>
                </Tooltip>
            </TooltipProvider>
            <Button onClick={() => onViewDetailsClick(item)} variant="outline" size="xs" className="w-full mt-1 text-xs">
                <Eye className="mr-1.5 h-3.5 w-3.5" /> Ver SKUs Detalhados
            </Button>
          </div>
        </CardContent>
      </Card>
  );
};


export default function LinhaBrancaEcosystemPage() {
  const { products: allProducts, isLoadingProducts, productsError, refetchProducts, lastDataUpdateTimestamp } = useProducts();
  const { toast } = useToast();
  const [processedLinhaBrancaData, setProcessedLinhaBrancaData] = useState<LinhaBrancaBedSizeSummary[]>([]);
  const [detailedItemForModal, setDetailedItemForModal] = useState<AggregatedLinhaBrancaItem | null>(null);


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
      const size = p.size || 'Tamanho Único'; // Default if size is undefined/empty
      const id = `${itemType}-${size}`;

      let entry = aggregatedMap.get(id);
      if (!entry) {
        entry = {
          id, itemType, size, displayName: `${itemType} ${size}`,
          totalStock: 0, totalSales30d: 0, totalOpenOrders: 0,
          dailyAverageSales: 0, daysOfStock: null, targetStock: 0,
          replenishmentSuggestion: 0, status: 'N/A', contributingSkus: [],
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
          item.status = 'Low';
        } else if (item.targetStock > 0 && (item.totalStock / item.targetStock) > LINHA_BRANCA_OVERSTOCK_FACTOR && item.daysOfStock && item.daysOfStock > (LINHA_BRANCA_TARGET_COVERAGE_DAYS * LINHA_BRANCA_OVERSTOCK_FACTOR)) {
          item.status = 'Overstocked';
        } else {
          item.status = 'Healthy';
        }
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

  }, [allProducts, isLoadingProducts, productsError, toast]);

  const kpis = useMemo(() => {
    const allAggregatedItems = processedLinhaBrancaData.flatMap(s => s.items);
    if (allAggregatedItems.length === 0) {
      return { criticalCount: 0, lowCount: 0, overstockedCount: 0, noSalesCount: 0, replenishmentNeededUnits: 0, totalValueInStock:0 };
    }
    const totalValue = allAggregatedItems.reduce((sum, item) => {
        const itemValue = item.contributingSkus.reduce((skuSum, sku) => skuSum + (sku.stock * (sku.price || 0)),0);
        return sum + itemValue;
    }, 0);

    return {
      criticalCount: allAggregatedItems.filter(i => i.status === 'Critical').length,
      lowCount: allAggregatedItems.filter(i => i.status === 'Low').length,
      overstockedCount: allAggregatedItems.filter(i => i.status === 'Overstocked').length,
      noSalesCount: allAggregatedItems.filter(i => i.status === 'NoSales').length,
      replenishmentNeededUnits: allAggregatedItems.reduce((sum, item) => sum + item.replenishmentSuggestion, 0),
      totalValueInStock: totalValue,
    };
  }, [processedLinhaBrancaData]);

  const urgentActions = useMemo(() => {
    return processedLinhaBrancaData
      .flatMap(s => s.items)
      .filter(item => (item.status === 'Critical' || (item.status === 'Low' && item.dailyAverageSales >= LINHA_BRANCA_MIN_SIGNIFICANT_DAILY_SALES * 5)) && item.replenishmentSuggestion > 0)
      .sort((a, b) => {
        const statusOrderVal = (status: LinhaBrancaStockStatus) => ({ 'Critical': 1, 'Low': 2, 'Healthy': 3, 'Overstocked': 4, 'NoSales': 5, 'N/A': 6 }[status] || 6);
        const statusComparison = statusOrderVal(a.status) - statusOrderVal(b.status);
        if (statusComparison !== 0) return statusComparison;
        return (b.dailyAverageSales) - (a.dailyAverageSales);
      })
      .slice(0, 5); // Limit to top 5 urgent actions
  }, [processedLinhaBrancaData]);


  if (isLoadingProducts && allProducts.length === 0 && !productsError) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando dados da Linha Branca...</p></div>;
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
      <Card className="shadow-lg border-t-4 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center text-2xl font-bold">
            <ShieldHalf className="mr-3 h-8 w-8 text-primary" /> Ecossistema de Estoque Linha Branca
          </CardTitle>
          <CardDescription>
            Análise integrada da saúde do estoque, vendas e necessidades de reposição para Protetores e Saias Box, agrupados por tamanho de cama.
            {lastDataUpdateTimestamp && (
                <span className="block text-xs text-muted-foreground mt-1 flex items-center"><CalendarDays className="h-3.5 w-3.5 mr-1.5"/>Dados atualizados em: {formatDateFns(lastDataUpdateTimestamp, 'dd/MM/yyyy HH:mm', { locale: ptBR })}</span>
            )}
          </CardDescription>
        </CardHeader>
      </Card>

      {linhaBrancaOriginalProducts.length === 0 && !isLoadingProducts && !productsError && (
         <Card className="shadow-md text-center py-10 border-l-4 border-blue-500">
            <CardHeader><CardTitle className="flex items-center justify-center text-xl"><Layers className="mr-2 h-7 w-7 text-primary" />Nenhum Produto "{LINHA_BRANCA_COLLECTION_NAME}"</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Não foram encontrados produtos com a coleção "{LINHA_BRANCA_COLLECTION_NAME}" nos dados carregados. Verifique a planilha no Dashboard.</p></CardContent>
         </Card>
      )}

      {linhaBrancaOriginalProducts.length > 0 && !productsError && (
        <>
          <Card>
            <CardHeader><CardTitle className="text-lg font-semibold flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary"/>Painel de Controle Agregado - Linha Branca</CardTitle></CardHeader>
            <CardContent className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5 gap-4">
                <KpiCard title="Itens Críticos" value={kpis.criticalCount.toLocaleString()} icon={PackageX} color="text-red-600" description={`Venda relevante, cob. < ${LINHA_BRANCA_CRITICAL_STOCK_DAYS}d`} />
                <KpiCard title="Itens Baixo Estoque" value={kpis.lowCount.toLocaleString()} icon={TrendingDown} color="text-yellow-600" description={`Cob. < ${LINHA_BRANCA_LOW_STOCK_DAYS}d ou SKU chave zerado`} />
                <KpiCard title="Itens em Excesso" value={kpis.overstockedCount.toLocaleString()} icon={Repeat} color="text-blue-600" description={`Estoque > ${LINHA_BRANCA_OVERSTOCK_FACTOR * 100}% do alvo`} />
                <KpiCard title="Itens Estagnados" value={kpis.noSalesCount.toLocaleString()} icon={MinusCircle} color="text-slate-600" description="Estoque s/ vendas signif." />
                <KpiCard title="Total Reposição Sug." value={`${kpis.replenishmentNeededUnits.toLocaleString()} un.`} icon={PlusCircle} color="text-green-600" description={`Para cobrir ${LINHA_BRANCA_TARGET_COVERAGE_DAYS} dias`} />
            </CardContent>
          </Card>

          {urgentActions.length > 0 && (
            <Card className="border-red-600 shadow-lg">
              <CardHeader className="bg-red-600/10">
                <CardTitle className="text-red-700 flex items-center text-xl"><AlertTriangle className="mr-2.5 h-6 w-6"/>Ações Urgentes Sugeridas ({urgentActions.length})</CardTitle>
                <CardDescription className="text-red-700/90">Itens agregados críticos ou com baixo estoque, alta VMD e necessidade de reposição. Clique para ver detalhes dos SKUs.</CardDescription>
              </CardHeader>
              <CardContent className="pt-4 space-y-2">
                  {urgentActions.map(item => (
                    <div key={item.id} className="p-2.5 border border-red-400/50 rounded-md bg-red-500/5 hover:bg-red-500/10 transition-colors">
                        <div className="flex justify-between items-center">
                            <span className="font-semibold text-red-800 text-sm">{item.displayName}</span>
                             <Badge variant="destructive" className="text-xs">{item.status.toUpperCase()}</Badge>
                        </div>
                        <p className="text-xs text-red-700/90">
                            Repor: <span className="font-bold">{item.replenishmentSuggestion.toLocaleString()} un.</span>
                            (Est.Agreg: {item.totalStock.toLocaleString()}, VMD Agreg: {item.dailyAverageSales.toFixed(1)})
                        </p>
                        <Button onClick={() => setDetailedItemForModal(item)} variant="link" size="xs" className="text-red-600 hover:text-red-700 p-0 h-auto text-xs mt-1">
                           <Eye className="mr-1 h-3.5 w-3.5"/> Ver SKUs para {item.itemType} {item.size}
                        </Button>
                    </div>
                  ))}
              </CardContent>
            </Card>
          )}


          {processedLinhaBrancaData.length === 0 && linhaBrancaOriginalProducts.length > 0 && !isLoadingProducts && (
             <Card className="shadow-md text-center py-10 border-l-4 border-gray-300">
                <CardHeader><CardTitle className="flex items-center justify-center text-xl"><Activity className="mr-2 h-7 w-7 text-muted-foreground" />Processando Dados...</CardTitle></CardHeader>
                <CardContent><p className="text-muted-foreground">Aguarde enquanto os dados da Linha Branca são agregados e analisados.</p><Loader2 className="mx-auto mt-3 h-6 w-6 animate-spin text-primary" /></CardContent>
             </Card>
          )}

          <div className="space-y-8 mt-6">
            {processedLinhaBrancaData.map(bedSizeSummary => (
              <Card key={bedSizeSummary.size} className="overflow-hidden shadow-lg border-t-4" style={{borderColor: bedSizeSummary.overallHarmonyStatus === 'Critical' ? 'hsl(var(--destructive))' : bedSizeSummary.overallHarmonyStatus === 'NeedsAttention' ? 'hsl(var(--chart-4))' : 'hsl(var(--chart-2))'}}>
                <CardHeader className={cn("p-4",
                    bedSizeSummary.overallHarmonyStatus === 'Critical' ? 'bg-destructive/10' :
                    bedSizeSummary.overallHarmonyStatus === 'NeedsAttention' ? 'bg-yellow-400/10' :
                    'bg-green-500/5'
                  )}>
                  <CardTitle className="text-xl flex items-center font-bold" style={{color: bedSizeSummary.overallHarmonyStatus === 'Critical' ? 'hsl(var(--destructive))' : bedSizeSummary.overallHarmonyStatus === 'NeedsAttention' ? 'hsl(var(--chart-4))' : 'hsl(var(--chart-2))'}}>
                    {bedSizeSummary.overallHarmonyStatus === 'Critical' ? <AlertTriangle className="mr-2.5 h-6 w-6" /> :
                     bedSizeSummary.overallHarmonyStatus === 'NeedsAttention' ? <Eye className="mr-2.5 h-6 w-6" /> :
                     <PackageCheck className="mr-2.5 h-6 w-6" /> }
                    Ecossistema Cama: {bedSizeSummary.size}
                  </CardTitle>
                  <CardDescription style={{color: bedSizeSummary.overallHarmonyStatus === 'Critical' ? 'hsl(var(--destructive)/0.9)' : bedSizeSummary.overallHarmonyStatus === 'NeedsAttention' ? 'hsl(var(--chart-4)/0.9)' : 'hsl(var(--chart-2)/0.9)'}}>
                    {bedSizeSummary.overallHarmonyStatus === 'Critical' ? "Pelo menos um item crítico. Atenção máxima necessária!" :
                     bedSizeSummary.overallHarmonyStatus === 'NeedsAttention' ? "Pelo menos um item com estoque baixo. Requer atenção." :
                     "Todos os itens parecem saudáveis ou em excesso gerenciável."}
                  </CardDescription>
                </CardHeader>
                <CardContent className="p-4">
                  {bedSizeSummary.items.length > 0 ? (
                    <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-3 xl:grid-cols-4 gap-4">
                      {bedSizeSummary.items.map(item => (
                        <LinhaBrancaItemWidget key={item.id} item={item} onViewDetailsClick={setDetailedItemForModal} />
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

      {detailedItemForModal && (
        <Dialog open={!!detailedItemForModal} onOpenChange={(isOpen) => { if (!isOpen) setDetailedItemForModal(null); }}>
          <DialogContent className="sm:max-w-3xl md:max-w-4xl lg:max-w-5xl">
            <DialogHeader>
              <DialogTitle className="text-xl">SKUs Detalhados para: {detailedItemForModal.displayName}</DialogTitle>
              <DialogDescription>
                Lista de SKUs individuais que compõem o item agregado. Métricas Agregadas: 
                Estoque {detailedItemForModal.totalStock}, VMD {detailedItemForModal.dailyAverageSales.toFixed(1)}, 
                Ped. Abertos {detailedItemForModal.totalOpenOrders}, Sug. Repor {detailedItemForModal.replenishmentSuggestion}. 
                Status: <span className="font-semibold">{detailedItemForModal.status}</span>.
              </DialogDescription>
            </DialogHeader>
            <div className="max-h-[65vh] overflow-y-auto mt-4 rounded-md border">
              {detailedItemForModal.contributingSkus.length > 0 ? (
                <Table>
                  <TableHeader className="sticky top-0 bg-card z-10">
                    <TableRow>
                      <TableHead className="min-w-[280px] whitespace-nowrap">Nome Produto (SKU)</TableHead>
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
                      <TableRow key={String(sku.vtexId) + '-' + sku.name}>
                        <TableCell className="text-xs font-medium py-1.5">{sku.name}</TableCell>
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

interface KpiCardProps {
  title: string;
  value: string | number;
  icon: React.ElementType;
  color?: string;
  description?: string;
  isLoading?: boolean;
}

const KpiCard: React.FC<KpiCardProps> = ({ title, value, icon: Icon, color = "text-foreground", description, isLoading }) => {
  return (
    <Card className="shadow-sm hover:shadow-md transition-shadow border-l-4" style={{ borderColor: color.startsWith('text-') ? `var(--${color.substring(5)})` : color }}>
      <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1.5 pt-3 px-4">
        <CardTitle className="text-xs font-medium text-muted-foreground">{title}</CardTitle>
        <Icon className={cn("h-4 w-4", color)} />
      </CardHeader>
      <CardContent className="px-4 pb-3">
        {isLoading ? <Loader2 className="h-6 w-6 animate-spin" /> : <div className={`text-2xl font-bold ${color}`}>{value}</div>}
        {description && <p className="text-xxs text-muted-foreground pt-0.5 truncate" title={description}>{description}</p>}
      </CardContent>
    </Card>
  );
};

