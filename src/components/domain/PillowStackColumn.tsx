
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PillowStackColumnProps {
  pillowName: string;
  productDerivation?: string; // Added prop
  currentStock: number;
  maxStock?: number;
}

const DEFAULT_MAX_STOCK = 75;
const LOW_STOCK_WARNING_THRESHOLD_PERCENTAGE = 0.25;

export function PillowStackColumn({
  pillowName,
  productDerivation, // Use prop
  currentStock,
  maxStock = DEFAULT_MAX_STOCK,
}: PillowStackColumnProps) {
  const stockPercentage = Math.min(Math.max((currentStock / maxStock) * 100, 0), 100);
  const isEmpty = currentStock <= 0;
  const isFull = currentStock >= maxStock && currentStock > 0;
  const isOverStocked = currentStock > maxStock;
  const lowStockThresholdValue = maxStock * LOW_STOCK_WARNING_THRESHOLD_PERCENTAGE;
  const isLowStock = currentStock > 0 && currentStock < lowStockThresholdValue;


  let fillColor = 'bg-primary';
  if (isEmpty) {
    fillColor = 'bg-muted';
  } else if (isLowStock) {
    fillColor = 'bg-destructive';
  } else if (stockPercentage < 75) {
    fillColor = 'bg-yellow-500';
  } else {
    fillColor = 'bg-green-500';
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
          {/* Filled portion */}
          <div
            className={`w-full ${fillColor} transition-all duration-500 ease-in-out`}
            style={{ height: `${stockPercentage}%` }}
            aria-label={`Estoque: ${currentStock} de ${maxStock}`}
          ></div>
          {/* Visual cue for max stock if not full and not empty */}
          {!isFull && !isEmpty && currentStock < maxStock && (
             <div
                className="absolute left-0 w-full border-t-2 border-dashed border-muted-foreground opacity-50"
                style={{bottom: `${stockPercentage}%`, height: `${100-stockPercentage}%` }}
                title={`Capacidade: ${maxStock}`}
              ></div>
          )}
        </div>
        <div className="mt-2 text-center w-full">
            <p className="text-xs text-muted-foreground">
            {isFull && !isOverStocked && <span className="font-bold text-green-600">CHEIO</span>}
            {isEmpty && <span className="font-bold text-destructive">VAZIO</span>}
            {!isFull && !isEmpty && !isOverStocked && `${currentStock} / ${maxStock}`}
            {isOverStocked && (
                <>
                <span className="font-bold text-red-700">{currentStock} / {maxStock}</span>
                <br />
                <span className="text-xs font-semibold text-red-700">(+{currentStock - maxStock} Acima)</span>
                </>
            )}
            </p>
            {isLowStock && <p className="text-xs font-semibold text-destructive mt-1">Baixo Estoque!</p>}
            <p className="text-xs font-medium text-foreground mt-1">
              Preenchimento: {stockPercentage.toFixed(0)}%
            </p>
        </div>
      </CardContent>
    </Card>
  );
}
