
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ShoppingBag, AlertTriangle, FileSpreadsheet,
  Layers, TrendingDown, PackageCheck, ClipboardList, Palette, Box, Ruler,
  Download, Loader2, Activity, Percent, Database, Filter, PieChartIcon, ListFilter
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import type { Product } from '@/types';
import { ResponsiveContainer, BarChart, Bar, XAxis, YAxis, Tooltip, Legend, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import html2canvas from 'html2canvas';
import autoTable from 'jspdf-autotable';
import { clientAuth, firestore } from '@/lib/firebase/config';
import type { User } from 'firebase/auth';
import { collection, getDocs, writeBatch, doc, Timestamp, query } from 'firebase/firestore';
import { Tooltip as ShadTooltip, TooltipContent as ShadTooltipContent, TooltipProvider as ShadTooltipProvider, TooltipTrigger as ShadTooltipTrigger } from "@/components/ui/tooltip";

interface AggregatedCollectionData {
  name: string;
  stock: number;
  skus: number;
}

interface AggregatedCategorySkuData {
  name: string;
  totalSkus: number;
  skusWithStock: number;
  skusWithoutStock: number;
}

interface AggregatedPrintData {
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

interface SkuStockStatusData {
  name: string;
  value: number;
}

const ALL_COLLECTIONS_VALUE = "_ALL_DASHBOARD_COLLECTIONS_";
const FIRESTORE_BATCH_LIMIT = 450;

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
  },
  skusWithStock: {
    label: "SKUs c/ Estoque",
    color: "hsl(var(--chart-2))",
  },
  skusWithoutStock: {
    label: "SKUs s/ Estoque",
    color: "hsl(var(--destructive))",
  }
} satisfies ChartConfig;

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const PIE_COLORS = ["hsl(var(--primary))", "hsl(var(--destructive))"]; 

const productToFirestore = (product: Product): any => {
  return {
    ...product,
    collectionStartDate: product.collectionStartDate ? Timestamp.fromDate(product.collectionStartDate) : null,
    collectionEndDate: product.collectionEndDate ? Timestamp.fromDate(product.collectionEndDate) : null,
  };
};

const productFromFirestore = (data: any): Product => {
  return {
    ...data,
    collectionStartDate: data.collectionStartDate ? (data.collectionStartDate as Timestamp).toDate() : null,
    collectionEndDate: data.collectionEndDate ? (data.collectionEndDate as Timestamp).toDate() : null,
  } as Product;
};


