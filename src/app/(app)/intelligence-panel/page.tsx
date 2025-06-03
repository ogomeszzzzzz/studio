
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowUpDown, BarChart3, Brain, CalendarDays, Clock, Download, Filter as FilterIcon, HelpCircle, TrendingDown, TrendingUp, PackageSearch, ListChecks, CheckSquare, Lightbulb, Settings, Eye, Info, LineChart, ShoppingCart, ChevronLeft, ChevronRight, AlertCircleIcon, PackageIcon, CircleIcon, UploadCloud, FileSpreadsheet } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product, EnhancedProductForIntelligence, SalesRecord } from '@/types';
import { firestore, firestoreClientInitializationError } from '@/lib/firebase/config';
import { collection, getDocs, doc, Timestamp, query, getDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { format as formatDateFns, isValid as isDateValid, subDays, isAfter } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { predictLogistics, type LogisticsPredictionInput, type LogisticsPredictionOutput } from '@/ai/flows/logistics-predictor-flow';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from '@/components/ui/skeleton';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { cn } from '@/lib/utils';
import { ExcelUploadSection } from '@/components/domain/ExcelUploadSection'; // Assuming this can be reused or adapted
import { parseSalesData } from '@/lib/excel-parser';


const productFromFirestore = (data: any): Product => {
  return {
    ...data,
    collectionStartDate: data.collectionStartDate instanceof Timestamp ? data.collectionStartDate.toDate() : null,
    collectionEndDate: data.collectionEndDate instanceof Timestamp ? data.collectionEndDate.toDate() : null,
  } as Product;
};

const ALL_RISK_STATUS_VALUE = "_ALL_RISK_STATUS_INTEL_";

const formatDaysToRuptureForDisplay = (days: number | null | undefined): string => {
  if (days === null || days === undefined || !isFinite(days) || isNaN(days)) {
    return 'N/A';
  }
  if (days === 0) return '0 (Hoje)';
  return days.toFixed(0);
};

const getRiskStatusIcon = (status: LogisticsPredictionOutput['riskStatusPE'] | undefined) => {
  if (!status) return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  switch (status) {
    case 'Ruptura Iminente': return <AlertTriangle className="h-4 w-4 text-red-500" />;
    case 'Atenção': return <AlertCircleIcon className="h-4 w-4 text-yellow-500" />;
    case 'Estável': return <CircleIcon className="h-4 w-4 text-green-500 fill-green-500" />;
    case 'N/A': return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
    default: return <HelpCircle className="h-4 w-4 text-muted-foreground" />;
  }
};


export default function IntelligencePanelPage() {
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [allProducts, setAllProducts] = useState<Product[]>([]); // Stock data from Firestore
  const [salesRecords, setSalesRecords] = useState<SalesRecord[]>([]); // Sales data from local Excel upload
  const [enhancedProducts, setEnhancedProducts] = useState<EnhancedProductForIntelligence[]>([]);
  
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true); // For stock data
  const [isLoadingSalesExcel, setIsLoadingSalesExcel] = useState(false); // For sales data upload
  const [isProcessingSalesData, setIsProcessingSalesData] = useState(false); // For parsing sales data
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [lastDataUpdateTimestamp, setLastDataUpdateTimestamp] = useState<Date | null>(null); // For stock data
  const [lastSalesUploadTimestamp, setLastSalesUploadTimestamp] = useState<Date | null>(null);
  
  const [searchTerm, setSearchTerm] = useState('');
  const [selectedRiskStatus, setSelectedRiskStatus] = useState<string>(ALL_RISK_STATUS_VALUE);
  
  const [sortKey, setSortKey] = useState<keyof EnhancedProductForIntelligence | 'daysToRupturePE' | ''>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;

  // Fetch stock data from Firestore
  useEffect(() => {
    if (isAuthLoading) return;
    if (firestoreClientInitializationError || !firestore) {
      toast({ title: "Erro de Conexão com Firestore", description: firestoreClientInitializationError || "Firestore não disponível.", variant: "destructive" });
      setIsLoadingFirestore(false);
      return;
    }
    if (currentUser && allProducts.length === 0) {
      setIsLoadingFirestore(true);
      const fetchStockProducts = async () => {
        try {
          const productsQuery = query(collection(firestore, "shared_products"));
          const snapshot = await getDocs(productsQuery);
          const productsFromDb: Product[] = snapshot.docs.map(docSnap => productFromFirestore(docSnap.data()));
          setAllProducts(productsFromDb);

          const metadataDocRef = doc(firestore, "app_metadata", "products_metadata");
          const metadataDocSnap = await getDoc(metadataDocRef);
          if (metadataDocSnap.exists()) {
            const data = metadataDocSnap.data();
            if (data.lastUpdatedAt instanceof Timestamp) setLastDataUpdateTimestamp(data.lastUpdatedAt.toDate());
          }
          if (productsFromDb.length === 0) {
            toast({ title: "Sem Dados de Estoque", description: "Nenhum produto de estoque encontrado no sistema. Faça upload no Dashboard.", variant: "default" });
          }
        } catch (error) {
          toast({ title: "Erro ao Carregar Estoque", description: (error as Error).message, variant: "destructive" });
        } finally {
          setIsLoadingFirestore(false);
        }
      };
      fetchStockProducts();
    } else if (!currentUser) {
      setAllProducts([]);
      setEnhancedProducts([]);
      setIsLoadingFirestore(false);
    } else if (allProducts.length > 0) {
        setIsLoadingFirestore(false); // Already loaded
    }
  }, [currentUser, isAuthLoading, allProducts.length, toast]);

  const handleSalesDataParsed = useCallback((parsedSales: SalesRecord[]) => {
    setSalesRecords(parsedSales);
    setLastSalesUploadTimestamp(new Date());
    toast({ title: "Planilha de Vendas Processada", description: `${parsedSales.length} registros de venda carregados.` });
    setIsProcessingSalesData(false);
  }, [toast]);
  
  const handleSalesProcessingStart = useCallback(() => setIsProcessingSalesData(true), []);
  const handleSalesProcessingEnd = useCallback(() => setIsProcessingSalesData(false), []);


  // Process combined data and fetch AI predictions
  const processDataAndFetchPredictions = useCallback(async () => {
    if (allProducts.length === 0) {
      // toast({ title: "Aguardando Dados de Estoque", description: "Carregue os dados de estoque no Dashboard primeiro.", variant: "default" });
      setEnhancedProducts([]);
      return;
    }
     if (salesRecords.length === 0) {
      // toast({ title: "Aguardando Dados de Vendas", description: "Faça upload da planilha de vendas detalhadas.", variant: "default" });
      // If no sales data, still process products but sales30d will be 0 for predictions
    }

    setIsLoadingPredictions(true);

    const thirtyDaysAgo = subDays(new Date(), 30);
    const productsForPrediction = allProducts.map(p => {
      const relevantSales = salesRecords.filter(sr => 
        sr.date && isAfter(sr.date, thirtyDaysAgo) &&
        (String(sr.reference).trim() === String(p.vtexId).trim() || String(sr.reference).trim() === String(p.productDerivation).trim())
      );
      const dynamicSales30d = relevantSales.reduce((sum, sr) => sum + sr.quantity, 0);
      return { ...p, sales30d: dynamicSales30d, dynamicSales30d }; // Override sales30d for this panel
    });
    
    const predictionsPromises = productsForPrediction.map(async (p) => {
      const dailyAvgSales = (p.sales30d || 0) / 30;
      try {
        const predictionInput: LogisticsPredictionInput = {
          productId: String(p.vtexId) || p.name,
          productName: p.name,
          currentStock: p.stock,
          readyToShipStock: p.readyToShip,
          regulatorStock: p.regulatorStock,
          sales30d: p.sales30d || 0, // Use dynamically calculated sales
          price: p.price || 0,
          openOrders: p.openOrders || 0,
        };
        const predictionResult = await predictLogistics(predictionInput);
        return { ...p, dailyAverageSales: dailyAvgSales, prediction: predictionResult };
      } catch (error) {
        console.error(`Error fetching prediction for ${p.name}:`, error);
        return { 
          ...p, 
          dailyAverageSales: dailyAvgSales,
          prediction: {
            productId: String(p.vtexId) || p.name,
            productName: p.name,
            daysToRupturePE: null,
            riskStatusPE: 'N/A',
            suggestedRestockUnitsPE: 0,
            alerts: [`Erro ao buscar predição: ${(error as Error).message}`],
            dailyAverageSales: dailyAvgSales
          } as LogisticsPredictionOutput
        };
      }
    });

    const results = await Promise.all(predictionsPromises);
    setEnhancedProducts(results);
    setIsLoadingPredictions(false);
  }, [allProducts, salesRecords]);

  useEffect(() => {
    // Trigger predictions when both stock and sales data are available (or if sales data is intentionally empty)
    if (!isLoadingFirestore) { // Ensure stock data is loaded or attempted
        processDataAndFetchPredictions();
    }
  }, [allProducts, salesRecords, isLoadingFirestore, processDataAndFetchPredictions]);


  const filteredAndSortedProducts = useMemo(() => {
    let tempProducts = [...enhancedProducts];
    if (searchTerm) {
      tempProducts = tempProducts.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.vtexId).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedRiskStatus !== ALL_RISK_STATUS_VALUE) {
      tempProducts = tempProducts.filter(p => p.prediction?.riskStatusPE === selectedRiskStatus);
    }
    
    if (sortKey) {
        tempProducts.sort((a, b) => {
            let valA: any, valB: any;
            if (sortKey === 'daysToRupturePE') {
                valA = a.prediction?.daysToRupturePE === null ? Infinity : a.prediction?.daysToRupturePE ?? Infinity;
                valB = b.prediction?.daysToRupturePE === null ? Infinity : b.prediction?.daysToRupturePE ?? Infinity;
            } else if (sortKey === 'sales30d') { // Sort by dynamicSales30d if available
                valA = a.dynamicSales30d ?? (a as any)[sortKey];
                valB = b.dynamicSales30d ?? (b as any)[sortKey];
            }
             else {
                valA = (a as any)[sortKey];
                valB = (b as any)[sortKey];
            }

            let comparison = 0;
            if (typeof valA === 'number' && typeof valB === 'number') {
                comparison = valA - valB;
            } else if (typeof valA === 'string' && typeof valB === 'string') {
                comparison = valA.localeCompare(valB);
            } else if (valA === null || valA === undefined) {
                comparison = 1; 
            } else if (valB === null || valB === undefined) {
                comparison = -1;
            }
            return sortOrder === 'asc' ? comparison : -comparison;
        });
    }
    return tempProducts;
  }, [enhancedProducts, searchTerm, selectedRiskStatus, sortKey, sortOrder]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);

  const handleSort = (key: keyof EnhancedProductForIntelligence | 'daysToRupturePE') => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };
  
  const renderSortIcon = (key: keyof EnhancedProductForIntelligence | 'daysToRupturePE') => {
    if (sortKey === key) {
      return sortOrder === 'asc' ? <ArrowUpDown className="h-3 w-3 inline ml-1 transform rotate-180" /> : <ArrowUpDown className="h-3 w-3 inline ml-1" />;
    }
    return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-30" />;
  };

  const riskStatusOptions: LogisticsPredictionOutput['riskStatusPE'][] = ['Ruptura Iminente', 'Atenção', 'Estável', 'N/A'];

  const automatedAlerts = useMemo(() => {
    if (isLoadingPredictions || enhancedProducts.length === 0) {
      return { ruptureLessThan7Days: [], stockParado: [], dailySalesExceedsPE: [] };
    }
    const ruptureLessThan7Days = enhancedProducts.filter(p => p.prediction?.daysToRupturePE !== null && p.prediction!.daysToRupturePE < 7);
    const stockParado = enhancedProducts.filter(p => p.stock > 100 && (p.dynamicSales30d ?? p.sales30d ?? 0) < 5);
    const dailySalesExceedsPE = enhancedProducts.filter(p => p.dailyAverageSales > p.readyToShip && p.readyToShip > 0);

    return { ruptureLessThan7Days, stockParado, dailySalesExceedsPE };
  }, [enhancedProducts, isLoadingPredictions]);


  const handleExportSuggestions = () => {
    if (isLoadingPredictions && enhancedProducts.length === 0) {
        toast({title: "Aguarde", description: "As previsões ainda estão carregando.", variant: "default"});
        return;
    }
    const productsToExport = filteredAndSortedProducts.filter(p => 
        p.prediction?.riskStatusPE === 'Ruptura Iminente' || p.prediction?.riskStatusPE === 'Atenção'
    );

    if (productsToExport.length === 0) {
        toast({title: "Sem Sugestões Críticas", description: "Nenhum produto com risco 'Ruptura Iminente' ou 'Atenção' nos filtros atuais para exportar.", variant: "default"});
        return;
    }

    toast({ title: "Exportando Sugestões...", description: "Gerando arquivo Excel." });

    const dataToExport = productsToExport.map(p => {
        const dailySales = p.dailyAverageSales;
        // Suggestion for Pronta Entrega based on 15 days, considering what's already in PE
        const targetStockPE15d = dailySales * 15;
        const suggestedForPE15d = Math.max(0, Math.ceil(targetStockPE15d - p.readyToShip)); 
        
        return {
            "Produto": p.name,
            "ID VTEX/Ref.": String(p.vtexId || p.productDerivation || ''),
            "Status Risco (PE)": p.prediction?.riskStatusPE || 'N/A',
            "Estoque Pronta Entrega": p.readyToShip,
            "Média Venda Diária": p.dailyAverageSales.toFixed(2),
            "Projeção Ruptura PE (dias)": formatDaysToRuptureForDisplay(p.prediction?.daysToRupturePE),
            "Sugestão para 15d Cobertura (PE)": suggestedForPE15d,
            "Prioridade": p.prediction?.riskStatusPE === 'Ruptura Iminente' ? 'Alta' : 'Média',
            "Alertas Gerais (Produto)": p.prediction?.alerts?.join('; ') || ''
        };
    });

    try {
        const worksheet = XLSX.utils.json_to_sheet(dataToExport);
        const workbook = XLSX.utils.book_new();
        XLSX.utils.book_append_sheet(workbook, worksheet, "SugestoesReposicao");
        XLSX.writeFile(workbook, `Sugestoes_Reposicao_Inteligencia_${new Date().toISOString().split('T')[0]}.xlsx`);
        toast({ title: "Exportação Concluída", description: "As sugestões de reposição foram exportadas." });
    } catch (error) {
        console.error("Erro ao exportar para Excel (Sugestões Inteligência):", error);
        toast({ title: "Erro na Exportação", description: "Não foi possível gerar o arquivo Excel.", variant: "destructive" });
    }
  };


  const displayGlobalLoader = (isLoadingFirestore || isAuthLoading) && allProducts.length === 0;

  if (displayGlobalLoader) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando dados de estoque...</p></div>;
  }
  
  const renderAlertList = (alertProducts: EnhancedProductForIntelligence[], title: string, emptyMessage: string) => (
    <div>
      <h4 className="font-semibold text-sm mb-1 text-primary">{title} ({alertProducts.length})</h4>
      {alertProducts.length > 0 ? (
        <ul className="list-disc pl-5 text-xs space-y-0.5 max-h-32 overflow-y-auto">
          {alertProducts.map(p => <li key={`alert-${title}-${p.vtexId}`}>{p.name}</li>)}
        </ul>
      ) : (
        <p className="text-xs text-muted-foreground">{emptyMessage}</p>
      )}
    </div>
  );

  const isReadyForAnalysis = allProducts.length > 0; // Analysis can run even without sales data (sales30d will be 0)

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <Brain className="mr-3 h-8 w-8 text-primary" />
            Painel de Inteligência Logística e Comercial
          </h1>
          <p className="text-muted-foreground">
            Combine dados de estoque (do Dashboard) com vendas detalhadas (upload abaixo) para previsões e alertas.
          </p>
        </div>
      </div>
       {lastDataUpdateTimestamp && (
        <div className="text-sm text-muted-foreground flex items-center">
            <Clock className="mr-1 h-4 w-4" />
            Dados de estoque atualizados em: {formatDateFns(lastDataUpdateTimestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}.
        </div>
      )}
      {lastSalesUploadTimestamp && (
        <div className="text-sm text-muted-foreground flex items-center">
            <FileSpreadsheet className="mr-1 h-4 w-4" />
            Planilha de vendas carregada em: {formatDateFns(lastSalesUploadTimestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}.
        </div>
      )}
       {!lastSalesUploadTimestamp && !isProcessingSalesData && allProducts.length > 0 && (
          <Card className="shadow-sm border-l-4 border-blue-500">
            <CardHeader><CardTitle className="text-blue-700">Ação Necessária</CardTitle></CardHeader>
            <CardContent><p className="text-blue-600">Faça o upload da planilha de vendas detalhadas para calcular a Venda 30d dinamicamente e refinar as previsões.</p></CardContent>
          </Card>
        )}


      {/* Sales Excel Upload Section */}
      <ExcelUploadSection
          onDataParsed={(data) => handleSalesDataParsed(data as unknown as SalesRecord[])} // Cast needed due to generic ExcelUploadSection
          onProcessingStart={handleSalesProcessingStart}
          onProcessingEnd={handleSalesProcessingEnd}
          cardTitle="Upload Planilha de Vendas Detalhadas"
          cardDescription="Carregue o Excel com as colunas: Data, Pedido, Referencia, Nome, Valor de venda, Quantidade, Valor total. Cada linha deve ser um item de pedido."
          isProcessingParent={isProcessingSalesData || isLoadingSalesExcel} // isLoadingSalesExcel can be a general upload lock
          passwordProtected={false} // Or true if you want password for this specific upload
          collectionColumnKey="Referencia" // Not strictly used for collection, but a key for parseExcelData if it were reused; parseSalesData is custom.
      />

      {/* Component 2: Alertas e Insights Automatizados */}
      <Card className="shadow-md border-l-4 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center"><Lightbulb className="mr-2 h-5 w-5 text-primary" />Alertas e Insights Chave</CardTitle>
          <CardDescription>Destaques baseados na análise dos dados atuais (com base nas vendas da planilha carregada acima e estoque do Dashboard).</CardDescription>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {(isLoadingPredictions && enhancedProducts.length === 0 && isReadyForAnalysis) || (isLoadingFirestore && allProducts.length === 0) ? (
            <>
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
              <Skeleton className="h-24 w-full" />
            </>
          ) : !isReadyForAnalysis && !isLoadingFirestore ? (
             <p className="col-span-full text-center text-muted-foreground">Carregue os dados de estoque no Dashboard para iniciar a análise.</p>
          ) : enhancedProducts.length === 0 && !isLoadingPredictions && salesRecords.length > 0 ? (
            <p className="col-span-full text-center text-muted-foreground">Nenhum produto para exibir após processamento. Verifique os dados carregados.</p>
          ) : (
            <>
             {renderAlertList(automatedAlerts.ruptureLessThan7Days, "Ruptura PE < 7 Dias", "Nenhum produto com ruptura PE iminente (< 7 dias).")}
             {renderAlertList(automatedAlerts.stockParado, "Estoque Total Parado (Ex: >100un, <5 vendas/30d)", "Nenhum produto identificado como estoque total parado com os critérios atuais.")}
             {renderAlertList(automatedAlerts.dailySalesExceedsPE, "Venda Diária > Estoque Pronta Entrega", "Nenhum produto com venda diária superando o estoque de pronta entrega.")}
            </>
          )}
        </CardContent>
      </Card>
      
      {/* Filtros Avançados */}
      <Card className="shadow-sm">
        <CardHeader>
            <CardTitle className="flex items-center text-lg"><FilterIcon className="mr-2 h-5 w-5 text-primary"/>Filtros da Tabela</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
                <Label htmlFor="intelSearchTable">Busca por Nome/ID do Produto</Label>
                <Input id="intelSearchTable" placeholder="Digite nome ou ID VTEX/Referência..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mt-1"/>
            </div>
            <div>
                <Label htmlFor="intelRiskStatusTable">Status de Risco (Pronta Entrega)</Label>
                <Select value={selectedRiskStatus} onValueChange={setSelectedRiskStatus}>
                    <SelectTrigger id="intelRiskStatusTable" className="mt-1"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_RISK_STATUS_VALUE}>Todos os Status</SelectItem>
                        {riskStatusOptions.map(rs => <SelectItem key={rs} value={rs}>{rs}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>


      {/* Component 1: Tabela Central com Lógica de Projeção */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex-grow">
                <CardTitle className="flex items-center"><ListChecks className="mr-2 h-5 w-5 text-primary"/>Visão Detalhada de Produtos e Projeções</CardTitle>
                <CardDescription>Análise de cada produto com foco no estoque de Pronta Entrega, usando Venda 30d da planilha de vendas carregada.</CardDescription>
            </div>
            <Button onClick={handleExportSuggestions} size="sm" variant="default" disabled={(isLoadingPredictions && enhancedProducts.length === 0) || filteredAndSortedProducts.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Exportar Sugestões (Excel)
            </Button>
           </div>
        </CardHeader>
        <CardContent>
          {(isLoadingPredictions && enhancedProducts.length === 0 && isReadyForAnalysis) || (isLoadingFirestore && allProducts.length === 0) ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3">Carregando e processando dados para análise...</p></div>
          ) : !isReadyForAnalysis && !isLoadingFirestore ? (
            <p className="text-center text-muted-foreground py-6">Carregue os dados de estoque no Dashboard para habilitar a análise.</p>
          ) : paginatedProducts.length === 0 && salesRecords.length === 0 && !isLoadingSalesExcel && !isProcessingSalesData ? (
            <p className="text-center text-muted-foreground py-6">Faça o upload da planilha de vendas para calcular dinamicamente a "Venda 30 dias" e gerar as previsões.</p>
          ) : paginatedProducts.length === 0 ? (
             <p className="text-center text-muted-foreground py-6">Nenhum produto corresponde aos filtros atuais.</p>
          ) : (
            <>
            <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/50 text-xs py-2 px-2 whitespace-nowrap sticky left-0 bg-card z-10">Produto {renderSortIcon('name')}</TableHead>
                  <TableHead onClick={() => handleSort('stock')} className="cursor-pointer hover:bg-muted/50 text-xs py-2 px-2 text-right whitespace-nowrap">Est. Total {renderSortIcon('stock')}</TableHead>
                  <TableHead onClick={() => handleSort('readyToShip')} className="cursor-pointer hover:bg-muted/50 text-xs py-2 px-2 text-right whitespace-nowrap font-semibold text-green-600">Est. PE {renderSortIcon('readyToShip')}</TableHead>
                  <TableHead onClick={() => handleSort('regulatorStock')} className="cursor-pointer hover:bg-muted/50 text-xs py-2 px-2 text-right whitespace-nowrap">Est. Regulador {renderSortIcon('regulatorStock')}</TableHead>
                  <TableHead onClick={() => handleSort('price')} className="cursor-pointer hover:bg-muted/50 text-xs py-2 px-2 text-right whitespace-nowrap">Preço {renderSortIcon('price')}</TableHead>
                  <TableHead onClick={() => handleSort('sales30d')} className="cursor-pointer hover:bg-muted/50 text-xs py-2 px-2 text-right whitespace-nowrap font-semibold text-blue-600">Vendas 30d (Planilha) {renderSortIcon('sales30d')}</TableHead>
                  <TableHead onClick={() => handleSort('dailyAverageSales')} className="cursor-pointer hover:bg-muted/50 text-xs py-2 px-2 text-right whitespace-nowrap">Média Venda/Dia {renderSortIcon('dailyAverageSales')}</TableHead>
                  <TableHead onClick={() => handleSort('daysToRupturePE')} className="cursor-pointer hover:bg-muted/50 text-xs py-2 px-2 text-right whitespace-nowrap font-semibold">Ruptura PE (dias) {renderSortIcon('daysToRupturePE')}</TableHead>
                  <TableHead className="text-xs text-center py-2 px-2 whitespace-nowrap font-semibold">Status Risco (PE)</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.map(p => (
                  <TableRow key={String(p.vtexId) + p.name}>
                    <TableCell className="font-medium text-xs max-w-xs truncate py-1.5 px-2 sticky left-0 bg-card z-10" title={p.name}>
                        <TooltipProvider delayDuration={300}>
                            <Tooltip>
                                <TooltipTrigger asChild><span className="cursor-default">{p.name}</span></TooltipTrigger>
                                <TooltipContent className="max-w-md"><p>{p.name} (VTEX ID: {String(p.vtexId || p.productDerivation)})</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right text-xs py-1.5 px-2">{p.stock.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs py-1.5 px-2 font-semibold text-green-700">{p.readyToShip.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs py-1.5 px-2">{p.regulatorStock.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs py-1.5 px-2">{p.price?.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) || 'N/A'}</TableCell>
                    <TableCell className="text-right text-xs py-1.5 px-2 font-semibold text-blue-700">{(p.dynamicSales30d ?? p.sales30d ?? 0).toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs py-1.5 px-2">{p.dailyAverageSales.toFixed(2)}</TableCell>
                    <TableCell className={cn("text-right text-xs py-1.5 px-2 font-semibold", 
                        p.prediction?.riskStatusPE === 'Ruptura Iminente' ? 'text-red-600' :
                        p.prediction?.riskStatusPE === 'Atenção' ? 'text-yellow-600' : ''
                    )}>
                      {p.prediction ? formatDaysToRuptureForDisplay(p.prediction.daysToRupturePE) : <Skeleton className="h-4 w-8 float-right" />}
                    </TableCell>
                    <TableCell className="text-center text-xs py-1.5 px-2">
                      {p.prediction ? (
                        <TooltipProvider delayDuration={300}>
                            <Tooltip>
                                <TooltipTrigger asChild>
                                    <span className="flex items-center justify-center">{getRiskStatusIcon(p.prediction.riskStatusPE)}</span>
                                </TooltipTrigger>
                                <TooltipContent><p>{p.prediction.riskStatusPE}</p></TooltipContent>
                            </Tooltip>
                        </TooltipProvider>
                      ) : <Skeleton className="h-5 w-12 mx-auto" />}
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.max(1, prev - 1))} disabled={currentPage === 1}><ChevronLeft className="mr-1 h-4 w-4"/>Anterior</Button>
                <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(prev => Math.min(totalPages, prev + 1))} disabled={currentPage === totalPages}>Próxima<ChevronRight className="ml-1 h-4 w-4"/></Button>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Component 3: Gráfico Preditivo com Linha do Tempo */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center"><LineChart className="mr-2 h-5 w-5 text-primary"/>Gráfico de Tendência por Produto</CardTitle>
          <CardDescription>Visualização da projeção de estoque vs. venda. (Em Desenvolvimento)</CardDescription>
        </CardHeader>
        <CardContent className="h-60 flex items-center justify-center text-muted-foreground">
            <Info className="mr-2 h-5 w-5"/> Funcionalidade futura.
        </CardContent>
      </Card>

      {/* Component 4: Ferramenta de Simulação de Reposição */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary"/>Ferramenta de Simulação de Reposição</CardTitle>
          <CardDescription>Calcule o impacto de novas reposições. (Em Desenvolvimento)</CardDescription>
        </CardHeader>
        <CardContent className="h-40 flex items-center justify-center text-muted-foreground">
            <Info className="mr-2 h-5 w-5"/> Funcionalidade futura.
        </CardContent>
      </Card>
    </div>
  );
}

