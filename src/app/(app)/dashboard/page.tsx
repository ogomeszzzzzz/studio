
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import {
  ShoppingBag, AlertTriangle, FileSpreadsheet,
  Layers, TrendingDown, PackageCheck, ClipboardList, Palette, Box, Ruler,
  Download, Loader2, Activity, Percent, Database, Filter, PieChartIcon as PieChartLucide, ListFilter, Clock, BarChartHorizontal, SearchIcon, LineChart
} from 'lucide-react';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection';
import type { Product, StockHistoryEntry } from '@/types';
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip, Legend as RechartsLegend, CartesianGrid, PieChart, Pie, Cell, LineChart as RechartsLineChart, Line as RechartsLineElement } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import { useToast } from '@/hooks/use-toast';
import jsPDF from 'jspdf';
import 'jspdf-autotable';
import type { jsPDFDocumentProperties } from 'jspdf'; // For type safety with autoTable
import html2canvas from 'html2canvas';
import { firestore, firestoreClientInitializationError } from '@/lib/firebase/config';
import { collection, getDocs, writeBatch, doc, Timestamp, query, setDoc, getDoc, serverTimestamp, orderBy, addDoc, deleteDoc, collectionGroup } from 'firebase/firestore';
import { format as formatDateFns, isValid as isDateValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { useAuth } from '@/contexts/AuthContext';
import { useProducts } from '@/contexts/ProductsContext'; // Import useProducts

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

interface CollectionSkuStatusData {
  name: string;
  activeSkus: number;
  zeroStockSkus: number;
}

const ALL_COLLECTIONS_VALUE = "_ALL_DASHBOARD_COLLECTIONS_";
const FIRESTORE_BATCH_LIMIT = 450; // Firestore batch limit

const chartConfigBase = {
  stock: { label: "Estoque", },
  skus: { label: "SKUs", },
  count: { label: "Contagem", },
  rupturePercentage: { label: "Ruptura (%)", color: "hsl(var(--destructive))", },
  skusWithStock: { label: "SKUs c/ Estoque", color: "hsl(var(--chart-2))", },
  skusWithoutStock: { label: "SKUs s/ Estoque", color: "hsl(var(--destructive))", },
  activeSkus: { label: "SKUs Ativos", color: "hsl(var(--chart-1))", },
  zeroStockSkus: { label: "SKUs Zerados", color: "hsl(var(--destructive))", },
  totalStockUnits: { label: "Unidades Totais", color: "hsl(var(--chart-1))" },
  totalSkusWithStock: { label: "SKUs c/ Estoque", color: "hsl(var(--chart-2))" },
} satisfies ChartConfig;

const COLORS = ["hsl(var(--chart-1))", "hsl(var(--chart-2))", "hsl(var(--chart-3))", "hsl(var(--chart-4))", "hsl(var(--chart-5))"];
const PIE_COLORS = ["hsl(var(--chart-2))", "hsl(var(--destructive))"]; // Green for with stock, Red for zero stock

const productToFirestore = (product: Product): any => {
  const data: any = { ...product };
  if (product.collectionStartDate && isDateValid(product.collectionStartDate)) {
    data.collectionStartDate = Timestamp.fromDate(product.collectionStartDate);
  } else {
    data.collectionStartDate = null;
  }
  if (product.collectionEndDate && isDateValid(product.collectionEndDate)) {
    data.collectionEndDate = Timestamp.fromDate(product.collectionEndDate);
  } else {
    data.collectionEndDate = null;
  }
  return data;
};

// productFromFirestore is no longer needed here as data comes from context

const stockHistoryEntryFromFirestore = (id: string, data: any): StockHistoryEntry => {
  return {
    id,
    date: data.date instanceof Timestamp ? data.date.toDate() : new Date(),
    totalStockUnits: data.totalStockUnits || 0,
    totalSkusWithStock: data.totalSkusWithStock || 0,
  };
};


export default function DashboardPage() {
  // Use products and metadata from ProductsContext
  const { products: dashboardProducts, 
          lastDataUpdateTimestamp, 
          isLoadingProducts: isLoadingFirestore, // Rename for clarity in this component
          productsError, 
          refetchProducts 
        } = useProducts();

  const [isProcessingExcel, setIsProcessingExcel] = useState(false);
  const [isGeneratingPdf, setIsGeneratingPdf] = useState(false);
  const { toast } = useToast();

  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const [isSavingFirestore, setIsSavingFirestore] = useState(false);
  
  const [selectedCollection, setSelectedCollection] = useState<string>(ALL_COLLECTIONS_VALUE);
  
  const [stockHistory, setStockHistory] = useState<StockHistoryEntry[]>([]);
  const [isLoadingHistory, setIsLoadingHistory] = useState(true);


  const isAdmin = useMemo(() => currentUser?.email.toLowerCase() === (process.env.NEXT_PUBLIC_ADMIN_EMAIL || "gustavo.cordeiro@altenburg.com.br").toLowerCase() && currentUser?.isAdmin, [currentUser]);

 const fetchHistory = useCallback(async () => {
    if (!currentUser || !firestore || firestoreClientInitializationError) {
      setIsLoadingHistory(false);
      if (!currentUser || !firestore) setStockHistory([]);
      return;
    }
    setIsLoadingHistory(true);
    try {
      const historyQuery = query(collection(firestore, "stock_history"), orderBy("date", "asc"));
      const historySnapshot = await getDocs(historyQuery);
      const historyFromDb: StockHistoryEntry[] = historySnapshot.docs.map(docSnap => stockHistoryEntryFromFirestore(docSnap.id, docSnap.data()));
      setStockHistory(historyFromDb);
    } catch (error) {
      const fullError = error instanceof Error ? error : new Error(String(error));
      toast({ title: "Erro ao Carregar Histórico", description: `Não foi possível buscar o histórico de estoque: ${fullError.message}.`, variant: "destructive" });
      setStockHistory([]);
    } finally {
      setIsLoadingHistory(false);
    }
  }, [currentUser, toast]);

  useEffect(() => {
    if (isAuthLoading) return;

    if (firestoreClientInitializationError || !firestore) {
      // Error already handled by ProductsContext or global error display
      setIsLoadingHistory(false);
      return;
    }
    if (productsError) {
        // If product context has error, don't attempt history fetch
        setIsLoadingHistory(false);
        return;
    }

    if (currentUser) {
      const fetchNeeded = 
          stockHistory.length === 0 || 
          (lastDataUpdateTimestamp && stockHistory.length > 0 && stockHistory[stockHistory.length-1]?.date && lastDataUpdateTimestamp > stockHistory[stockHistory.length-1].date);

      if (!isSavingFirestore && fetchNeeded && !isLoadingFirestore) {
        fetchHistory();
      } else if (!isSavingFirestore && !isLoadingFirestore) {
        setIsLoadingHistory(false);
      }
    } else {
      setStockHistory([]);
      setIsLoadingHistory(false);
    }
  }, [currentUser, isAuthLoading, isAdmin, toast, isSavingFirestore, lastDataUpdateTimestamp, stockHistory.length, fetchHistory, productsError, isLoadingFirestore]);


  const saveProductsToFirestore = useCallback(async (productsToSave: Product[]) => {
    if (!currentUser || !isAdmin) {
      toast({ title: "Acesso Negado", description: "Apenas administradores podem salvar dados.", variant: "destructive" });
      return;
    }
    if (!firestore) {
      toast({ title: "Erro de Configuração", description: "Instância do Firestore não está disponível para salvar.", variant: "destructive" });
      return;
    }
    setIsSavingFirestore(true);
    setIsLoadingHistory(true);

    let totalDeleted = 0;
    let totalAdded = 0;

    try {
      const productsColPath = "shared_products";
      const productsColRef = collection(firestore, productsColPath);
      
      const existingDocsSnapshot = await getDocs(query(productsColRef));
      const docsToDelete = existingDocsSnapshot.docs;

      for (let i = 0; i < docsToDelete.length; i += FIRESTORE_BATCH_LIMIT) {
        const batch = writeBatch(firestore);
        const chunk = docsToDelete.slice(i, i + FIRESTORE_BATCH_LIMIT);
        chunk.forEach(docSnapshot => batch.delete(docSnapshot.ref));
        await batch.commit();
        totalDeleted += chunk.length;
      }

      if (productsToSave.length > 0) {
        for (let i = 0; i < productsToSave.length; i += FIRESTORE_BATCH_LIMIT) {
          const batch = writeBatch(firestore);
          const chunk = productsToSave.slice(i, i + FIRESTORE_BATCH_LIMIT);
          chunk.forEach(product => {
            const newDocRef = doc(productsColRef); 
            batch.set(newDocRef, productToFirestore(product));
          });
          await batch.commit();
          totalAdded += chunk.length;
        }
      }

      if (productsToSave.length > 0) {
        const currentTotalStockUnits = productsToSave.reduce((sum, p) => sum + (p.stock || 0), 0);
        const currentTotalSkusWithStock = productsToSave.filter(p => (p.stock || 0) > 0).length;
        await addDoc(collection(firestore, "stock_history"), {
          date: serverTimestamp(),
          totalStockUnits: currentTotalStockUnits,
          totalSkusWithStock: currentTotalSkusWithStock,
        });
      }

      const metadataDocRef = doc(firestore, "app_metadata", "products_metadata");
      await setDoc(metadataDocRef, { lastUpdatedAt: serverTimestamp() }, { merge: true });
      
      await refetchProducts(); // Refetch products in context
      setStockHistory([]); // Clear local history to trigger refetch

      toast({ title: "Dados Globais Salvos!", description: `${totalAdded} produtos foram salvos. ${totalDeleted > 0 ? `${totalDeleted} antigos foram removidos.` : ''} Histórico de estoque atualizado.` });

    } catch (error) {
      const firestoreError = error as Error;
      toast({ title: "Erro ao Salvar", description: `Não foi possível salvar: ${firestoreError.message}`, variant: "destructive" });
    } finally {
      setIsSavingFirestore(false);
      // isLoadingHistory will be handled by the main useEffect reacting to lastDataUpdateTimestamp
    }
  }, [currentUser, isAdmin, toast, refetchProducts]); 

  const handleExcelDataProcessed = useCallback(async (parsedProducts: Product[]) => {
    await saveProductsToFirestore(parsedProducts);
  }, [saveProductsToFirestore]);

  const handleProcessingStart = () => {
    setIsProcessingExcel(true);
  };
  const handleProcessingEnd = () => {
    setIsProcessingExcel(false);
  };

  const availableDashboardCollections = useMemo(() => {
    const collections = new Set(dashboardProducts.map(p => p.collection).filter(Boolean).sort((a,b) => (a as string).localeCompare(b as string)));
    return Array.from(collections);
  }, [dashboardProducts]);

  const filteredProductsForDashboard = useMemo(() => {
    let products = dashboardProducts;
    if (selectedCollection !== ALL_COLLECTIONS_VALUE) {
      products = products.filter(p => p.collection === selectedCollection);
    }
    return products;
  }, [dashboardProducts, selectedCollection]);

  const aggregatedData = useMemo(() => {
    if (filteredProductsForDashboard.length === 0) {
      return {
        stockByCollection: [],
        skusByProductType: [],
        skusBySize: [],
        stockByPrint: [],
        collectionRupturePercentage: [],
        skuStockStatus: [],
        collectionSkuStatus: [],
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
    const collectionSkuMap = new Map<string, { activeSkus: number; zeroStockSkus: number; totalSkusInCollection: number }>();


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
      currentCol.stock += (product.stock || 0);
      currentCol.skus += 1;
      stockByCollectionMap.set(collectionKey, currentCol);

      const currentType = skusByProductTypeMap.get(typeKey) || { totalSkus: 0, skusWithStock: 0, skusWithoutStock: 0 };
      currentType.totalSkus += 1;
      if ((product.stock || 0) > 0) currentType.skusWithStock += 1;
      else currentType.skusWithoutStock += 1;
      skusByProductTypeMap.set(typeKey, currentType);

      const currentSize = skusBySizeMap.get(sizeKey) || { totalSkus: 0, skusWithStock: 0, skusWithoutStock: 0 };
      currentSize.totalSkus += 1;
      if ((product.stock || 0) > 0) currentSize.skusWithStock += 1;
      else currentSize.skusWithoutStock += 1;
      skusBySizeMap.set(sizeKey, currentSize);

      const currentPrint = stockByPrintMap.get(printKey) || { stock: 0 };
      currentPrint.stock += (product.stock || 0);
      stockByPrintMap.set(printKey, currentPrint);

      const currentCollectionSkuData = collectionSkuMap.get(collectionKey) || { activeSkus: 0, zeroStockSkus: 0, totalSkusInCollection: 0 };
      currentCollectionSkuData.totalSkusInCollection +=1;
      if ((product.stock || 0) > 0) {
        currentCollectionSkuData.activeSkus += 1;
      } else {
        currentCollectionSkuData.zeroStockSkus += 1;
      }
      collectionSkuMap.set(collectionKey, currentCollectionSkuData);
      
      if((product.stock || 0) === 0) totalZeroStockSkus++;
      totalStock += (product.stock || 0);
      totalReadyToShipStock += product.readyToShip || 0;
      totalRegulatorStock += product.regulatorStock || 0;
      totalOpenOrders += product.openOrders || 0;
    });
    
    const collectionSkuStatusData: CollectionSkuStatusData[] = Array.from(collectionSkuMap.entries()).map(([name, data]) => ({
        name,
        activeSkus: data.activeSkus,
        zeroStockSkus: data.zeroStockSkus,
    })).sort((a,b) => (b.activeSkus + b.zeroStockSkus) - (a.activeSkus + a.zeroStockSkus));

    const collectionRupturePercentageData = Array.from(collectionSkuMap.entries()).map(([name, data]) => {
        const rupturePercentage = data.totalSkusInCollection > 0 ? (data.zeroStockSkus / data.totalSkusInCollection) * 100 : 0;
        return { name, rupturePercentage: parseFloat(rupturePercentage.toFixed(2)), };
    }).sort((a, b) => b.rupturePercentage - a.rupturePercentage);

    const skuStockStatusData = [
      { name: 'SKUs com Estoque', value: totalSkus - totalZeroStockSkus },
      { name: 'SKUs Zerados', value: totalZeroStockSkus },
    ].filter(d => d.value > 0);

    return {
      stockByCollection: Array.from(stockByCollectionMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock),
      skusByProductType: Array.from(skusByProductTypeMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.totalSkus - a.totalSkus),
      skusBySize: Array.from(skusBySizeMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.totalSkus - a.totalSkus),
      stockByPrint: Array.from(stockByPrintMap.entries()).map(([name, data]) => ({ name, ...data })).sort((a,b) => b.stock - a.stock).slice(0, 15),
      collectionRupturePercentage: collectionRupturePercentageData,
      skuStockStatus: skuStockStatusData,
      collectionSkuStatus: collectionSkuStatusData,
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
        config[item.name] = { label: item.name, color: COLORS[index % COLORS.length], };
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
  const collectionSkuStatusChartConfig = useMemo(() => createChartConfig(aggregatedData.collectionSkuStatus), [aggregatedData.collectionSkuStatus]);
  const collectionRuptureChartConfig = useMemo(() => createChartConfig(aggregatedData.collectionRupturePercentage), [aggregatedData.collectionRupturePercentage]);
  const skuStockStatusChartConfig = useMemo(() => createChartConfig(aggregatedData.skuStockStatus), [aggregatedData.skuStockStatus]);
  const stockHistoryChartConfig = useMemo(() => chartConfigBase, []);


  const generateDashboardPdf = async () => {
    if (filteredProductsForDashboard.length === 0 && stockHistory.length === 0) {
      toast({ title: "Sem Dados", description: "Carregue dados e selecione filtros antes de gerar o PDF.", variant: "destructive" });
      return;
    }
    setIsGeneratingPdf(true);
    toast({ title: "Gerando PDF...", description: "Por favor, aguarde. Isso pode levar alguns instantes." });

    try {
      const doc = new jsPDF('p', 'mm', 'a4') as jsPDF & { autoTable: (options: any) => void };
      let yPos = 15;
      const pageHeight = doc.internal.pageSize.height;
      const pageWidth = doc.internal.pageSize.width;
      const margin = 10;
      const contentWidth = pageWidth - 2 * margin;

      let reportTitle = "Relatório do Dashboard de Performance";
      if(selectedCollection !== ALL_COLLECTIONS_VALUE) {
        reportTitle += ` - Coleção: ${selectedCollection}`;
      }

      doc.setFontSize(18);
      doc.text(reportTitle, pageWidth / 2, yPos, { align: "center" });
      yPos += 10;

      doc.setFontSize(10);
      doc.text(`Gerado em: ${formatDateFns(new Date(), 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}`, pageWidth / 2, yPos, { align: "center" });
      yPos += 7;
      if (lastDataUpdateTimestamp) {
        doc.setFontSize(9);
        doc.text(`Dados de Produtos atualizados em: ${formatDateFns(lastDataUpdateTimestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}`, pageWidth / 2, yPos, { align: "center" });
        yPos += 7;
      }

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

      doc.autoTable({ 
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
        if (yPos + 10 > pageHeight - margin) { doc.addPage(); yPos = margin; }
        doc.setFontSize(13);
        doc.setFont('helvetica', 'bold');
        doc.text(chartTitle, margin, yPos);
        doc.setFont('helvetica', 'normal');
        yPos += 8;

        try {
          const canvas = await html2canvas(chartElement, { scale: 1.5, useCORS: true, logging: false, backgroundColor: '#ffffff' });
          const imgData = canvas.toDataURL('image/png', 0.95);
          const imgProps = doc.getImageProperties(imgData);
          let imgHeight = (imgProps.height * contentWidth) / imgProps.width;
          let imgWidth = contentWidth;
          const maxChartHeight = pageHeight * 0.45;
          if (imgHeight > maxChartHeight) { imgHeight = maxChartHeight; imgWidth = (imgProps.width * imgHeight) / imgProps.height; }
          if (yPos + imgHeight > pageHeight - margin) {
            doc.addPage(); yPos = margin;
            doc.setFontSize(13); doc.setFont('helvetica', 'bold'); doc.text(chartTitle, margin, yPos); doc.setFont('helvetica', 'normal'); yPos += 8;
          }
          doc.addImage(imgData, 'PNG', margin, yPos, imgWidth, imgHeight);
          yPos += imgHeight + 10;
        } catch (error) {
          console.error(`Erro ao capturar gráfico ${elementId}:`, error);
          doc.setTextColor(255,0,0); doc.setFontSize(10); doc.text(`Erro ao renderizar o gráfico: ${chartTitle}. Verifique o console.`, margin, yPos); doc.setTextColor(0); yPos += 8;
        }
      };

      const chartSections = [
        { id: 'chart-stock-history', title: 'Histórico de Estoque (Unidades Totais e SKUs com Estoque)', data: stockHistory },
        { id: 'chart-stock-by-collection', title: 'Estoque por Descrição Linha Comercial', data: aggregatedData.stockByCollection },
        { id: 'chart-sku-stock-status', title: 'Distribuição de SKUs (Estoque vs. Zerado)', data: aggregatedData.skuStockStatus },
        { id: 'chart-rupture-by-collection', title: 'Ruptura (%) por Descrição Linha Comercial', data: aggregatedData.collectionRupturePercentage },
        { id: 'chart-collection-sku-status', title: 'Status de SKUs por Descrição Linha Comercial (Ativos vs. Zerados)', data: aggregatedData.collectionSkuStatus },
        { id: 'chart-skus-by-product-type', title: 'SKUs por Tipo de Produto (Coluna Tipo. Produto)', data: aggregatedData.skusByProductType },
        { id: 'chart-skus-by-size', title: 'SKUs por Tamanho (Excel)', data: aggregatedData.skusBySize },
        { id: 'chart-stock-by-print', title: 'Estoque por Estampa (Top 15 - Coluna Descrição)', data: aggregatedData.stockByPrint },
      ];

      for (const chartInfo of chartSections) {
         if (chartInfo.data && chartInfo.data.length > 0) {
            await addChartToPdf(chartInfo.id, chartInfo.title);
         } else {
            if (yPos + 10 > pageHeight - margin) { doc.addPage(); yPos = margin; }
            doc.setFontSize(11); doc.setTextColor(100); doc.text(`Gráfico "${chartInfo.title}" não possui dados para exibir com os filtros atuais.`, margin, yPos); doc.setTextColor(0); yPos += 10;
         }
      }

      let pdfFileName = `Relatorio_Dashboard_${formatDateFns(new Date(), 'yyyy-MM-dd', { locale: ptBR })}`;
      if (selectedCollection !== ALL_COLLECTIONS_VALUE) {
        pdfFileName += `_${selectedCollection.replace(/[^a-zA-Z0-9]/g, '_')}`;
      }
      pdfFileName += '.pdf';
      doc.save(pdfFileName);
      toast({ title: "PDF Gerado!", description: "O download do relatório foi iniciado." });
    } catch (error) {
      console.error("Erro ao gerar PDF:", error);
      const pdfError = error as Error;
      toast({ title: "Erro ao Gerar PDF", description: `Não foi possível gerar o relatório: ${pdfError.message}. Verifique o console.`, variant: "destructive" });
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

  const displayLoader = (isLoadingFirestore || isAuthLoading) && dashboardProducts.length === 0 && !isSavingFirestore;

  if (displayLoader) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando dados do painel...</p></div>;
  }
  if (productsError) {
    return (
        <Card className="m-auto mt-10 max-w-lg text-center shadow-xl">
            <CardHeader><AlertTriangle className="mx-auto h-16 w-16 text-destructive mb-4" /><CardTitle className="text-2xl">Erro ao Carregar Dados</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">{productsError}</p><Button onClick={() => refetchProducts()} className="mt-6">Tentar Novamente</Button></CardContent>
        </Card>
    );
  }


  return (
    <div className="space-y-8">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground">Dashboard de Performance</h1>
          <p className="text-muted-foreground">Visão geral dos dados com base na coluna "Descrição Linha Comercial" e histórico de estoque.</p>
        </div>
        <Button 
          onClick={generateDashboardPdf} 
          disabled={isGeneratingPdf || isSavingFirestore || isLoadingFirestore || (filteredProductsForDashboard.length === 0 && stockHistory.length === 0) || isAuthLoading }
        >
            {isGeneratingPdf ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Download className="mr-2 h-5 w-5" />}
            Baixar Relatório PDF
        </Button>
      </div>
      {lastDataUpdateTimestamp && (
        <div className="text-sm text-muted-foreground flex items-center">
            <Clock className="mr-2 h-4 w-4" />
            Última atualização dos dados de produtos: {formatDateFns(lastDataUpdateTimestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
        </div>
      )}

      <Card className="shadow-md border-primary/30 border-l-4">
        <CardHeader><CardTitle className="flex items-center"><ListFilter className="mr-2 h-5 w-5 text-primary" />Filtros do Dashboard</CardTitle></CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <div>
            <Label htmlFor="collectionFilterDashboard">Filtrar por Coleção (Desc. Linha Comercial)</Label>
            <Select value={selectedCollection} onValueChange={setSelectedCollection} disabled={isLoadingFirestore || isSavingFirestore || isGeneratingPdf || isAuthLoading}>
              <SelectTrigger id="collectionFilterDashboard" aria-label="Filtrar por Coleção"><SelectValue placeholder="Filtrar por Coleção" /></SelectTrigger>
              <SelectContent>
                <SelectItem value={ALL_COLLECTIONS_VALUE}>Todas as Coleções</SelectItem>
                {availableDashboardCollections.map(collection => (<SelectItem key={collection as string} value={collection as string}>{collection as string}</SelectItem>))}
              </SelectContent>
            </Select>
          </div>
        </CardContent>
      </Card>

      {isAdmin && (
        <ExcelUploadSection
          onDataParsed={handleExcelDataProcessed}
          onProcessingStart={handleProcessingStart}
          onProcessingEnd={handleProcessingEnd}
          collectionColumnKey="Descrição Linha Comercial"
          cardTitle="Upload de Dados para Dashboard"
          cardDescription="Carregue o arquivo Excel. Os dados serão salvos globalmente e usados para os gráficos e histórico abaixo."
          isProcessingParent={isSavingFirestore}
          passwordProtected={true}
          unlockPassword="exceladmin159"
        />
      )}
      {!isAdmin && dashboardProducts.length === 0 && !isLoadingFirestore && !isAuthLoading && (
         <Card className="shadow-md text-center py-10">
            <CardHeader><CardTitle className="flex items-center justify-center text-xl"><Database className="mr-2 h-7 w-7 text-primary" />Sem Dados para Visualizar</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Nenhum dado de produto foi carregado no sistema. Por favor, peça a um administrador para carregar uma planilha de dados.</p></CardContent>
         </Card>
      )}
      {isSavingFirestore && ( 
        <Card className="shadow-lg"><CardHeader><CardTitle className="flex items-center"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />Salvando dados...</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Por favor, aguarde.</p></CardContent></Card>
      )}
      {!isLoadingFirestore && !isAuthLoading && !isSavingFirestore && dashboardProducts.length === 0 && !isProcessingExcel && isAdmin && (
        <Card className="shadow-lg"><CardHeader><CardTitle className="flex items-center"><Database className="mr-2 h-6 w-6 text-primary" />Sem dados para exibir</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Por favor, carregue um arquivo Excel para popular o dashboard. Os dados serão salvos e carregados automaticamente nas próximas visitas.</p></CardContent></Card>
      )}
      {!isLoadingFirestore && !isAuthLoading && !isSavingFirestore && dashboardProducts.length > 0 && filteredProductsForDashboard.length === 0 && selectedCollection !== ALL_COLLECTIONS_VALUE && (
         <Card className="shadow-lg"><CardHeader><CardTitle className="flex items-center"><Filter className="mr-2 h-6 w-6 text-primary" />Nenhum produto encontrado</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Nenhum produto encontrado para a coleção "{selectedCollection}" selecionada.</p></CardContent></Card>
      )}

      {isLoadingHistory && (
        <Card className="shadow-lg"><CardHeader><CardTitle className="flex items-center"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />Carregando histórico...</CardTitle></CardHeader></Card>
      )}
      
      {!isLoadingHistory && stockHistory.length > 0 && (
         <Card id="chart-stock-history" className="shadow-lg hover:shadow-xl transition-shadow">
            <CardHeader>
              <CardTitle className="flex items-center"><LineChart className="mr-2 h-5 w-5 text-primary" />Histórico de Estoque</CardTitle>
              <CardDescription>Tendência de unidades totais em estoque e SKUs com estoque ao longo do tempo (baseado nos uploads de planilhas).</CardDescription>
            </CardHeader>
            <CardContent className="h-[400px]">
              <ChartContainer config={stockHistoryChartConfig} className="h-full w-full">
                <RechartsLineChart data={stockHistory} margin={{ top: 5, right: 30, left: 20, bottom: 5 }}>
                  <CartesianGrid strokeDasharray="3 3" />
                  <XAxis 
                    dataKey="date" 
                    tickFormatter={(value) => {
                        if (value === null || typeof value === 'undefined') return "N/A";
                        const dateToFormat = value instanceof Date ? value : new Date(value);
                        if (isDateValid(dateToFormat)) return formatDateFns(dateToFormat, "dd/MM/yy", { locale: ptBR });
                        return "Inválida";
                    }} 
                  />
                  <YAxis yAxisId="left" stroke="hsl(var(--chart-1))" label={{ value: 'Unidades Totais', angle: -90, position: 'insideLeft', style: {textAnchor: 'middle', fill: 'hsl(var(--chart-1))'} }} />
                  <YAxis yAxisId="right" orientation="right" stroke="hsl(var(--chart-2))" label={{ value: 'SKUs c/ Estoque', angle: 90, position: 'insideRight', style: {textAnchor: 'middle', fill: 'hsl(var(--chart-2))'} }} />
                  <Tooltip
                    content={<ChartTooltipContent
                        labelFormatter={(label) => {
                           if (label === null || typeof label === 'undefined') {
                            console.warn("ChartTooltip (History): labelFormatter received null or undefined label.");
                            return "Data Indisponível";
                          }
                          let dateToFormat: Date;
                          if (label instanceof Date) {
                            dateToFormat = label;
                          } else {
                            const parsedDate = new Date(label);
                            if (isDateValid(parsedDate)) {
                              dateToFormat = parsedDate;
                            } else {
                              console.warn("ChartTooltip (History): labelFormatter could not parse label into a valid date. Label:", label, "Type:", typeof label);
                              return "Data Inválida";
                            }
                          }
                          if (isDateValid(dateToFormat)) {
                            return formatDateFns(dateToFormat, "dd/MM/yyyy", { locale: ptBR });
                          } else {
                            console.error("ChartTooltip (History): dateToFormat became invalid unexpectedly. Original Label:", label);
                            return "Data Inválida";
                          }
                        }} 
                        formatter={(value, name) => {
                          const valStr = (value as number).toLocaleString();
                          if (name === 'totalStockUnits') {
                            return [`${valStr} Peças em Estoque`, 'Unidades Totais'];
                          } else if (name === 'totalSkusWithStock') {
                            return [`${valStr} SKUs com Estoque`, 'SKUs c/ Estoque'];
                          }
                          return [valStr, name as string]; 
                        }}
                    />}
                  />
                  <RechartsLegend />
                  <RechartsLineElement yAxisId="left" type="monotone" dataKey="totalStockUnits" name="Unidades Totais" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                  <RechartsLineElement yAxisId="right" type="monotone" dataKey="totalSkusWithStock" name="SKUs c/ Estoque" stroke="hsl(var(--chart-2))" strokeWidth={2} dot={{ r: 4 }} activeDot={{ r: 6 }} />
                </RechartsLineChart>
              </ChartContainer>
            </CardContent>
          </Card>
      )}
       {!isLoadingHistory && stockHistory.length === 0 && (
          <Card className="shadow-md text-center py-6">
            <CardHeader><CardTitle className="flex items-center justify-center text-lg"><LineChart className="mr-2 h-6 w-6 text-muted-foreground" />Sem Histórico de Estoque</CardTitle></CardHeader>
            <CardContent><p className="text-muted-foreground">Nenhum histórico de estoque encontrado. Faça um upload de planilha para começar a registrar o histórico.</p></CardContent>
          </Card>
      )}


      {!isLoadingFirestore && !isAuthLoading && !isSavingFirestore && filteredProductsForDashboard.length > 0 && (
        <>
          <div className="grid gap-6 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-6">
            <Card className="shadow-lg hover:shadow-xl transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Estoque Total</CardTitle><Layers className="h-5 w-5 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold text-foreground">{aggregatedData.totalStock.toLocaleString()}</div><p className="text-xs text-muted-foreground">unidades em estoque</p></CardContent></Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Pronta Entrega</CardTitle><PackageCheck className="h-5 w-5 text-green-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-foreground">{aggregatedData.totalReadyToShipStock.toLocaleString()}</div><p className="text-xs text-muted-foreground">unidades prontas para envio</p></CardContent></Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Regulador</CardTitle><Activity className="h-5 w-5 text-orange-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-foreground">{aggregatedData.totalRegulatorStock.toLocaleString()}</div><p className="text-xs text-muted-foreground">unidades no depósito Regulador</p></CardContent></Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Pedidos em Aberto</CardTitle><ClipboardList className="h-5 w-5 text-blue-500" /></CardHeader><CardContent><div className="text-2xl font-bold text-foreground">{aggregatedData.totalOpenOrders.toLocaleString()}</div><p className="text-xs text-muted-foreground">unidades com pedido em aberto</p></CardContent></Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total SKUs</CardTitle><FileSpreadsheet className="h-5 w-5 text-primary" /></CardHeader><CardContent><div className="text-2xl font-bold text-foreground">{aggregatedData.totalSkus.toLocaleString()}</div><p className="text-xs text-muted-foreground">SKUs distintos carregados</p></CardContent></Card>
            <Card className="shadow-lg hover:shadow-xl transition-shadow"><CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2"><CardTitle className="text-sm font-medium">Total SKUs Zerados</CardTitle><AlertTriangle className="h-5 w-5 text-destructive" /></CardHeader><CardContent><div className="text-2xl font-bold text-destructive">{aggregatedData.totalZeroStockSkus.toLocaleString()}</div><p className="text-xs text-muted-foreground">SKUs com estoque zero</p></CardContent></Card>
          </div>

          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {aggregatedData.stockByCollection.length > 0 && (
              <Card id="chart-stock-by-collection" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader><CardTitle className="flex items-center"><ShoppingBag className="mr-2 h-5 w-5 text-primary" />Estoque por Descrição Linha Comercial</CardTitle><CardDescription>Distribuição de estoque e SKUs pela coluna "Descrição Linha Comercial" do Excel.</CardDescription></CardHeader>
                <CardContent className="h-[400px]"><ChartContainer config={stockByCollectionChartConfig} className="h-full w-full"><ResponsiveContainer width="100%" height="100%"><RechartsBarChart data={aggregatedData.stockByCollection} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={80} tick={{fontSize: 12}}/><YAxis yAxisId="left" orientation="left" stroke="hsl(var(--primary))" tickFormatter={(value) => value.toLocaleString()}/><YAxis yAxisId="right" orientation="right" stroke="hsl(var(--accent))" tickFormatter={(value) => value.toLocaleString()}/><Tooltip content={<ChartTooltipContent />} /><RechartsLegend /><Bar yAxisId="left" dataKey="stock" name="Estoque" fill="hsl(var(--primary))" radius={[4, 4, 0, 0]} /><Bar yAxisId="right" dataKey="skus" name="SKUs" fill="hsl(var(--accent))" radius={[4, 4, 0, 0]} /></RechartsBarChart></ResponsiveContainer></ChartContainer></CardContent>
              </Card>
            )}
            {aggregatedData.skuStockStatus.length > 0 && aggregatedData.totalSkus > 0 && (
              <Card id="chart-sku-stock-status" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader><CardTitle className="flex items-center"><PieChartLucide className="mr-2 h-5 w-5 text-primary" />Distribuição de SKUs (Estoque vs. Zerado)</CardTitle><CardDescription>Proporção de SKUs com estoque e SKUs com estoque zerado.</CardDescription></CardHeader>
                <CardContent className="h-[400px]"><ChartContainer config={skuStockStatusChartConfig} className="h-full w-full"><ResponsiveContainer width="100%" height="100%"><PieChart><Tooltip content={<ChartTooltipContent nameKey="name" />} /><Pie data={aggregatedData.skuStockStatus} dataKey="value" nameKey="name" cx="50%" cy="50%" outerRadius={120} labelLine={false} label={renderCustomizedLabel}>{aggregatedData.skuStockStatus.map((entry, index) => (<Cell key={`cell-${index}`} fill={PIE_COLORS[index % PIE_COLORS.length]} />))}</Pie><RechartsLegend /></PieChart></ResponsiveContainer></ChartContainer></CardContent>
              </Card>
            )}
          </div>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {aggregatedData.collectionRupturePercentage.length > 0 && (
              <Card id="chart-rupture-by-collection" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader><CardTitle className="flex items-center"><Percent className="mr-2 h-5 w-5 text-destructive" />Ruptura (%) por Descrição Linha Comercial</CardTitle><CardDescription>Porcentagem de SKUs com estoque zero em cada descrição linha comercial.</CardDescription></CardHeader>
                <CardContent className="h-[400px]"><ChartContainer config={collectionRuptureChartConfig} className="h-full w-full"><ResponsiveContainer width="100%" height="100%"><RechartsBarChart data={aggregatedData.collectionRupturePercentage} margin={{ top: 5, right: 20, left: 10, bottom: 60 }}><CartesianGrid strokeDasharray="3 3" vertical={false} /><XAxis dataKey="name" angle={-45} textAnchor="end" interval={0} height={80} tick={{fontSize: 12}}/><YAxis tickFormatter={(value) => `${value}%`} domain={[0, 'dataMax + 5']} allowDecimals={false}/><Tooltip content={<ChartTooltipContent />} formatter={(value: number) => `${value.toFixed(2)}%`} /><RechartsLegend /><Bar dataKey="rupturePercentage" name="Ruptura (%)" fill="hsl(var(--destructive))" radius={[4, 4, 0, 0]} /></RechartsBarChart></ResponsiveContainer></ChartContainer></CardContent>
              </Card>
            )}
            {aggregatedData.skusBySize.length > 0 && (
              <Card id="chart-skus-by-size" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader><CardTitle className="flex items-center"><Ruler className="mr-2 h-5 w-5 text-accent" />SKUs por Tamanho (Excel)</CardTitle><CardDescription>Distribuição de SKUs (com e sem estoque) por tamanho (coluna "Tamanho" do Excel).</CardDescription></CardHeader>
                <CardContent className="h-[400px]"><ChartContainer config={skusBySizeChartConfig} className="h-full w-full"><ResponsiveContainer width="100%" height="100%"><RechartsBarChart data={aggregatedData.skusBySize} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tickFormatter={(value) => value.toLocaleString()}/><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} interval={0} /><Tooltip content={<ChartTooltipContent />} /><RechartsLegend /><Bar dataKey="skusWithStock" name="SKUs c/ Estoque" fill="hsl(var(--chart-2))" stackId="size" radius={[0, 4, 4, 0]} /><Bar dataKey="skusWithoutStock" name="SKUs s/ Estoque" fill="hsl(var(--destructive))" stackId="size" radius={[0, 4, 4, 0]}/></RechartsBarChart></ResponsiveContainer></ChartContainer></CardContent>
              </Card>
            )}
          </div>
          <div className="grid gap-6 md:grid-cols-1 lg:grid-cols-2">
            {aggregatedData.stockByPrint.length > 0 && (
              <Card id="chart-stock-by-print" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader><CardTitle className="flex items-center"><Palette className="mr-2 h-5 w-5" style={{color: 'hsl(var(--chart-4))'}} />Estoque por Estampa (Top 15 - Coluna Descrição)</CardTitle><CardDescription>Distribuição de estoque pelas principais estampas (extraído da coluna H: 'Descrição' do Excel).</CardDescription></CardHeader>
                <CardContent className="h-[400px]"><ChartContainer config={stockByPrintChartConfig} className="h-full w-full"><ResponsiveContainer width="100%" height="100%"><RechartsBarChart data={aggregatedData.stockByPrint} margin={{ top: 5, right: 20, left: 10, bottom: 90 }}><CartesianGrid strokeDasharray="3 3" vertical={false}/><XAxis dataKey="name" angle={-60} textAnchor="end" interval={0} height={100} tick={{fontSize: 10}}/><YAxis tickFormatter={(value) => value.toLocaleString()}/><Tooltip content={<ChartTooltipContent />} /><RechartsLegend /><Bar dataKey="stock" name="Estoque" fill="hsl(var(--chart-4))" radius={[4, 4, 0, 0]} /></RechartsBarChart></ResponsiveContainer></ChartContainer></CardContent>
              </Card>
            )}
            {aggregatedData.skusByProductType.length > 0 && (
              <Card id="chart-skus-by-product-type" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader><CardTitle className="flex items-center"><Box className="mr-2 h-5 w-5" style={{color: 'hsl(var(--chart-5))'}} />SKUs por Tipo de Produto (Coluna Tipo. Produto)</CardTitle><CardDescription>Distribuição de SKUs (com e sem estoque) por tipo (coluna "Tipo. Produto" do Excel).</CardDescription></CardHeader>
                <CardContent className="h-[400px]"><ChartContainer config={skusByProductTypeChartConfig} className="h-full w-full"><ResponsiveContainer width="100%" height="100%"><RechartsBarChart data={aggregatedData.skusByProductType} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={false}/><XAxis type="number" tickFormatter={(value) => value.toLocaleString()}/><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} interval={0} /><Tooltip content={<ChartTooltipContent />} /><RechartsLegend /><Bar dataKey="skusWithStock" name="SKUs c/ Estoque" fill="hsl(var(--chart-2))" stackId="type" radius={[0, 4, 4, 0]} /><Bar dataKey="skusWithoutStock" name="SKUs s/ Estoque" fill="hsl(var(--destructive))" stackId="type" radius={[0, 4, 4, 0]}/></RechartsBarChart></ResponsiveContainer></ChartContainer></CardContent>
              </Card>
            )}
          </div>
          {aggregatedData.collectionSkuStatus.length > 0 && (
            <Card id="chart-collection-sku-status" className="shadow-lg hover:shadow-xl transition-shadow">
                <CardHeader><CardTitle className="flex items-center"><BarChartHorizontal className="mr-2 h-5 w-5 text-primary" />Status de SKUs por Descrição Linha Comercial (Ativos vs. Zerados)</CardTitle><CardDescription>Contagem de SKUs ativos (com estoque) e zerados em cada descrição linha comercial.</CardDescription></CardHeader>
                <CardContent className="h-[400px]"><ChartContainer config={collectionSkuStatusChartConfig} className="h-full w-full"><ResponsiveContainer width="100%" height="100%"><RechartsBarChart data={aggregatedData.collectionSkuStatus} layout="vertical" margin={{ top: 5, right: 30, left: 100, bottom: 5 }}><CartesianGrid strokeDasharray="3 3" horizontal={false} /><XAxis type="number" tickFormatter={(value) => value.toLocaleString()}/><YAxis dataKey="name" type="category" width={100} tick={{fontSize: 12}} interval={0} /><Tooltip content={<ChartTooltipContent />} /><RechartsLegend /><Bar dataKey="activeSkus" name="SKUs Ativos" fill="hsl(var(--chart-1))" stackId="collection" radius={[0, 4, 4, 0]}/><Bar dataKey="zeroStockSkus" name="SKUs Zerados" fill="hsl(var(--destructive))" stackId="collection" radius={[0, 4, 4, 0]}/></RechartsBarChart></ResponsiveContainer></ChartContainer></CardContent>
            </Card>
            )}
        </>
      )}
    </div>
  );
}
