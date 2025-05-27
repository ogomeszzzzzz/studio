
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import Link from 'next/link';
import { 
  BarChartBig, ShoppingBag, PackageSearch, AlertTriangle, FileSpreadsheet, 
  Layers, TrendingDown, PackageCheck, ClipboardList, Palette, Cpu, Loader2
} from 'lucide-react';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import type { Product, CategorizedProduct } from '@/types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, PieChart, Pie, Cell, CartesianGrid } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart"
import { getAIProductCategorization } from '@/app/actions/product-analysis';
import { useToast } from '@/hooks/use-toast';

interface AggregatedCollectionData {
  name: string;
  stock: number;
  skus: number;
}

interface AggregatedSizeData {
  name: string; // Size name e.g. 'P', 'M'
  stock: number;
}

interface AggregatedPrintData {
  name: string; // Print/Pattern Description
  stock: number;
}
interface AggregatedProductTypeData {
  name: string; // AI Identified Product Type
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
  const [categorizedProductTypes, setCategorizedProductTypes] = useState<CategorizedProduct[]>([]);
  const [isCategorizingProducts, setIsCategorizingProducts] = useState(false);
  const { toast } = useToast();

  const handleDashboardDataParsed = useCallback((data: Product[]) => {
    setDashboardProducts(data);
    setCategorizedProductTypes([]); // Reset AI categories when new data is loaded
  }, []);

  const handleProcessingStart = () => setIsProcessingExcel(true);
  const handleProcessingEnd = () => setIsProcessingExcel(false);

  useEffect(() => {
    if (dashboardProducts.length > 0) {
      const fetchProductCategories = async () => {
        setIsCategorizingProducts(true);
        const productNames = dashboardProducts.map(p => p.name).filter(name => name && name.trim() !== '');
        if (productNames.length === 0) {
          setIsCategorizingProducts(false);
          return;
        }
        
        const result = await getAIProductCategorization(productNames);
        if ('error' in result) {
          toast({
            title: "Erro na Categorização por IA",
            description: result.error,
            variant: "destructive",
          });
          setCategorizedProductTypes([]);
        } else {
          setCategorizedProductTypes(result.categorizedProducts);
           toast({
            title: "Categorização por IA Concluída",
            description: `${result.categorizedProducts.length} tipos de produtos identificados.`,
          });
        }
        setIsCategorizingProducts(false);
      };
      fetchProductCategories();
    }
  }, [dashboardProducts, toast]);

  const productsWithAiTypes = useMemo(() => {
    if (categorizedProductTypes.length === 0) return dashboardProducts;
    const typeMap = new Map(categorizedProductTypes.map(item => [item.originalName, item.identifiedType]));
    return dashboardProducts.map(product => ({
      ...product,
      identifiedType: typeMap.get(product.name) || 'Outros'
    }));
  }, [dashboardProducts, categorizedProductTypes]);


