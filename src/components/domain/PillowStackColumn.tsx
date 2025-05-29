
'use client';

import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";

interface PillowStackColumnProps {
  pillowName: string;
  currentStock: number;
  maxStock?: number;
}

const DEFAULT_MAX_STOCK = 100;

export function PillowStackColumn({
  pillowName,
  currentStock,
  maxStock = DEFAULT_MAX_STOCK,
}: PillowStackColumnProps) {
  const stockPercentage = Math.min(Math.max((currentStock / maxStock) * 100, 0), 100);
  const isEmpty = currentStock <= 0;
  const isFull = currentStock >= maxStock;

  let fillColor = 'bg-primary'; // Default fill color
  if (stockPercentage < 25) {
    fillColor = 'bg-destructive'; // Low stock
  } else if (stockPercentage < 75) {
    fillColor = 'bg-yellow-500'; // Medium stock
  } else {
    fillColor = 'bg-green-500'; // Good stock
  }
  if (isEmpty) {
    fillColor = 'bg-muted';
  }


  return (
    <Card className="w-32 md:w-40 shadow-lg hover:shadow-xl transition-shadow">
      <CardHeader className="p-3 text-center">
        <CardTitle className="text-sm font-semibold truncate" title={pillowName}>
          {pillowName}
        </CardTitle>
      </CardHeader>
      <CardContent className="p-3 flex flex-col items-center">
        <div className="h-64 w-16 md:w-20 bg-muted rounded-md border border-border overflow-hidden flex flex-col justify-end relative shadow-inner">
          {/* Filled portion */}
          <div
            className={`w-full ${fillColor} transition-all duration-500 ease-in-out`}
            style={{ height: `${stockPercentage}%` }}
            aria-label={`Estoque: ${currentStock} de ${maxStock}`}
          ></div>
          {/* Optional: visual cue for max stock if not full */}
          {!isFull && stockPercentage > 0 && (
             <div className="absolute top-0 left-0 w-full border-t-2 border-dashed border-muted-foreground opacity-50" style={{bottom: `${stockPercentage}%`}}></div>
          )}
        </div>
        <p className="mt-2 text-xs text-muted-foreground">
          {isFull && <span className="font-bold text-green-600">CHEIO</span>}
          {isEmpty && <span className="font-bold text-destructive">VAZIO</span>}
          {!isFull && !isEmpty && `${currentStock} / ${maxStock}`}
          {currentStock > maxStock && <span className="font-bold text-red-700 ml-1">(+{currentStock - maxStock} Acima)</span>}
        </p>
         {stockPercentage < 25 && !isEmpty && <p className="text-xs font-semibold text-destructive mt-1">Baixo Estoque!</p>}
      </CardContent>
    </Card>
  );
}
