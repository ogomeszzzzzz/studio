
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import {
  BarChartBig, ShoppingBag, AlertTriangle, FileSpreadsheet,
  Layers, TrendingDown, PackageCheck, ClipboardList, Palette, Box, Ruler
} from 'lucide-react';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import type { Product } from '@/types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart"

interface AggregatedCollectionData {
  name: string;
  stock: number;
  skus: number;
}

interface AggregatedSizeData {
  name: string; // Size name e.g. 'P', 'M', or from Excel 'Tamanho'
  stock: number;
}

interface AggregatedPrintData {
  name: string; // Print/Pattern Description from Excel 'Descrição'
  stock: number;
}
interface AggregatedProductTypeData {
  name: string; // Product Type from Excel 'Tipo. Produto'
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
    // Diagnostic log:
    if (data.length > 0) {
      console.log("--- DIAGNÓSTICO ESTAMPA ---");
      console.log("Amostra dos valores de 'product.description' lidos do Excel (deveriam ser as estampas da coluna 'Descrição'):");
      data.slice(0, 5).forEach((p, index) => {
        console.log(`Produto ${index + 1} - product.description: "${p.description}" (Usado para 'Estoque por Estampa')`);
      });
      console.log("--- FIM DIAGNÓSTICO ESTAMPA ---");
    }
  }, []);

  const handleProcessingStart = () => setIsProcessingExcel(true);
  const handleProcessingEnd = () => setIsProcessingExcel(false);

  const aggregatedData = useMemo(() => {
    if (dashboardProducts.length === 0) {
      return {
        stockByCollection: [],
        stockBySize: [],
        stockByPrint: [],
        stockByProductType: [],
        zeroStockSkusByCollection: [],
        totalStock: 0,
        totalSkus: 0,
        totalZeroStockSkus: 0,
        totalReadyToShipStock: 0,
        totalOrderedStock: 0,
      };
    }

    const stockByCollectionMap = new Map<string, { stock: number; skus: number }>();
    const stockBySizeMap = new Map<string, { stock: number }>();
    const stockByPrintMap = new Map<string, { stock: number }>(); // Uses product.description
    const stockByProductTypeMap = new Map<string, { stock: number }>();
    const zeroStockSkusByCollectionMap = new Map<string, { count: number }>();

    let totalStock = 0;
    let totalSkus = dashboardProducts.length;
    let totalZeroStockSkus = 0;
    let totalReadyToShipStock = 0;
    let totalOrderedStock = 0;

    dashboardProducts.forEach(product => {
      const collectionKey = product.collection || 'Não Especificada'; // From 'Descrição Linha Comercial'
      const sizeKey = product.size || 'Não Especificado'; // From Excel 'Tamanho'
      const printKey = product.description || 'Não Especificada'; // From Excel 'Descrição' - FOR STAMPS
      const typeKey = product.productType || 'Não Especificado'; // From Excel 'Tipo. Produto'

      // Stock by Collection ('Descrição Linha Comercial')
      const currentCol = stockByCollectionMap.get(collectionKey) || { stock: 0, skus: 0 };
      currentCol.stock += product.stock;
      currentCol.skus += 1;
      stockByCollectionMap.set(collectionKey, currentCol);

      // Stock by Size (from Excel 'Tamanho')
      const currentSize = stockBySizeMap.get(sizeKey) || { stock: 0 };
      currentSize.stock += product.stock;
      stockBySizeMap.set(sizeKey, currentSize);

      // Stock by Print (product.description, from Excel 'Descrição')
      const currentPrint = stockByPrintMap.get(printKey) || { stock: 0 };
      currentPrint.stock += product.stock;
      stockByPrintMap.set(printKey, currentPrint);

      // Stock by Product Type (from Excel 'Tipo. Produto')
      const currentType = stockByProductTypeMap.get(typeKey) || { stock: 0 };
      currentType.stock += product.stock;
      stockByProductTypeMap.set(typeKey, currentType);

      // Zero Stock SKUs
      if (product.stock === 0) {
        const currentZeroCol = zeroStockSkusByCollectionMap.get(collectionKey) || { count: 0 };
        currentZeroCol.count += 1;
        zeroStockSkusByCollectionMap.set(collectionKey, currentZeroCol);
        totalZeroStockSkus++;
      }
      totalStock += product.stock;
      totalReadyToShipStock += product.readyToShip;
      totalOrderedStock += product.order;
    });

    return {
      stockByCollection: Array.from(stockByCollectionMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock),
      stockBySize: Array.from(stockBySizeMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock),
      stockByPrint: Array.from(stockByPrintMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock).slice(0, 15), // Top 15 prints
      stockByProductType: Array.from(stockByProductTypeMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock),
      zeroStockSkusByCollection: Array.from(zeroStockSkusByCollectionMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.count - a.count),
      totalStock,
      totalSkus,
      totalZeroStockSkus,
      totalReadyToShipStock,
      totalOrderedStock,
    };
  }, [dashboardProducts]);

  const createChartConfig = (data: {name: string}[]) => {
    const config: ChartConfig = {...chartConfigBase};
    data.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: COLORS[index % COLORS.length],
      };
    });
    return config;
  };

  const stockByCollectionChartConfig = useMemo(() => createChartConfig(aggregatedData.stockByCollection), [aggregatedData.stockByCollection]);
  const stockBySizeChartConfig = useMemo(() => createChartConfig(aggregatedData.stockBySize), [aggregatedData.stockBySize]);
  const stockByPrintChartConfig = useMemo(() => createChartConfig(aggregatedData.stockByPrint), [aggregatedData.stockByPrint]);
  const stockByProductTypeChartConfig = useMemo(() => createChartConfig(aggregatedData.stockByProductType), [aggregatedData.stockByProductType]);
  const zeroStockSkusChartConfig = useMemo(() => createChartConfig(aggregatedData.zeroStockSkusByCollection), [aggregatedData.zeroStockSkusByCollection]);


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard de Performance</h1>
          <p className="text-muted-foreground">Visão geral dos dados da sua coleção com base na coluna "Descrição Linha Comercial".</p>
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
        collectionColumnKey="Descrição Linha Comercial" // For collection grouping on dashboard
        cardTitle="Upload de Dados para Dashboard"
        cardDescription="Carregue o arquivo Excel. A coluna 'Descrição Linha Comercial' será usada para agrupar coleções neste dashboard."
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
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-5">
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
                <CardTitle className="text-sm font-medium">Pronta Entrega</CardTitle>
                <PackageCheck className="h-5 w-5 text-green-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{aggregatedData.totalReadyToShipStock.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">unidades prontas para envio</p>
              </CardContent>
            </Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
                <CardTitle className="text-sm font-medium">Pedidos</CardTitle>
                <ClipboardList className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{aggregatedData.totalOrderedStock.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">unidades em pedidos</p>
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
                <CardTitle className="flex items-center"><ShoppingBag className="mr-2 h-5 w-5 text-primary" />Estoque por Descrição Linha Comercial</CardTitle>
                <CardDescription>Distribuição de estoque e SKUs pela coluna "Descrição Linha Comercial" do Excel.</CardDescription>
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
                ) : <p className="text-muted-foreground text-center pt-10">Sem dados de estoque por descrição linha comercial.</p>}
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center"><Ruler className="mr-2 h-5 w-5 text-accent" />Estoque por Tamanho</CardTitle>
                <CardDescription>Distribuição de estoque por tamanho de produto (coluna "Tamanho" do Excel).</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                {aggregatedData.stockBySize.length > 0 ? (
                   <ChartContainer config={stockBySizeChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aggregatedData.stockBySize} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                            <XAxis type="number" tickFormatter={(value) => value.toLocaleString()}/>
                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}}/>
                            <Tooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Bar dataKey="stock" name="Estoque" fill="hsl(var(--accent))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                   </ChartContainer>
                ) : (
                    <p className="text-muted-foreground text-center pt-10">Carregue dados para ver a análise por tamanho.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5" style={{color: 'hsl(var(--chart-4))'}} />Estoque por Estampa (Top 15)</CardTitle>
                <CardDescription>Distribuição de estoque pelas principais estampas (coluna "Descrição" do Excel).</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                {aggregatedData.stockByPrint.length > 0 ? (
                  <ChartContainer config={stockByPrintChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aggregatedData.stockByPrint} margin={{ top: 5, right: 20, left: 10, bottom: 90 }}>
                        <CartesianGrid strokeDasharray="3 3" vertical={false}/>
                        <XAxis dataKey="name" angle={-60} textAnchor="end" interval={0} height={100} tick={{fontSize: 10}}/>
                        <YAxis tickFormatter={(value) => value.toLocaleString()}/>
                        <Tooltip content={<ChartTooltipContent />} />
                        <Legend />
                        <Bar dataKey="stock" name="Estoque" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                ) : <p className="text-muted-foreground text-center pt-10">Sem dados de estoque por estampa.</p>}
              </CardContent>
            </Card>

            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center"><Box className="mr-2 h-5 w-5" style={{color: 'hsl(var(--chart-5))'}} />Estoque por Tipo de Produto</CardTitle>
                <CardDescription>Distribuição de estoque por tipo de produto (coluna "Tipo. Produto" do Excel).</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                 {aggregatedData.stockByProductType.length > 0 ? (
                   <ChartContainer config={stockByProductTypeChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aggregatedData.stockByProductType} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                            <XAxis type="number" tickFormatter={(value) => value.toLocaleString()}/>
                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}}/>
                            <Tooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Bar dataKey="stock" name="Estoque" fill="hsl(var(--chart-5))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                   </ChartContainer>
                ) : (
                    <p className="text-muted-foreground text-center pt-10">Carregue dados para ver a análise por tipo de produto.</p>
                )}
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><TrendingDown className="mr-2 h-5 w-5 text-destructive" />SKUs Zerados por Descrição Linha Comercial</CardTitle>
              <CardDescription>Contagem de SKUs com estoque zero em cada descrição linha comercial (coluna "Descrição Linha Comercial" do Excel).</CardDescription>
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
