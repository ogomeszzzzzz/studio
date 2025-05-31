
'use client';

import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Badge } from "@/components/ui/badge";
import { TrendingUp, AlertCircle, PackageX, Zap, Inbox } from "lucide-react";

interface PillowStackColumnProps {
  pillowName: string;
  productDerivation?: string;
  currentStock: number;
  maxStock?: number;
  sales30d?: number;
  openOrders?: number;
  isCritical?: boolean;
  isUrgent?: boolean;
}

const DEFAULT_MAX_STOCK = 75;
const LOW_STOCK_WARNING_THRESHOLD_PERCENTAGE = 0.25; // For "Baixo Estoque" general warning

export function PillowStackColumn({
  pillowName,
  productDerivation,
  currentStock,
  maxStock = DEFAULT_MAX_STOCK,
  sales30d,
  openOrders,
  isCritical,
  isUrgent,
}: PillowStackColumnProps) {
  const stockPercentage = Math.min(Math.max((currentStock / maxStock) * 100, 0), 100);
  const isEmpty = currentStock <= 0;
  const isFull = currentStock >= maxStock && currentStock > 0;
  const isOverStocked = currentStock > maxStock;
  
  const lowStockThresholdValue = maxStock * LOW_STOCK_WARNING_THRESHOLD_PERCENTAGE;
  const isGenerallyLowStock = currentStock > 0 && (currentStock + (openOrders || 0)) < lowStockThresholdValue && !isCritical && !isUrgent;


  let fillColor = 'bg-primary'; // Default color
  if (isCritical) {
    fillColor = 'bg-red-700'; // Most critical color
  } else if (isUrgent) {
    fillColor = 'bg-orange-500'; // Urgent color
  } else if (isEmpty && (openOrders || 0) === 0) { // Only truly empty if no open orders
    fillColor = 'bg-muted';
  } else if (isGenerallyLowStock) {
    fillColor = 'bg-yellow-500';
  } else if (stockPercentage < 75) {
    fillColor = 'bg-sky-500'; 
  } else {
    fillColor = 'bg-green-500'; // Good stock
  }


  return (
    <Card className="w-32 md:w-40 shadow-lg hover:shadow-xl transition-shadow flex flex-col">
      <CardHeader className="p-3 text-center space-y-0.5">
        <CardTitle className="text-sm font-semibold leading-tight break-words" title={pillowName}>
          {pillowName}
        </CardTitle>
        {productDerivation && (
          <p className="text-xs text-muted-foreground leading-tight break-words" title={productDerivation}>
            {productDerivation}
          </p>
        )}
      </CardHeader>
      <CardContent className="p-3 flex flex-col items-center flex-grow justify-between">
        <div className="h-64 w-16 md:w-20 bg-muted rounded-md border border-border overflow-hidden flex flex-col justify-end relative shadow-inner">
          <div
            className={`w-full ${fillColor} transition-all duration-500 ease-in-out`}
            style={{ height: `${stockPercentage}%` }}
            aria-label={`Estoque: ${currentStock} de ${maxStock}`}
          ></div>
          {!isFull && !isEmpty && currentStock < maxStock && (
             <div
                className="absolute left-0 w-full border-t-2 border-dashed border-muted-foreground opacity-50"
                style={{bottom: `${stockPercentage}%`, height: `${100-stockPercentage}%` }}
                title={`Capacidade: ${maxStock}`}
              ></div>
          )}
        </div>
        <div className="mt-2 text-center w-full space-y-1">
            <p className="text-xs text-muted-foreground">
            {isFull && !isOverStocked && <span className="font-bold text-green-600">CHEIO</span>}
            {isEmpty && (openOrders || 0) === 0 && !isCritical && <span className="font-bold text-destructive">VAZIO (Sem Venda/Pedido)</span>}
            {!isFull && !(isEmpty && (openOrders || 0) === 0) && !isOverStocked && `${currentStock} / ${maxStock}`}
            {isOverStocked && (
                <>
                <span className="font-bold text-red-700">{currentStock} / {maxStock}</span>
                <br />
                <span className="text-xs font-semibold text-red-700">(+{currentStock - maxStock} Acima)</span>
                </>
            )}
            </p>
            {isCritical && (
                <Badge variant="destructive" className="text-xs font-bold bg-red-700 hover:bg-red-800">
                    <PackageX className="mr-1 h-3 w-3" /> RUPTURA
                </Badge>
            )}
            {isUrgent && (
                 <Badge variant="destructive" className="text-xs font-bold bg-orange-500 hover:bg-orange-600 text-white">
                    <Zap className="mr-1 h-3 w-3" /> URGENTE
                </Badge>
            )}
            {isGenerallyLowStock && (
                <Badge variant="outline" className="text-xs font-semibold border-yellow-500 text-yellow-600">
                    <AlertCircle className="mr-1 h-3 w-3" />
                    {openOrders && openOrders > 0 ? `Baixo (Chegando: ${openOrders})` : "Baixo Estoque"}
                </Badge>
            )}
            
            <p className="text-xs font-medium text-foreground">
              Preenchimento: {stockPercentage.toFixed(0)}%
            </p>
            {typeof sales30d === 'number' && (
                <p className="text-xs text-muted-foreground flex items-center justify-center">
                    <TrendingUp className="mr-1 h-3 w-3 text-blue-500" /> Vendas 30d: {sales30d}
                </p>
            )}
            {typeof openOrders === 'number' && openOrders > 0 && (
                <p className="text-xs text-muted-foreground flex items-center justify-center">
                    <Inbox className="mr-1 h-3 w-3 text-sky-600" /> Ped. Aberto: {openOrders}
                </p>
            )}
        </div>
      </CardContent>
    </Card>
  );
}