  const aggregatedData = useMemo(() => {
    if (productsWithAiTypes.length === 0) {
      return {
        stockByCollection: [],
        stockBySize: [],
        stockByPrint: [],
        stockByAiProductType: [],
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
    const stockByPrintMap = new Map<string, { stock: number }>();
    const stockByAiProductTypeMap = new Map<string, { stock: number }>();
    const zeroStockSkusByCollectionMap = new Map<string, { count: number }>();
    
    let totalStock = 0;
    let totalSkus = productsWithAiTypes.length;
    let totalZeroStockSkus = 0;
    let totalReadyToShipStock = 0;
    let totalOrderedStock = 0;

    productsWithAiTypes.forEach(product => {
      const collectionKey = product.collection || 'Não Especificada';
      const sizeKey = product.size || 'Não Especificado';
      const printKey = product.description || 'Não Especificada'; // Using 'description' for print/pattern
      const aiTypeKey = product.identifiedType || 'Não Categorizado (IA)';

      // Stock by Collection
      const currentCol = stockByCollectionMap.get(collectionKey) || { stock: 0, skus: 0 };
      currentCol.stock += product.stock;
      currentCol.skus += 1;
      stockByCollectionMap.set(collectionKey, currentCol);

      // Stock by Size
      const currentSize = stockBySizeMap.get(sizeKey) || { stock: 0 };
      currentSize.stock += product.stock;
      stockBySizeMap.set(sizeKey, currentSize);

      // Stock by Print (Description)
      const currentPrint = stockByPrintMap.get(printKey) || { stock: 0 };
      currentPrint.stock += product.stock;
      stockByPrintMap.set(printKey, currentPrint);

      // Stock by AI Product Type
      const currentAiType = stockByAiProductTypeMap.get(aiTypeKey) || { stock: 0 };
      currentAiType.stock += product.stock;
      stockByAiProductTypeMap.set(aiTypeKey, currentAiType);

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
      stockByAiProductType: Array.from(stockByAiProductTypeMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock),
      zeroStockSkusByCollection: Array.from(zeroStockSkusByCollectionMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.count - a.count),
      totalStock,
      totalSkus,
      totalZeroStockSkus,
      totalReadyToShipStock,
      totalOrderedStock,
    };
  }, [productsWithAiTypes]);
  
  // Chart Configs
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
  const stockByAiProductTypeChartConfig = useMemo(() => createChartConfig(aggregatedData.stockByAiProductType), [aggregatedData.stockByAiProductType]);
  const zeroStockSkusChartConfig = useMemo(() => createChartConfig(aggregatedData.zeroStockSkusByCollection), [aggregatedData.zeroStockSkusByCollection]);


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard de Performance</h1>
          <p className="text-muted-foreground">Visão geral dos dados da sua coleção com base na "Descrição Linha Comercial".</p>
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
        collectionColumnKey="Descrição Linha Comercial"
        cardTitle="Upload de Dados para Dashboard"
        cardDescription="Carregue o arquivo Excel. A coluna 'Descrição Linha Comercial' será usada para agrupar coleções."
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
      
      {isCategorizingProducts && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Loader2 className="mr-2 h-5 w-5 animate-spin text-primary" />
              Categorizando Produtos com IA...
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Aguarde enquanto a inteligência artificial analisa e categoriza os nomes dos produtos.</p>
          </CardContent>
        </Card>
      )}


      {productsWithAiTypes.length > 0 && (
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
                <CardDescription>Distribuição de estoque e SKUs por descrição linha comercial.</CardDescription>
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
          
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <Card className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5" style={{color: 'hsl(var(--chart-4))'}} />Estoque por Estampa (Top 15)</CardTitle>
                <CardDescription>Distribuição de estoque pelas principais estampas (campo 'Descrição' do Excel).</CardDescription>
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
                <CardTitle className="flex items-center"><Cpu className="mr-2 h-5 w-5" style={{color: 'hsl(var(--chart-5))'}} />Estoque por Tipo de Produto (IA)</CardTitle>
                <CardDescription>Distribuição de estoque por tipo de produto identificado pela IA.</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                 {!isCategorizingProducts && aggregatedData.stockByAiProductType.length > 0 ? (
                   <ChartContainer config={stockByAiProductTypeChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                        <BarChart data={aggregatedData.stockByAiProductType} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                            <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                            <XAxis type="number" tickFormatter={(value) => value.toLocaleString()}/>
                            <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}}/>
                            <Tooltip content={<ChartTooltipContent />} />
                            <Legend />
                            <Bar dataKey="stock" name="Estoque" fill="hsl(var(--chart-5))" radius={[0, 4, 4, 0]} />
                        </BarChart>
                    </ResponsiveContainer>
                   </ChartContainer>
                ) : !isCategorizingProducts && aggregatedData.stockByAiProductType.length === 0 && productsWithAiTypes.length > 0 ? (
                     <p className="text-muted-foreground text-center pt-10">Não foi possível categorizar os produtos por IA ou não há dados.</p>
                ): isCategorizingProducts ? (
                     <div className="flex flex-col items-center justify-center h-full">
                        <Loader2 className="h-8 w-8 animate-spin text-primary" />
                        <p className="mt-2 text-muted-foreground">Analisando tipos de produto...</p>
                     </div>
                ) : (
                    <p className="text-muted-foreground text-center pt-10">Carregue dados para ver a análise por tipo de produto.</p>
                )
                }
              </CardContent>
            </Card>
          </div>

          <Card className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><TrendingDown className="mr-2 h-5 w-5 text-destructive" />SKUs Zerados por Descrição Linha Comercial</CardTitle>
              <CardDescription>Contagem de SKUs com estoque zero em cada descrição linha comercial.</CardDescription>
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
