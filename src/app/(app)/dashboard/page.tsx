
'use client';

import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BarChartBig, ShoppingBag, PackageSearch, AlertTriangle } from 'lucide-react';

// Mock data for dashboard display - replace with actual data fetching and processing logic
const dashboardData = {
  stockByCollection: [
    { name: 'Verão 2024', stock: 1200, skus: 150 },
    { name: 'Inverno 2023', stock: 300, skus: 45 },
    { name: 'Promoção Outono', stock: 850, skus: 90 },
  ],
  stockBySize: [
    { size: 'P', stock: 750 },
    { size: 'M', stock: 900 },
    { size: 'G', stock: 600 },
    { size: 'GG', stock: 100 },
  ],
  zeroStockSkus: [
    { collection: 'Verão 2024', count: 15 },
    { collection: 'Inverno 2023', count: 5 },
  ],
};

export default function DashboardPage() {
  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard</h1>
          <p className="text-muted-foreground">Visão geral dos dados da sua coleção.</p>
        </div>
        <Link href="/collection-analyzer">
          <Button>
            <BarChartBig className="mr-2 h-5 w-5" />
            Ir para Gap Analyzer
          </Button>
        </Link>
      </div>

      <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque Total por Coleção</CardTitle>
            <ShoppingBag className="h-5 w-5 text-primary" />
          </CardHeader>
          <CardContent>
            {dashboardData.stockByCollection.map((item) => (
              <div key={item.name} className="mb-2 last:mb-0">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">{item.name}</span>
                  <span className="text-muted-foreground">{item.stock} unidades ({item.skus} SKUs)</span>
                </div>
                {/* Basic progress bar example */}
                <div className="w-full bg-muted rounded-full h-2.5 mt-1">
                  <div className="bg-primary h-2.5 rounded-full" style={{ width: `${(item.stock / 2000) * 100}%` }}></div>
                </div>
              </div>
            ))}
            <p className="text-xs text-muted-foreground mt-3">
              Esta é uma visualização de exemplo. Conecte seus dados reais.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Estoque por Tamanho</CardTitle>
            <PackageSearch className="h-5 w-5 text-accent" />
          </CardHeader>
          <CardContent>
             {dashboardData.stockBySize.map((item) => (
              <div key={item.size} className="mb-2 last:mb-0">
                <div className="flex justify-between text-sm">
                  <span className="font-medium text-foreground">Tamanho {item.size}</span>
                  <span className="text-muted-foreground">{item.stock} unidades</span>
                </div>
                 <div className="w-full bg-muted rounded-full h-2.5 mt-1">
                  <div className="bg-accent h-2.5 rounded-full" style={{ width: `${(item.stock / 1000) * 100}%` }}></div>
                </div>
              </div>
            ))}
             <p className="text-xs text-muted-foreground mt-3">
              Dados de exemplo. Implemente a lógica de agregação.
            </p>
          </CardContent>
        </Card>

        <Card className="shadow-lg hover:shadow-xl transition-shadow">
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">SKUs Zerados por Coleção</CardTitle>
            <AlertTriangle className="h-5 w-5 text-destructive" />
          </CardHeader>
          <CardContent>
            {dashboardData.zeroStockSkus.map((item) => (
                <div key={item.collection} className="mb-2 last:mb-0 text-sm">
                   <span className="font-medium text-foreground">{item.collection}: </span>
                   <span className="text-destructive font-semibold">{item.count} SKUs zerados</span>
                </div>
            ))}
            <p className="text-xs text-muted-foreground mt-3">
              Identifique rapidamente produtos sem estoque.
            </p>
          </CardContent>
        </Card>
      </div>
      
      {/* Placeholder for charts - you can use recharts or other libraries */}
      <Card className="shadow-lg">
        <CardHeader>
          <CardTitle>Visualização de Dados Futura</CardTitle>
          <CardDescription>Gráficos e outras visualizações de dados serão adicionados aqui.</CardDescription>
        </CardHeader>
        <CardContent className="h-64 flex items-center justify-center bg-muted/30 rounded-md">
          <p className="text-muted-foreground">Espaço reservado para gráficos</p>
        </CardContent>
      </Card>

    </div>
  );
}