export default function DashboardPage() {
  const [dashboardProducts, setDashboardProducts] = useState<Product[]>([]);
  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();

  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);
  const [isSavingFirestore, setIsSavingFirestore] = useState(false);

  const [selectedCollection, setSelectedCollection] = useState<string>(ALL_COLLECTIONS_VALUE);
  // Removed vtexIdStatusFilterDashboard state


  useEffect(() => {
    const unsubscribe = clientAuth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (!user) {
        setDashboardProducts([]); 
        setIsLoadingFirestore(false); 
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser && dashboardProducts.length === 0 && !isSavingFirestore) { 
      console.log(`DashboardPage: Fetching products for user UID: ${currentUser.uid} because dashboardProducts is empty.`);
      setIsLoadingFirestore(true);
      const fetchProducts = async () => {
        try {
          const productsCol = collection(firestore, 'users', currentUser.uid, 'products');
          const snapshot = await getDocs(query(productsCol)); 
          const productsFromDb = snapshot.docs.map(doc => productFromFirestore(doc.data()));
          setDashboardProducts(productsFromDb);
          if (productsFromDb.length > 0) {
            toast({ title: "Dados Carregados", description: "Dados de produtos carregados do banco de dados." });
          }
        } catch (error) {
          console.error("Error fetching products from Firestore (Dashboard):", error);
          toast({ title: "Erro ao Carregar Dados", description: `Não foi possível buscar os produtos: ${(error as Error).message}`, variant: "destructive" });
        } finally {
          setIsLoadingFirestore(false);
        }
      };
      fetchProducts();
    } else if (currentUser && dashboardProducts.length > 0) {
      console.log(`DashboardPage: Products already loaded for user UID: ${currentUser.uid}. Skipping fetch.`);
      setIsLoadingFirestore(false); 
    } else if (!currentUser) {
      setIsLoadingFirestore(false);
    }
  }, [currentUser, toast, dashboardProducts.length, isSavingFirestore]);


  const saveProductsToFirestore = useCallback(async (productsToSave: Product[]) => {
    if (!currentUser) {
      toast({ title: "Usuário não autenticado", description: "Faça login para salvar os dados.", variant: "destructive" });
      return;
    }
    console.log(`DashboardPage: Saving products for user UID: ${currentUser.uid}`);
    setIsSavingFirestore(true);
    let totalDeleted = 0;
    let totalAdded = 0;

    try {
      const productsColRef = collection(firestore, 'users', currentUser.uid, 'products');
      
      const existingProductsQuery = query(productsColRef);
      const existingDocsSnapshot = await getDocs(existingProductsQuery);
      
      if (!existingDocsSnapshot.empty) {
        console.log(`DashboardPage: Deleting ${existingDocsSnapshot.docs.length} existing documents in chunks of ${FIRESTORE_BATCH_LIMIT}.`);
        for (let i = 0; i < existingDocsSnapshot.docs.length; i += FIRESTORE_BATCH_LIMIT) {
          const batch = writeBatch(firestore);
          const chunk = existingDocsSnapshot.docs.slice(i, i + FIRESTORE_BATCH_LIMIT);
          chunk.forEach(docSnapshot => {
            batch.delete(docSnapshot.ref);
            totalDeleted++;
          });
          await batch.commit();
          console.log(`DashboardPage: Committed a batch of ${chunk.length} deletions.`);
        }
        console.log(`DashboardPage: Successfully deleted ${totalDeleted} existing products.`);
      }

      if (productsToSave.length > 0) {
        console.log(`DashboardPage: Adding ${productsToSave.length} new products in chunks of ${FIRESTORE_BATCH_LIMIT}.`);
        for (let i = 0; i < productsToSave.length; i += FIRESTORE_BATCH_LIMIT) {
          const batch = writeBatch(firestore);
          const chunk = productsToSave.slice(i, i + FIRESTORE_BATCH_LIMIT);
          chunk.forEach(product => {
            const newDocRef = doc(productsColRef); 
            batch.set(newDocRef, productToFirestore(product));
            totalAdded++;
          });
          await batch.commit();
          console.log(`DashboardPage: Committed a batch of ${chunk.length} additions.`);
        }
        console.log(`DashboardPage: Successfully added ${totalAdded} new products.`);
      }
      
      setDashboardProducts(productsToSave); 
      toast({ title: "Dados Salvos!", description: `${totalAdded} produtos foram salvos. ${totalDeleted > 0 ? `${totalDeleted} produtos antigos foram removidos.` : ''}` });

    } catch (error) {
      console.error("Error saving products to Firestore (Dashboard):", error);
      toast({ title: "Erro ao Salvar", description: `Não foi possível salvar: ${(error as Error).message}`, variant: "destructive" });
    } finally {
      setIsSavingFirestore(false);
    }
  }, [currentUser, toast]);

  const handleExcelDataProcessed = useCallback(async (parsedProducts: Product[]) => {
    await saveProductsToFirestore(parsedProducts);
  }, [saveProductsToFirestore]); 


  const handleProcessingStart = () => setIsProcessingExcel(true);
  const handleProcessingEnd = () => setIsProcessingExcel(false);

  const availableDashboardCollections = useMemo(() => {
    const collections = new Set(dashboardProducts.map(p => p.collection).filter(Boolean).sort((a,b) => (a as string).localeCompare(b as string)));
    return Array.from(collections);
  }, [dashboardProducts]);

  const filteredProductsForDashboard = useMemo(() => {
    let products = dashboardProducts;
    if (selectedCollection !== ALL_COLLECTIONS_VALUE) {
      products = products.filter(p => p.collection === selectedCollection);
    }
    // Removed vtexIdStatusFilterDashboard logic
    return products;
  }, [dashboardProducts, selectedCollection]);

  const aggregatedData = useMemo(() => {
    if (filteredProductsForDashboard.length === 0) {
      return {
        stockByCollection: [],
        skusByProductType: [],
        skusBySize: [],
        stockByPrint: [],
        zeroStockSkusByCollection: [],
        collectionRupturePercentage: [],
        skuStockStatus: [],
        totalStock: 0,
        totalSkus: 0,
        totalZeroStockSkus: 0,
        totalReadyToShipStock: 0,
        totalRegulatorStock: 0,
        totalOpenOrders: 0, 
      };
    }

    const stockByCollectionMap = new Map<string, { stock: number; skus: number }>();
    const skusByProductTypeMap = new Map<string, { totalSkus: number; skusWithStock: number; skusWithoutStock: number }>();
    const skusBySizeMap = new Map<string, { totalSkus: number; skusWithStock: number; skusWithoutStock: number }>();
    const stockByPrintMap = new Map<string, { stock: number }>();
    const zeroStockSkusByCollectionMap = new Map<string, { count: number }>();

    let totalStock = 0;
    let totalSkus = filteredProductsForDashboard.length;
    let totalZeroStockSkus = 0;
    let totalReadyToShipStock = 0;
    let totalRegulatorStock = 0;
    let totalOpenOrders = 0; 

    filteredProductsForDashboard.forEach(product => {
      const collectionKey = product.collection || 'Não Especificada';
      const typeKey = product.productType || 'Não Especificado';
      const sizeKey = product.size || 'Não Especificado';
      const printKey = product.description || 'Não Especificada'; 

      const currentCol = stockByCollectionMap.get(collectionKey) || { stock: 0, skus: 0 };
      currentCol.stock += product.stock;
      currentCol.skus += 1;
      stockByCollectionMap.set(collectionKey, currentCol);
      
      const currentType = skusByProductTypeMap.get(typeKey) || { totalSkus: 0, skusWithStock: 0, skusWithoutStock: 0 };
      currentType.totalSkus += 1;
      if (product.stock > 0) currentType.skusWithStock += 1;
      else currentType.skusWithoutStock += 1;
      skusByProductTypeMap.set(typeKey, currentType);

      const currentSize = skusBySizeMap.get(sizeKey) || { totalSkus: 0, skusWithStock: 0, skusWithoutStock: 0 };
      currentSize.totalSkus += 1;
      if (product.stock > 0) currentSize.skusWithStock += 1;
      else currentSize.skusWithoutStock += 1;
      skusBySizeMap.set(sizeKey, currentSize);

      const currentPrint = stockByPrintMap.get(printKey) || { stock: 0 };
      currentPrint.stock += product.stock;
      stockByPrintMap.set(printKey, currentPrint);

      if (product.stock === 0) {
        const currentZeroCol = zeroStockSkusByCollectionMap.get(collectionKey) || { count: 0 };
        currentZeroCol.count += 1;
        zeroStockSkusByCollectionMap.set(collectionKey, currentZeroCol);
        totalZeroStockSkus++;
      }
      totalStock += product.stock;
      totalReadyToShipStock += product.readyToShip;
      totalRegulatorStock += product.regulatorStock;
      totalOpenOrders += product.openOrders; 
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

    const skuStockStatusData: SkuStockStatusData[] = [
      { name: 'SKUs com Estoque', value: totalSkus - totalZeroStockSkus },
      { name: 'SKUs Zerados', value: totalZeroStockSkus },
    ].filter(d => d.value > 0);


    return {
      stockByCollection: Array.from(stockByCollectionMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock),
      skusByProductType: Array.from(skusByProductTypeMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.totalSkus - a.totalSkus),
      skusBySize: Array.from(skusBySizeMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.totalSkus - a.totalSkus),
      stockByPrint: Array.from(stockByPrintMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock).slice(0, 15),
      zeroStockSkusByCollection: Array.from(zeroStockSkusByCollectionMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.count - a.count),
      collectionRupturePercentage: collectionRupturePercentageData,
      skuStockStatus: skuStockStatusData,
      totalStock,
      totalSkus,
      totalZeroStockSkus,
      totalReadyToShipStock,
      totalRegulatorStock,
      totalOpenOrders, 
    };
  }, [filteredProductsForDashboard]);

  const createChartConfig = (data: {name: string}[], useBaseColors: boolean = false) => {
    const config: ChartConfig = {...chartConfigBase}; 
    data.forEach((item, index) => {
      if (!config[item.name] && useBaseColors) { 
        config[item.name] = {
          label: item.name,
          color: COLORS[index % COLORS.length],
        };
      } else if (!config[item.name]) {
         config[item.name] = { label: item.name };
      }
    });
    return config;
  };

  const stockByCollectionChartConfig = useMemo(() => createChartConfig(aggregatedData.stockByCollection, true), [aggregatedData.stockByCollection]);
  const skusByProductTypeChartConfig = useMemo(() => createChartConfig(aggregatedData.skusByProductType), [aggregatedData.skusByProductType]);
  const skusBySizeChartConfig = useMemo(() => createChartConfig(aggregatedData.skusBySize), [aggregatedData.skusBySize]);
  const stockByPrintChartConfig = useMemo(() => createChartConfig(aggregatedData.stockByPrint, true), [aggregatedData.stockByPrint]);
  const zeroStockSkusChartConfig = useMemo(() => createChartConfig(aggregatedData.zeroStockSkusByCollection, true), [aggregatedData.zeroStockSkusByCollection]);
  
  const collectionRuptureChartConfig = useMemo(() => {
    const config: ChartConfig = {
        rupturePercentage: {
            label: "Ruptura (%)",
            color: "hsl(var(--destructive))",
        },
    };
    aggregatedData.collectionRupturePercentage.forEach((item) => {
        if (!config[item.name]) { 
          config[item.name] = { 
              label: item.name,
          };
        }
    });
    return config;
  }, [aggregatedData.collectionRupturePercentage]);

  const skuStockStatusChartConfig = useMemo(() => {
    const config: ChartConfig = {};
    aggregatedData.skuStockStatus.forEach((item, index) => {
      config[item.name] = {
        label: item.name,
        color: PIE_COLORS[index % PIE_COLORS.length],
      };
    });
    return config;
  }, [aggregatedData.skuStockStatus]);


  const generateDashboardPdf = async () => {
    if (filteredProductsForDashboard.length === 0) {
      toast({ title: "Sem Dados", description: "Carregue dados e selecione filtros antes de gerar o PDF.", variant: "destructive" });
      return;
    }

    setIsGeneratingPdf(true);
    toast({ title: "Gerando PDF...", description: "Por favor, aguarde. Isso pode levar alguns instantes." });

    try {
      const doc = new jsPDF('p', 'mm', 'a4');
      let yPos = 15;
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 10;
      const contentWidth = pageWidth - 2 * margin;

      let reportTitle = "Relatório do Dashboard de Performance";
      let appliedFiltersText = [];
      if(selectedCollection !== ALL_COLLECTIONS_VALUE) {
        appliedFiltersText.push(`Coleção: ${selectedCollection}`);
      }
      // Removed vtexIdStatusFilter from PDF title
      
      doc.setFontSize(18);
      doc.text(reportTitle, pageWidth / 2, yPos, { align: "center" });
      yPos += 10;

      if (appliedFiltersText.length > 0) {
        doc.setFontSize(10);
        doc.text("Filtros Aplicados: " + appliedFiltersText.join(' | '), pageWidth / 2, yPos, { align: "center" });
        yPos += 7;
      }

      doc.setFontSize(10);
      doc.text(`Gerado em: ${new Date().toLocaleDateString('pt-BR')} ${new Date().toLocaleTimeString('pt-BR')}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 10;

      doc.setFontSize(12);
      doc.text("Resumo Geral dos Indicadores:", margin, yPos);
      yPos += 7;

      const summaryTableBody = [
        ["Estoque Total", aggregatedData.totalStock.toLocaleString()],
        ["Pronta Entrega", aggregatedData.totalReadyToShipStock.toLocaleString()],
        ["Regulador", aggregatedData.totalRegulatorStock.toLocaleString()],
        ["Pedidos em Aberto", aggregatedData.totalOpenOrders.toLocaleString()], 
        ["Total SKUs", aggregatedData.totalSkus.toLocaleString()],
        ["Total SKUs Zerados", aggregatedData.totalZeroStockSkus.toLocaleString()],
      ];

      autoTable(doc, {
        startY: yPos,
        head: [["Métrica", "Valor"]],
        body: summaryTableBody,
        theme: 'grid',
        styles: { fontSize: 9, cellPadding: 1.5, halign: 'left' },
        headStyles: { fillColor: [63, 81, 181], textColor: 255, fontSize: 10, fontStyle: 'bold', halign: 'center' },
        columnStyles: { 0: { fontStyle: 'bold' }, 1: { halign: 'right' }},
        margin: { left: margin, right: margin },
      });
      yPos = (doc as any).lastAutoTable.finalY + 10;

      const addChartToPdf = async (elementId: string, chartTitle: string) => {
        const chartElement = document.getElementById(elementId);
        if (!chartElement || chartElement.offsetParent === null) {
          console.warn(`Elemento do gráfico ${elementId} não encontrado ou não visível. Pulando no PDF.`);
          doc.setTextColor(150, 150, 150);
          doc.setFontSize(10);
          doc.text(`Gráfico "${chartTitle}" não disponível ou sem dados.`, margin, yPos);
          doc.setTextColor(0);
          yPos += 8;
          return;
        }
        
        if (yPos + 10 > pageHeight - margin) { 
             doc.addPage();
             yPos = margin;
        }
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(chartTitle, margin, yPos);
        doc.setFont('helvetica', 'normal');
        yPos += 8;


        try {
          const canvas = await html2canvas(chartElement, { 
            scale: 1.5, 
            useCORS: true, 
            logging: false,
            backgroundColor: '#ffffff' 
          });
          const imgData = canvas.toDataURL('image/png', 0.95); 
          
          const imgProps = doc.getImageProperties(imgData);
          let imgHeight = (imgProps.height * contentWidth) / imgProps.width;
          let imgWidth = contentWidth;

          const maxChartHeight = pageHeight * 0.45; 
          if (imgHeight > maxChartHeight) {
              imgHeight = maxChartHeight;
              imgWidth = (imgProps.width * imgHeight) / imgProps.height;
          }

          if (yPos + imgHeight > pageHeight - margin) {
            doc.addPage();
            yPos = margin;
            doc.setFontSize(13);
            doc.setFont('helvetica', 'bold');
            doc.text(chartTitle, margin, yPos);
            doc.setFont('helvetica', 'normal');
            yPos += 8;
          }
          doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 10; 
        } catch (error) {
          console.error(`Erro ao capturar gráfico ${elementId}:`, error);
          doc.setTextColor(255,0,0);
          doc.setFontSize(10);
          doc.text(`Erro ao renderizar o gráfico: ${chartTitle}. Verifique o console.`, margin, yPos);
          doc.setTextColor(0);
          yPos += 8;
        }
      };

      const chartSections = [
        { id: 'chart-stock-by-collection', title: 'Estoque por Descrição Linha Comercial', data: aggregatedData.stockByCollection },
        { id: 'chart-sku-stock-status', title: 'Distribuição de SKUs (Estoque vs. Zerado)', data: aggregatedData.skuStockStatus },
        { id: 'chart-rupture-by-collection', title: 'Ruptura (%) por Descrição Linha Comercial', data: aggregatedData.collectionRupturePercentage },
        { id: 'chart-skus-by-size', title: 'SKUs por Tamanho (Excel)', data: aggregatedData.skusBySize },
        { id: 'chart-stock-by-print', title: 'Estoque por Estampa (Top 15 - Coluna Descrição)', data: aggregatedData.stockByPrint },
        { id: 'chart-skus-by-product-type', title: 'SKUs por Tipo de Produto (Coluna Tipo. Produto)', data: aggregatedData.skusByProductType },
        { id: 'chart-zero-stock-skus', title: 'SKUs Zerados por Descrição Linha Comercial', data: aggregatedData.zeroStockSkusByCollection },
      ];

      for (const chartInfo of chartSections) {
         if (chartInfo.data && chartInfo.data.length > 0) { 
            await addChartToPdf(chartInfo.id, chartInfo.title);
         } else {
            if (yPos + 10 > pageHeight - margin) { doc.addPage(); yPos = margin; }
            doc.setFontSize(11);
            doc.setTextColor(100);
            doc.text(`Gráfico "${chartInfo.title}" não possui dados para exibir com os filtros atuais.`, margin, yPos);
            doc.setTextColor(0);
            yPos += 10;
         }
      }
      
      let pdfFileName = `Relatorio_Dashboard_${new Date().toISOString().split('T')[0]}`;
      if (selectedCollection !== ALL_COLLECTIONS_VALUE) {
        pdfFileName += `_${selectedCollection.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      // Removed vtexIdStatusFilter from PDF file name
      pdfFileName += '.pdf';

      doc.save(pdfFileName);
      toast({ title: "PDF Gerado!", description: "O download do relatório foi iniciado." });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      toast({ title: "Erro ao Gerar PDF", description: `Não foi possível gerar o relatório: ${(error as Error).message}. Verifique o console.`, variant: "destructive" });
    } finally {
      setIsGeneratingPdf(false);
    }
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, index, name, value }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const percentage = (percent * 100).toFixed(0);

    if (percentage === "0") return null; 

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12px" fontWeight="bold">
        {`${percentage}%`}
      </text>
    );
  };


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard de Performance</h1>
          <p className="text-muted-foreground">Visão geral dos dados da sua coleção com base na coluna "Descrição Linha Comercial".</p>
        </div>
        <Button onClick={generateDashboardPdf} disabled={isGeneratingPdf || isSavingFirestore || isLoadingFirestore || filteredProductsForDashboard.length === 0}>
            {isGeneratingPdf ? (
              <Loader2 className="mr-2 h-5 w-5 animate-spin" />
            ) : (
              <Download className="mr-2 h-5 w-5" />
            )}
            Baixar Relatório PDF
        </Button>
      </div>

       {dashboardProducts.length > 0 && (
        <Card className="shadow-md border-primary/30 border-l-4">
          <CardHeader>
            <CardTitle className="flex items-center"><ListFilter className="mr-2 h-5 w-5 text-primary" />Filtros do Dashboard</CardTitle>
          </CardHeader>
          <CardContent className="grid grid-cols-1 md:grid-cols-1 gap-4"> {/* Changed to md:grid-cols-1 */}
            <div>
              <Label htmlFor="collectionFilterDashboard">Filtrar por Coleção (Desc. Linha Comercial)</Label>
              <Select
                value={selectedCollection}
                onValueChange={setSelectedCollection}
                disabled={isLoadingFirestore || isSavingFirestore || isGeneratingPdf}
              >
                <SelectTrigger id="collectionFilterDashboard" aria-label="Filtrar por Coleção">
                  <SelectValue placeholder="Filtrar por Coleção" />
                </SelectTrigger>
                <SelectContent>
                  <SelectItem value={ALL_COLLECTIONS_VALUE}>Todas as Coleções</SelectItem>
                  {availableDashboardCollections.map(collection => (
                    <SelectItem key={collection as string} value={collection as string}>{collection as string}</SelectItem>
                  ))}
                </SelectContent>
              </Select>
            </div>
            {/* Removed vtexIdStatusFilterDashboard Select */}
          </CardContent>
        </Card>
      )}


      <ExcelUploadSection
        onDataParsed={handleExcelDataProcessed}
        onProcessingStart={handleProcessingStart}
        onProcessingEnd={handleProcessingEnd}
        collectionColumnKey="Descrição Linha Comercial"
        cardTitle="Upload de Dados para Dashboard"
        cardDescription="Carregue o arquivo Excel. Os dados serão salvos no seu perfil e usados para os gráficos abaixo."
        isProcessingParent={isSavingFirestore}
      />

      {(isLoadingFirestore || isSavingFirestore) && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center">
              <Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" /> 
              {isSavingFirestore ? "Salvando dados..." : "Carregando dados..."}
            </CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Por favor, aguarde.</p>
          </CardContent>
        </Card>
      )}

      {!isLoadingFirestore && !isSavingFirestore &&
      dashboardProducts.length === 0 && !isProcessingExcel && (
        <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Database className="mr-2 h-6 w-6 text-primary" />Sem dados para exibir</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Por favor, carregue um arquivo Excel para popular o dashboard. Os dados serão salvos e carregados automaticamente nas próximas visitas.</p>
          </CardContent>
        </Card>
      )}
      
      {!isLoadingFirestore && !isSavingFirestore && dashboardProducts.length > 0 && filteredProductsForDashboard.length === 0 && selectedCollection !== ALL_COLLECTIONS_VALUE && (
         <Card className="shadow-lg">
          <CardHeader>
            <CardTitle className="flex items-center"><Filter className="mr-2 h-6 w-6 text-primary" />Nenhum produto encontrado</CardTitle>
          </CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Nenhum produto encontrado para a coleção selecionada: <span className="font-semibold">{selectedCollection}</span>.
              Por favor, ajuste o filtro ou selecione "Todas as Coleções".
            </p>
          </CardContent>
        </Card>
      )}


      {!isLoadingFirestore && !isSavingFirestore && filteredProductsForDashboard.length > 0 && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6"> 
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
                <CardTitle className="text-sm font-medium">Pedidos em Aberto</CardTitle>
                <ClipboardList className="h-5 w-5 text-blue-500" />
              </CardHeader>
              <CardContent>
                <div className="text-2xl font-bold text-foreground">{aggregatedData.totalOpenOrders.toLocaleString()}</div>
                <p className="text-xs text-muted-foreground">unidades com pedido em aberto</p>
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
            {aggregatedData.stockByCollection.length > 0 && (
              <Card id="chart-stock-by-collection" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center"><ShoppingBag className="mr-2 h-5 w-5 text-primary" />Estoque por Descrição Linha Comercial</CardTitle>
                  <CardDescription>Distribuição de estoque e SKUs pela coluna "Descrição Linha Comercial" do Excel.</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
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
                </CardContent>
              </Card>
            )}

            {aggregatedData.skuStockStatus.length > 0 && aggregatedData.totalSkus > 0 && (
              <Card id="chart-sku-stock-status" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center"><PieChartIcon className="mr-2 h-5 w-5 text-primary" />Distribuição de SKUs (Estoque vs. Zerado)</CardTitle>
                  <CardDescription>Proporção de SKUs com estoque e SKUs com estoque zerado.</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                   <ChartContainer config={skuStockStatusChartConfig} className="h-full w-full">
                    <ResponsiveContainer width="100%" height="100%">
                      <PieChart>
                        <Tooltip content={<ChartTooltipContent nameKey="name" />} />
                        <Pie
                          data={aggregatedData.skuStockStatus}
                          dataKey="value"
                          nameKey="name"
                          cx="50%"
                          cy="50%"
                          outerRadius={120}
                          labelLine={false}
                          label={renderCustomizedLabel}
                        >
                          {aggregatedData.skuStockStatus.map((entry, index) => (
                            <Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />
                          ))}
                        </Pie>
                        <Legend />
                      </PieChart>
                    </ResponsiveContainer>
                  </ChartContainer>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {aggregatedData.collectionRupturePercentage.length > 0 && (
              <Card id="chart-rupture-by-collection" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center"><Percent className="mr-2 h-5 w-5 text-destructive" />Ruptura (%) por Descrição Linha Comercial</CardTitle>
                  <CardDescription>Porcentagem de SKUs com estoque zero em cada descrição linha comercial.</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
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
                </CardContent>
              </Card>
            )}

            {aggregatedData.skusBySize.length > 0 && (
              <Card id="chart-skus-by-size" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center"><Ruler className="mr-2 h-5 w-5 text-accent" />SKUs por Tamanho (Excel)</CardTitle>
                  <CardDescription>Distribuição de SKUs (com e sem estoque) por tamanho (coluna "Tamanho" do Excel).</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ChartContainer config={skusBySizeChartConfig} className="h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={aggregatedData.skusBySize} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                              <XAxis type="number" tickFormatter={(value) => value.toLocaleString()}/>
                              <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}}/>
                              <Tooltip content={<ChartTooltipContent />} />
                              <Legend />
                              <Bar dataKey="skusWithStock" name="SKUs c/ Estoque" fill="hsl(var(--chart-2))" stackId="size" radius={[0, 4, 4, 0]} />
                              <Bar dataKey="skusWithoutStock" name="SKUs s/ Estoque" fill="hsl(var(--destructive))" stackId="size" radius={[0, 4, 4, 0]}/>
                          </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
              </Card>
            )}
          </div>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {aggregatedData.stockByPrint.length > 0 && (
              <Card id="chart-stock-by-print" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5" style={{color: 'hsl(var(--chart-4))'}} />Estoque por Estampa (Top 15 - Coluna Descrição)</CardTitle>
                  <CardDescription>Distribuição de estoque pelas principais estampas (extraído da coluna H: 'Descrição' do Excel).</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
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
                </CardContent>
              </Card>
            )}

            {aggregatedData.skusByProductType.length > 0 && (
              <Card id="chart-skus-by-product-type" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                  <CardTitle className="flex items-center"><Box className="mr-2 h-5 w-5" style={{color: 'hsl(var(--chart-5))'}} />SKUs por Tipo de Produto (Coluna Tipo. Produto)</CardTitle>
                  <CardDescription>Distribuição de SKUs (com e sem estoque) por tipo (coluna "Tipo. Produto" do Excel).</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
                  <ChartContainer config={skusByProductTypeChartConfig} className="h-full w-full">
                      <ResponsiveContainer width="100%" height="100%">
                          <BarChart data={aggregatedData.skusByProductType} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}>
                              <CartesianGrid strokeDasharray="3 3" horizontal={false}/>
                              <XAxis type="number" tickFormatter={(value) => value.toLocaleString()}/>
                              <YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}}/>
                              <Tooltip content={<ChartTooltipContent />} />
                              <Legend />
                              <Bar dataKey="skusWithStock" name="SKUs c/ Estoque" fill="hsl(var(--chart-2))" stackId="type" radius={[0, 4, 4, 0]} />
                              <Bar dataKey="skusWithoutStock" name="SKUs s/ Estoque" fill="hsl(var(--destructive))" stackId="type" radius={[0, 4, 4, 0]}/>
                          </BarChart>
                      </ResponsiveContainer>
                    </ChartContainer>
                </CardContent>
              </Card>
            )}
          </div>

          {aggregatedData.zeroStockSkusByCollection.length > 0 && (
            <Card id="chart-zero-stock-skus" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader>
                <CardTitle className="flex items-center"><TrendingDown className="mr-2 h-5 w-5 text-destructive" />SKUs Zerados por Descrição Linha Comercial</CardTitle>
                <CardDescription>Contagem de SKUs com estoque zero em cada descrição linha comercial (coluna "Descrição Linha Comercial" do Excel).</CardDescription>
                </CardHeader>
                <CardContent className="h-[400px]">
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
                </CardContent>
            </Card>
            )}
        </>
      )}
    </div>
  );
}
