
'use client';

import { useState, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  BarChartBig, ShoppingBag, AlertTriangle, FileSpreadsheet,
  Layers, TrendingDown, PackageCheck, ClipboardList, Palette, Box, Ruler,
  Download, Loader2, Activity, Percent
} from 'lucide-react';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import type { Product } from '@/types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';


interface AggregatedCollectionData {
  name: string;
  stock: number;
  skus: number;
}

interface AggregatedSizeData {
  name: string;
  stock: number;
}

interface AggregatedPrintData {
  name: string;
  stock: number;
}

interface AggregatedProductTypeData {
  name: string;
  stock: number;
}

interface ZeroStockData {
  name: string;
  count: number;
}

interface CollectionRuptureData {
  name: string;
  rupturePercentage: number;
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
  },
  rupturePercentage: {
    label: "Ruptura (%)",
    color: "hsl(var(--destructive))",
  }
} satisfies ChartConfig;

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];

export default function DashboardPage() {
  const [dashboardProducts, setDashboardProducts] = useState<Product[]>([]);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();

  const handleDashboardDataParsed = useCallback((data: Product[]) => {
    setDashboardProducts(data);
    // Removed diagnostic console.log for print data
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
        collectionRupturePercentage: [],
        totalStock: 0,
        totalSkus: 0,
        totalZeroStockSkus: 0,
        totalReadyToShipStock: 0,
        totalRegulatorStock: 0,
      };
    }

    const stockByCollectionMap = new Map<string, { stock: number; skus: number }>();
    const stockBySizeMap = new Map<string, { stock: number }>();
    const stockByPrintMap = new Map<string, { stock: number }>();
    const stockByProductTypeMap = new Map<string, { stock: number }>();
    const zeroStockSkusByCollectionMap = new Map<string, { count: number }>();

    let totalStock = 0;
    let totalSkus = dashboardProducts.length;
    let totalZeroStockSkus = 0;
    let totalReadyToShipStock = 0;
    let totalRegulatorStock = 0;

    dashboardProducts.forEach(product => {
      const collectionKey = product.collection || 'Não Especificada';
      const sizeKey = product.size || 'Não Especificado';
      const printKey = product.description || 'Não Especificada';
      const typeKey = product.productType || 'Não Especificado';

      const currentCol = stockByCollectionMap.get(collectionKey) || { stock: 0, skus: 0 };
      currentCol.stock += product.stock;
      currentCol.skus += 1;
      stockByCollectionMap.set(collectionKey, currentCol);

      const currentSize = stockBySizeMap.get(sizeKey) || { stock: 0 };
      currentSize.stock += product.stock;
      stockBySizeMap.set(sizeKey, currentSize);

      const currentPrint = stockByPrintMap.get(printKey) || { stock: 0 };
      currentPrint.stock += product.stock;
      stockByPrintMap.set(printKey, currentPrint);

      const currentType = stockByProductTypeMap.get(typeKey) || { stock: 0 };
      currentType.stock += product.stock;
      stockByProductTypeMap.set(typeKey, currentType);

      if (product.stock === 0) {
        const currentZeroCol = zeroStockSkusByCollectionMap.get(collectionKey) || { count: 0 };
        currentZeroCol.count += 1;
        zeroStockSkusByCollectionMap.set(collectionKey, currentZeroCol);
        totalZeroStockSkus++;
      }
      totalStock += product.stock;
      totalReadyToShipStock += product.readyToShip;
      totalRegulatorStock += product.regulatorStock;
    });
    
    const collectionRupturePercentageData: CollectionRuptureData[] = Array.from(stockByCollectionMap.entries()).map(([name, collData]) => {
      const zeroStockData = zeroStockSkusByCollectionMap.get(name);
      const zeroStockCount = zeroStockData ? zeroStockData.count : 0;
      const totalSkusInCollection = collData.skus;
      const rupturePercentage = totalSkusInCollection > 0 ? (zeroStockCount / totalSkusInCollection) * 100 : 0;
      return {
        name,
        rupturePercentage: parseFloat(rupturePercentage.toFixed(2)),
      };
    }).sort((a, b) => b.rupturePercentage - a.rupturePercentage);


    return {
      stockByCollection: Array.from(stockByCollectionMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock),
      stockBySize: Array.from(stockBySizeMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock),
      stockByPrint: Array.from(stockByPrintMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock).slice(0, 15),
      stockByProductType: Array.from(stockByProductTypeMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock),
      zeroStockSkusByCollection: Array.from(zeroStockSkusByCollectionMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.count - a.count),
      collectionRupturePercentage: collectionRupturePercentageData,
      totalStock,
      totalSkus,
      totalZeroStockSkus,
      totalReadyToShipStock,
      totalRegulatorStock,
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
  
  const collectionRuptureChartConfig = useMemo(() => {
    const config: ChartConfig = {
        rupturePercentage: {
            label: "Ruptura (%)",
            color: "hsl(var(--destructive))",
        },
    };
    aggregatedData.collectionRupturePercentage.forEach((item) => { // Removed index, not used
        config[item.name] = { 
            label: item.name,
            color: "hsl(var(--destructive))", 
        };
    });
    return config;
  }, [aggregatedData.collectionRupturePercentage]);


  const generateDashboardPdf = async () => {
    if (dashboardProducts.length === 0) {
      toast({ title: "Sem Dados", description: "Carregue dados antes de gerar o PDF.", variant: "destructive" });
      return;
    }

    setIsGeneratingPdf(true);
    toast({ title: "Gerando PDF...", description: "Por favor, aguarde." });

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      let yPos = 15;
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 10;
      const contentWidth = pageWidth - 2 * margin;

      doc.setFontSize(18);
      doc.text("Relatório do Dashboard de Performance", pageWidth / 2, yPos, { align: "center" });
      yPos += 10;

      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 10;

      doc.setFontSize(12);
      doc.text("Resumo Geral:", margin, yPos);
      yPos += 6;

      const summaryTableBody = [
        ["Estoque Total", aggregatedData.totalStock.toLocaleString()],
        ["Pronta Entrega", aggregatedData.totalReadyToShipStock.toLocaleString()],
        ["Regulador", aggregatedData.totalRegulatorStock.toLocaleString()],
        ["Total SKUs", aggregatedData.totalSkus.toLocaleString()],
        ["Total SKUs Zerados", aggregatedData.totalZeroStockSkus.toLocaleString()],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [["Métrica", "Valor"]],
        body: summaryTableBody,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 1.5 },
        headStyles: { fillColor: [63, 81, 181], textColor: 255, fontSize: 10 },
        margin: { left: margin, right: margin },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;

      const addChartToPdf = async (elementId: string, title: string) => {
        if (yPos > pageHeight - 50 && doc.getNumberOfPages() > 1) { // check only if not first page part
             doc.addPage();
             yPos = margin + 5;
        } else if (yPos > pageHeight - 50) { // if first page is full
            doc.addPage();
            yPos = margin + 5;
        }
        doc.setFontSize(13);
        doc.text(title, margin, yPos);
        yPos += 6;

        const chartElement = document.getElementById(elementId);
        if (chartElement) {
          try {
            const canvas = await html2canvas(chartElement, { scale: 1.5, useCORS: true, logging: false });
            const imgData = canvas.toDataURL('image/png', 0.9);
            const imgProps = doc.getImageProperties(imgData);
            let imgHeight = (imgProps.height * contentWidth) / imgProps.width;
            let imgWidth = contentWidth;

            const maxChartHeight = pageHeight * 0.4;
            if (imgHeight > maxChartHeight) {
                imgHeight = maxChartHeight;
                imgWidth = (imgProps.width * imgHeight) / imgProps.height;
            }

            if (yPos + imgHeight > pageHeight - margin) {
              doc.addPage();
              yPos = margin;
            }
            doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
            yPos += imgHeight + 7;
          } catch (error) {
            console.error(`Error capturing chart ${elementId}:`, error);
            doc.setTextColor(255,0,0);
            doc.text(`Erro ao renderizar o gráfico: ${title}`, margin, yPos);
            doc.setTextColor(0);
            yPos += 7;
          }
        } else {
          console.warn(`Chart element with ID ${elementId} not found.`);
          doc.setTextColor(200,0,0);
          doc.text(`Gráfico "${title}" não encontrado.`, margin, yPos);
          doc.setTextColor(0);
          yPos +=7;
        }
      };

      const chartIdsAndTitles = [
        { id: 'chart-stock-by-collection', title: 'Estoque por Descrição Linha Comercial' },
        { id: 'chart-stock-by-size', title: 'Estoque por Tamanho (Excel)' },
        { id: 'chart-stock-by-print', title: 'Estoque por Estampa (Top 15 - Coluna Descrição)' },
        { id: 'chart-stock-by-product-type', title: 'Estoque por Tipo de Produto (Coluna Tipo. Produto)' },
        { id: 'chart-zero-stock-skus', title: 'SKUs Zerados por Descrição Linha Comercial' },
        { id: 'chart-rupture-by-collection', title: 'Ruptura (%) por Descrição Linha Comercial' },
      ];

      for (const chartInfo of chartIdsAndTitles) {
        await addChartToPdf(chartInfo.id, chartInfo.title);
      }

      doc.save(`relatorio_dashboard_${new Date().toISOString().split('T')[0]}.pdf`);
      toast({ title: "PDF Gerado!", description: "O download do relatório foi iniciado." });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({ title: "Erro ao Gerar PDF", description: "Não foi possível gerar o relatório. Verifique o console.", variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard de Performance</h1>
          <p className="text-muted-foreground">Visão geral dos dados da sua coleção com base na coluna "Descrição Linha Comercial".</p>
        </div>
        <div className="flex gap-2">
          <Button onClick={generateDashboardPdf} disabled={isGeneratingPdf || dashboardProducts.length === 0}>
            {isGeneratingPdf ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Download className="mr-2 h-5 w-5" />
            )}
            Baixar Relatório PDF
          </Button>
        </div>
      </div>

      <ExcelUploadSection
        onDataParsed={handleDashboardDataParsed}
        onProcessingStart={handleProcessingStart}
        onProcessingEnd={handleProcessingEnd}
        collectionColumnKey="Descrição Linha Comercial"
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
                <CardTitle className="text-sm font-medium">Regulador</CardTitle>
                <Activity className="h-5 w-5 text-orange-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{aggregatedData.totalRegulatorStock.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">unidades no depósito Regulador</p>
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
            <Card id="chart-stock-by-collection" className="shadow-lg hover:shadow-xl transition-shadow">
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

            <Card id="chart-stock-by-size" className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center"><Ruler className="mr-2 h-5 w-5 text-accent" />Estoque por Tamanho (Excel)</CardTitle>
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
            <Card id="chart-stock-by-print" className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5" style={{color: 'hsl(var(--chart-4))'}} />Estoque por Estampa (Top 15 - Coluna Descrição)</CardTitle>
                <CardDescription>Distribuição de estoque pelas principais estampas (extraído da coluna H: 'Descrição' do Excel).</CardDescription>
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

            <Card id="chart-stock-by-product-type" className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center"><Box className="mr-2 h-5 w-5" style={{color: 'hsl(var(--chart-5))'}} />Estoque por Tipo de Produto (Coluna Tipo. Produto)</CardTitle>
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

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            <Card id="chart-zero-stock-skus" className="shadow-lg hover:shadow-xl transition-shadow">
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

            <Card id="chart-rupture-by-collection" className="shadow-lg hover:shadow-xl transition-shadow">
              <CardHeader>
                <CardTitle className="flex items-center"><Percent className="mr-2 h-5 w-5 text-destructive" />Ruptura (%) por Descrição Linha Comercial</CardTitle>
                <CardDescription>Porcentagem de SKUs com estoque zero em cada descrição linha comercial.</CardDescription>
              </CardHeader>
              <CardContent className="h-[400px]">
                {aggregatedData.collectionRupturePercentage.length > 0 ? (
                  <ChartContainer config={collectionRuptureChartConfig} className="h-full w-full">
                  <ResponsiveContainer width="100%" height="100%">
                      <BarChart data={aggregatedData.collectionRupturePercentage} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={80} tick={{fontSize: 12}}/>
                          <YAxis 
                            tickFormatter={(value) => `${value}%`} 
                            domain={[0, 'dataMax + 5']} 
                            allowDecimals={false}
                          />
                          <Tooltip 
                            content={<ChartTooltipContent />}
                            formatter={(value: number) => `${value.toFixed(2)}%`}
                          />
                          <Legend />
                          <Bar dataKey="rupturePercentage" name="Ruptura (%)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} />
                      </BarChart>
                  </ResponsiveContainer>
                  </ChartContainer>
                ) : <p className="text-muted-foreground text-center pt-10">Sem dados para análise de ruptura.</p>}
              </CardContent>
            </Card>
          </div>
        </>
      )}
    </div>
  );
}

