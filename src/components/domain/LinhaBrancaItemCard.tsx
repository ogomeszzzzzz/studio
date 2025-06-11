
'use client';

import type { AggregatedLinhaBrancaItem, SalesBasedPillowStatus as LinhaBrancaStockStatus } from '@/types';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Badge } from '@/components/ui/badge';
import { Button } from '@/components/ui/button';
import { Progress } from '@/components/ui/progress';
import { Tooltip, TooltipProvider, TooltipContent, TooltipTrigger } from '@/components/ui/tooltip';
import { Eye, PackageX, Zap, TrendingDown, ThumbsUp, Repeat, MinusCircle, HelpCircle, PlusCircle, ShoppingBag, Inbox, Layers, Tag, Ruler, DollarSign, BarChart } from 'lucide-react';
import { cn } from '@/lib/utils';

interface LinhaBrancaItemCardProps {
  item: AggregatedLinhaBrancaItem;
  onViewDetailsClick: (item: AggregatedLinhaBrancaItem) => void;
  targetCoverageDays: number;
}

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

export function LinhaBrancaItemCard({ item, onViewDetailsClick, targetCoverageDays }: LinhaBrancaItemCardProps) {
  const { icon: StatusIcon, text: statusText, color: statusColorClass, tooltip: statusTooltip } = getStatusProps(item.status, item.daysOfStock);
  
  const stockPercentageOfTarget = item.targetStock > 0 
    ? Math.min((item.totalStock / item.targetStock) * 100, 150) // Cap at 150% for visual sanity
    : (item.totalStock > 0 ? 150 : 0); // If target is 0 but stock exists, show as over target

  let progressColor = 'bg-gray-400'; // Default for N/A or NoSales
  if (item.status === 'Critical') progressColor = 'bg-red-600';
  else if (item.status === 'Urgent') progressColor = 'bg-orange-500';
  else if (item.status === 'Low') progressColor = 'bg-yellow-500';
  else if (item.status === 'Healthy') progressColor = 'bg-green-600';
  else if (item.status === 'Overstocked') progressColor = 'bg-blue-500';

  return (
    <Card className="shadow-md hover:shadow-lg transition-shadow flex flex-col h-full border-l-4" style={{ borderColor: progressColor }}>
      <CardHeader className="p-3 pb-1.5 space-y-1">
        <TooltipProvider delayDuration={200}>
          <Tooltip>
            <TooltipTrigger className="w-full">
              <Badge variant="secondary" className={cn("text-xs font-semibold w-full justify-center py-1 cursor-help", statusColorClass)}>
                <StatusIcon className="h-3.5 w-3.5 mr-1.5 flex-shrink-0" />
                <span className="truncate">{statusText}</span>
              </Badge>
            </TooltipTrigger>
            <TooltipContent className="max-w-xs text-center text-xs p-2" side="top">
              <p>{statusTooltip}</p>
            </TooltipContent>
          </Tooltip>
        </TooltipProvider>
        <CardTitle className="text-sm font-bold leading-tight pt-1 truncate" title={item.productName}>
          {item.productName}
        </CardTitle>
        <div className="flex items-center text-xs text-muted-foreground gap-x-2 gap-y-0.5 flex-wrap">
          <div className="flex items-center" title="Tipo de Item">
            <Layers className="h-3 w-3 mr-1 text-sky-600 flex-shrink-0" /> {item.itemType || 'N/A'}
          </div>
          <div className="flex items-center" title="Tamanho">
            <Ruler className="h-3 w-3 mr-1 text-purple-600 flex-shrink-0" /> {item.size || 'N/A'}
          </div>
        </div>
      </CardHeader>
      <CardContent className="p-3 pt-0 space-y-1.5 text-xs flex-grow flex flex-col justify-between">
        <div className="space-y-0.5">
          <InfoRow icon={ShoppingBag} label="Estoque Total:" value={`${item.totalStock.toLocaleString()} un.`} valueColor="text-indigo-700 font-bold" />
          <InfoRow icon={BarChart} label="VMD (30d):" value={`${item.dailyAverageSales.toFixed(1)} un/dia`} />
          <InfoRow icon={Tag} label="Cob. (dias):" value={item.daysOfStock === null ? 'N/A' : Number.isFinite(item.daysOfStock) ? item.daysOfStock.toFixed(0) : '∞'} />
          {item.avgPrice !== undefined && <InfoRow icon={DollarSign} label="Preço Médio SKU:" value={item.avgPrice.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' })} />}
          {item.totalOpenOrders > 0 && (
            <InfoRow icon={Inbox} label="Ped. Abertos:" value={`${item.totalOpenOrders.toLocaleString()} un.`} iconColor="text-blue-600" />
          )}
        </div>
        <div className="mt-auto space-y-2 pt-1.5">
          {item.replenishmentSuggestion > 0 && (
            <TooltipProvider delayDuration={200}>
              <Tooltip>
                <TooltipTrigger className="w-full">
                  <Badge variant="default" className="w-full justify-center bg-green-600 hover:bg-green-700 text-white text-xs py-1 cursor-help">
                    <PlusCircle className="mr-1 h-3.5 w-3.5 flex-shrink-0" /> Repor: {item.replenishmentSuggestion.toLocaleString()} un.
                  </Badge>
                </TooltipTrigger>
                <TooltipContent className="max-w-xs text-xs p-2" side="bottom">
                  <p>Sugestão para atingir {targetCoverageDays} dias de cobertura, considerando o estoque atual e pedidos em aberto.</p>
                </TooltipContent>
              </Tooltip>
            </TooltipProvider>
          )}
           <TooltipProvider delayDuration={200}>
              <Tooltip>
                  <TooltipTrigger className="w-full block"> {/* Progress needs a block-level trigger for full width */}
                      <Progress value={stockPercentageOfTarget} className={cn("h-2", progressColor, "cursor-help")} />
                  </TooltipTrigger>
                  <TooltipContent className="max-w-xs text-xs p-2" side="bottom">
                      <p>Estoque Atual: {item.totalStock.toLocaleString()} un.</p>
                      <p>Estoque Alvo ({targetCoverageDays} dias): {item.targetStock.toLocaleString()} un.</p>
                      <p>{stockPercentageOfTarget.toFixed(0)}% do Alvo de Cobertura</p>
                  </TooltipContent>
              </Tooltip>
          </TooltipProvider>
          <Button onClick={() => onViewDetailsClick(item)} variant="outline" size="xs" className="w-full mt-1 text-xs">
              <Eye className="mr-1.5 h-3.5 w-3.5" /> Ver SKUs Contribuintes ({item.contributingSkus.length})
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

interface InfoRowProps {
  icon: React.ElementType;
  label: string;
  value: string | number;
  iconColor?: string;
  valueColor?: string;
}

const InfoRow: React.FC<InfoRowProps> = ({ icon: Icon, label, value, iconColor, valueColor }) => (
  <div className="flex justify-between items-center text-muted-foreground">
    <span className="flex items-center">
      <Icon className={cn("h-3.5 w-3.5 mr-1.5 flex-shrink-0", iconColor)} />
      {label}
    </span>
    <span className={cn("font-medium text-foreground", valueColor)}>{value}</span>
  </div>
);
```