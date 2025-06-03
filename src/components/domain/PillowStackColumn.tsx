
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertCircle, PackageX, Zap, Inbox, Repeat, MinusCircle, PlusCircle, ThumbsUp, AlertOctagon, HelpCircle, AlertTriangle, ShoppingBag, TrendingDown } from "lucide-react";
import type { SalesBasedPillowStatus } from "@/types";
import { Tooltip, TooltipContent, TooltipTrigger } from "@/components/ui/tooltip";

interface PillowStackColumnProps {
  pillowName: string;
  productDerivation?: string;
  currentStock: number;
  maxStock?: number; // Visual max for column fill
  sales30d?: number;
  openOrders?: number;
  // New sales-based analysis props
  dailyAverageSales?: number;
  daysOfStock?: number;
  replenishmentSuggestionForSales?: number;
  salesBasedStatus?: SalesBasedPillowStatus;
}

const DEFAULT_MAX_STOCK_VISUAL = 75; // For visual column fill

export function PillowStackColumn({
  pillowName,
  productDerivation,
  currentStock,
  maxStock = DEFAULT_MAX_STOCK_VISUAL,
  sales30d,
  openOrders,
  dailyAverageSales,
  daysOfStock,
  replenishmentSuggestionForSales,
  salesBasedStatus,
}: PillowStackColumnProps) {
  const stockPercentageVisual = Math.min(Math.max((currentStock / maxStock) * 100, 0), 100);
  const isOverStockedVisual = currentStock > maxStock;

  let statusIcon: React.ReactNode = null;
  let statusText = "";
  let statusColorClass = "bg-gray-500 text-white"; // Default
  let statusTooltip = "";

  switch (salesBasedStatus) {
    case 'Critical':
      statusIcon = <PackageX className="mr-1 h-3 w-3" />;
      statusText = "CRÍTICO";
      statusColorClass = "bg-red-600 text-white";
      statusTooltip = "Ruptura de estoque com VENDA RELEVANTE e sem pedidos em aberto.";
      break;
    case 'Urgent':
      statusIcon = <Zap className="mr-1 h-3 w-3" />;
      statusText = "URGENTE";
      statusColorClass = "bg-orange-500 text-white";
      statusTooltip = `VENDA ALTA e cobertura de estoque < ${daysOfStock?.toFixed(0) ?? '7'} dias.`;
      break;
    case 'Low':
      statusIcon = <TrendingDown className="mr-1 h-3 w-3" />;
      statusText = "BAIXO";
      statusColorClass = "bg-yellow-500 text-black";
      statusTooltip = `Estoque baixo em relação à meta de cobertura de vendas.`;
      break;
    case 'Healthy':
      statusIcon = <ThumbsUp className="mr-1 h-3 w-3" />;
      statusText = "SAUDÁVEL";
      statusColorClass = "bg-green-500 text-white";
      statusTooltip = "Estoque alinhado com a demanda de vendas.";
      break;
    case 'Overstocked':
      statusIcon = <Repeat className="mr-1 h-3 w-3" />;
      statusText = "EXCESSO";
      statusColorClass = "bg-blue-500 text-white";
      statusTooltip = "Estoque significativamente acima do ideal para a demanda atual.";
      break;
    case 'NoSales':
      statusIcon = <MinusCircle className="mr-1 h-3 w-3" />;
      statusText = "ESTAGNADO";
      statusColorClass = "bg-slate-500 text-white";
      statusTooltip = "Produto com estoque, mas sem vendas significativas nos últimos 30 dias.";
      break;
    default: // N/A or undefined
      statusIcon = <HelpCircle className="mr-1 h-3 w-3" />;
      statusText = "N/A";
      statusColorClass = "bg-gray-400 text-white";
      statusTooltip = "Estoque zerado e sem vendas significativas recentes.";
  }
  
  // Determine fill color for the visual stack based on sales status if available,
  // otherwise fall back to simple stock percentage
  let visualFillColor = 'bg-primary'; // Default
  if (salesBasedStatus === 'Critical') visualFillColor = 'bg-red-700';
  else if (salesBasedStatus === 'Urgent') visualFillColor = 'bg-orange-500';
  else if (salesBasedStatus === 'Low') visualFillColor = 'bg-yellow-500';
  else if (salesBasedStatus === 'Healthy') visualFillColor = 'bg-green-600';
  else if (salesBasedStatus === 'Overstocked') visualFillColor = 'bg-blue-600';
  else if (salesBasedStatus === 'NoSales') visualFillColor = 'bg-slate-400';
  else if (salesBasedStatus === 'N/A' || currentStock === 0) visualFillColor = 'bg-muted'; // Empty based on visual or N/A status
  else if (stockPercentageVisual < 25) visualFillColor = 'bg-yellow-400'; // Visual low (fallback)
  else if (stockPercentageVisual < 75) visualFillColor = 'bg-sky-500'; // Visual medium (fallback)
  else visualFillColor = 'bg-green-500'; // Visual good (fallback)


  return (
    <Card className="w-36 md:w-44 shadow-lg hover:shadow-xl transition-shadow flex flex-col">
      <CardHeader className="p-2.5 text-center space-y-0.5">
        <CardTitle className="text-xs font-semibold leading-tight break-words" title={pillowName}>
          {pillowName}
        </CardTitle>
        {productDerivation && (
          <p className="text-xxs text-muted-foreground leading-tight break-words truncate" title={productDerivation}>
            ID: {productDerivation}
          </p>
        )}
      </CardHeader>
      <CardContent className="p-2.5 flex flex-col items-center flex-grow justify-between">
        <div className="h-56 w-16 md:w-20 bg-muted rounded-md border border-border overflow-hidden flex flex-col justify-end relative shadow-inner">
          <div
            className={`w-full ${visualFillColor} transition-all duration-500 ease-in-out`}
            style={{ height: `${stockPercentageVisual}%` }}
            aria-label={`Estoque Visual: ${currentStock} de ${maxStock}`}
          ></div>
          {currentStock < maxStock && currentStock > 0 && (
             <div
                className="absolute left-0 w-full border-t-2 border-dashed border-muted-foreground opacity-30"
                style={{bottom: `${stockPercentageVisual}%`, height: `${100-stockPercentageVisual}%` }}
                title={`Capacidade Visual Coluna: ${maxStock}`}
              ></div>
          )}
           {isOverStockedVisual && (
             <div className="absolute top-0 left-0 w-full h-full flex items-center justify-center">
                <AlertTriangle className="h-6 w-6 text-red-300 opacity-50" title={`Estoque (${currentStock}) excede máx. visual (${maxStock})`} />
             </div>
           )}
        </div>
        <div className="mt-1.5 text-center w-full space-y-0.5">
            <Tooltip>
              <TooltipTrigger asChild>
                <Badge variant="outline" className={`text-xxs font-bold w-full justify-center cursor-help ${statusColorClass}`}>
                    {statusIcon} {statusText}
                </Badge>
              </TooltipTrigger>
              <TooltipContent side="top" className="max-w-xs text-center">
                <p>{statusTooltip}</p>
              </TooltipContent>
            </Tooltip>

            <p className="text-xs font-medium text-foreground">
              Est: {currentStock.toLocaleString()} / Col: {maxStock}
            </p>
             {typeof daysOfStock === 'number' && daysOfStock !== Infinity && dailyAverageSales && dailyAverageSales > 0 && (
                <p className="text-xxs text-muted-foreground">
                    Cob: {daysOfStock.toFixed(0)} dias (VMD: {dailyAverageSales.toFixed(1)})
                </p>
            )}
            {dailyAverageSales !== undefined && dailyAverageSales < 0.1 && currentStock > 0 && ( // Specifically for NoSales and N/A with stock
                 <p className="text-xxs text-muted-foreground">
                    Venda 30d Irrelevante
                </p>
            )}
            {daysOfStock === Infinity && currentStock > 0 && dailyAverageSales === 0 && (
                <p className="text-xxs text-muted-foreground">
                    Cob: <span className="text-xl">∞</span> dias
                </p>
            )}


            {typeof sales30d === 'number' && (
                <p className="text-xxs text-muted-foreground flex items-center justify-center gap-1">
                    <ShoppingBag className="h-3 w-3 text-blue-500" /> V30d: {sales30d}
                </p>
            )}
            {typeof openOrders === 'number' && openOrders > 0 && (
                <p className="text-xxs text-muted-foreground flex items-center justify-center gap-1">
                    <Inbox className="h-3 w-3 text-sky-600" /> Aberto: {openOrders}
                </p>
            )}
            {typeof replenishmentSuggestionForSales === 'number' && replenishmentSuggestionForSales > 0 && (
                 <Tooltip>
                    <TooltipTrigger asChild>
                        <Badge variant="default" className="text-xxs bg-green-600 hover:bg-green-700 text-white mt-0.5 w-full justify-center cursor-default">
                            <PlusCircle className="mr-1 h-3 w-3" /> Sug. Repor: {replenishmentSuggestionForSales}
                        </Badge>
                    </TooltipTrigger>
                    <TooltipContent side="bottom"><p>Para atingir cobertura de vendas ideal.</p></TooltipContent>
                 </Tooltip>
            )}
        </div>
      </CardContent>
    </Card>
  );
}
