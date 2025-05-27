
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { BarChartBig, ShoppingBag, PackageSearch, AlertTriangle, FileSpreadsheet, Activity, Layers, TrendingDown, LayoutDashboard } from 'lucide-react';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import type { Product } from '@/types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart"

interface AggregatedCollectionData {
  name: string;
  stock: number;
  skus: number;
}

interface AggregatedSizeData {
  name: string; // Size name e.g. 'P', 'M'
  stock: number;
}

interface ZeroStockData {
  name: string; // Collection name
  count: number;
}

const chartConfigBase = {
  stock: {
    label: "Estoque",
  },
  skus: {
    label: "SKUs",
  },
  count: {
    label: "Contagem",
  }
} satisfies ChartConfig

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];


export default function DashboardPage() {
  const [dashboardProducts, setDashboardProducts] = useState<Product[]>([]);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);

  const handleDashboardDataParsed = useCallback((data: Product[]) => {
    setDashboardProducts(data);
  }, []);

  const handleProcessingStart = () => setIsProcessingExcel(true);
  const handleProcessingEnd = () => setIsProcessingExcel(false);

  const aggregatedData = useMemo(() => {
    if (dashboardProducts.length === 0) {
      return {
        stockByCollection: [],
        stockBySize: [],
        zeroStockSkusByCollection: [],
        totalStock: 0,
        totalSkus: 0,
        totalZeroStockSkus: 0,
      };
    }

    const stockByCollectionMap = new Map<string, { stock: number; skus: number }>();
    const stockBySizeMap = new Map<string, { stock: number }>();
    const zeroStockSkusByCollectionMap = new Map<string, { count: number }>();
    let totalStock = 0;
    let totalSkus = dashboardProducts.length;
    let totalZeroStockSkus = 0;

    dashboardProducts.forEach(product => {
      const collectionKey = product.collection || 'Não Especificada'; // 'collection' is now from 'Linha Comercial'
      const sizeKey = product.size || 'Não Especificado';

      // Stock by Collection (using product.collection which maps to "Linha Comercial")
      const currentCollection = stockByCollectionMap.get(collectionKey) || { stock: 0, skus: 0 };
      currentCollection.stock += product.stock;
      currentCollection.skus += 1;
      stockByCollectionMap.set(collectionKey, currentCollection);

      // Stock by Size
      const currentSize = stockBySizeMap.get(sizeKey) || { stock: 0 };
      currentSize.stock += product.stock;
      stockBySizeMap.set(sizeKey, currentSize);

      // Zero Stock SKUs
      if (product.stock === 0) {
        const currentZeroCollection = zeroStockSkusByCollectionMap.get(collectionKey) || { count: 0 };
        currentZeroCollection.count += 1;
        zeroStockSkusByCollectionMap.set(collectionKey, currentZeroCollection);
        totalZeroStockSkus++;
      }
      totalStock += product.stock;
    });

    return {
      stockByCollection: Array.from(stockByCollectionMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock),
      stockBySize: Array.from(stockBySizeMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock),
      zeroStockSkusByCollection: Array.from(zeroStockSkusByCollectionMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.count - a.count),
      totalStock,
      totalSkus,
      totalZeroStockSkus,
    };
  }, [dashboardProducts]);
  
  const stockByCollectionChartConfig = useMemo(() => {
    const config: ChartConfig = {...chartConfigBase};
    aggregatedData.stockByCollection.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: COLORS[index % COLORS.length],
      };
    });
    return config;
  }, [aggregatedData.stockByCollection]);

  const stockBySizeChartConfig = useMemo(() => {
    const config: ChartConfig = {...chartConfigBase};
    aggregatedData.stockBySize.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: COLORS[index % COLORS.length],
      };
    });
    return config;
  }, [aggregatedData.stockBySize]);
  
  const zeroStockSkusChartConfig = useMemo(() => {
    const config: ChartConfig = {...chartConfigBase};
    aggregatedData.zeroStockSkusByCollection.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: COLORS[index % COLORS.length],
      };
    });
    return config;
  }, [aggregatedData.zeroStockSkusByCollection]);


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard de Performance</h1>
          <p className="text-muted-foreground">Visão geral dos dados da sua coleção com base na "Linha Comercial".</p>
        </div>
        <Link href="/collection-analyzer">
          <Button>
            <BarChartBig className="mr-2 h-5 w-5" />
            Ir para Gap Analyzer
          </Button>
        </Link>
      </div>

      <ExcelUploadSection
        onDataParsed={handleDashboardDataParsed}
        onProcessingStart={handleProcessingStart}
        onProcessingEnd={handleProcessingEnd}
        collectionColumnKey="Linha Comercial" // Use 'Linha Comercial' column for dashboard collections
        cardTitle="Upload de Dados para Dashboard"
        cardDescription="Carregue o arquivo Excel. A coluna 'Linha Comercial' será usada para agrupar coleções."
      />

      {dashboardProducts.length === 0 && !isProcessingExcel && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle>Sem dados para exibir</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Por favor, carregue um arquivo Excel para popular o dashboard.</p>
          </CardContent>
        </Card>
      )}

      {dashboardProducts.length > 0 && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Estoque Total</CardTitle>
                <Layers className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{aggregatedData.totalStock.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">unidades em estoque</p>
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total SKUs</CardTitle>
                <FileSpreadsheet className="h-5 w-5 text-primary" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{aggregatedData.totalSkus.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">SKUs distintos carregados</p>
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Total SKUs Zerados</CardTitle>
                <AlertTriangle className="h-5 w-5 text-destructive" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-destructive">{aggregatedData.totalZeroStockSkus.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">SKUs com estoque zero</p>
              </CardContent>
            </Card>
          </div>
          
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center"><ShoppingBag className="mr-2 h-5 w-5 text-primary" />Estoque por Linha Comercial</CardTitle>
                <CardDescription>Distribuição de estoque e SKUs por linha comercial.</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                {aggregatedData.stockByCollection.length > 0 ? (
                  <ChartContainer config={stockByCollectionChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aggregatedData.stockByCollection} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                        <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={80} tick={{fontSize: 12}}/>
                        <YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" tickFormatter={(value) => value.toLocaleString()}/>
                        <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--accent))" tickFormatter={(value) => value.toLocaleString()}/>
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar yAxisId="left" dataKey="stock" name="Estoque" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} />
                        <Bar yAxisId="right" dataKey="skus" name="SKUs" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : <p className="text-muted-foreground text-center pt-10">Sem dados de estoque por linha comercial.</p>}
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center"><PackageSearch className="mr-2 h-5 w-5 text-accent" />Estoque por Tamanho</CardTitle>
                <CardDescription>Distribuição de estoque por tamanho de produto.</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                {aggregatedData.stockBySize.length > 0 ? (
                   <ChartContainer config={stockBySizeChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aggregatedData.stockBySize} layout="vertical" margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                            <XAxis type="number" tickFormatter={(value) => value.toLocaleString()}/>
                            <YAxis dataKey="name" type="category" width={60} tick={{fontSize: 12}}/>
                            <Tooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Bar dataKey="stock" name="Estoque" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                   </ChartContainer>
                ) : <p className="text-muted-foreground text-center pt-10">Sem dados de estoque por tamanho.</p>}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><TrendingDown className="mr-2 h-5 w-5 text-destructive" />SKUs Zerados por Linha Comercial</CardTitle>
              <CardDescription>Contagem de SKUs com estoque zero em cada linha comercial.</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              {aggregatedData.zeroStockSkusByCollection.length > 0 ? (
                <ChartContainer config={zeroStockSkusChartConfig} className="h-full w-full">
                <ResponsiveContainer width="100%" height="100%">
                    <BarChart data={aggregatedData.zeroStockSkusByCollection} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false} />
                        <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={80} tick={{fontSize: 12}}/>
                        <YAxis allowDecimals={false} tickFormatter={(value) => value.toLocaleString()}/>
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="count" name="SKUs Zerados" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                    </BarChart>
                </ResponsiveContainer>
                </ChartContainer>
              ) : <p className="text-muted-foreground text-center pt-10">Nenhum SKU com estoque zerado ou sem dados carregados.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
