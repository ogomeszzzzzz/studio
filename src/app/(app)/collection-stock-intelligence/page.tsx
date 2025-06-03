
'use client';

import { useState, useMemo, useCallback, useEffect } from 'react';
import type { Product, FilterState, EnhancedProductForStockIntelligence, StockRiskStatus } from '@/types';
// ProductDataTableSection is no longer used directly for the main table in this version
// import { ProductDataTableSection } from '@/components/domain/ProductDataTableSection'; 
import { firestore, firestoreClientInitializationError } from '@/lib/firebase/config';
import { collection, getDocs, doc, Timestamp, query, getDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import {
  Loader2, Database, Brain, TrendingUp, AlertTriangle, PackageSearch, BarChart2, Settings2, Download, Filter as FilterIcon, ListFilter, Clock, AlertCircle, ShoppingBag, PackageX, ArrowUpRightSquare, PlusCircle, LineChart
} from 'lucide-react';
import { format as formatDateFns, isValid as isDateValid, differenceInDays, isAfter, addDays } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { ResponsiveContainer, LineChart as RechartsLineChart, Line as RechartsLineElement, CartesianGrid, XAxis, YAxis, Tooltip as RechartsTooltip, Legend as RechartsLegend, ReferenceLine } from 'recharts';
import { ChartContainer, ChartTooltipContent, type ChartConfig } from "@/components/ui/chart";
import { Skeleton } from '@/components/ui/skeleton';


const ALL_COLLECTIONS_VALUE = "_ALL_COLLECTIONS_";
const ALL_RISK_STATUS_VALUE = "_ALL_RISK_STATUS_";
const COVERAGE_TARGET_DAYS_REPLENISHMENT = 21; 
const ACTION_LIST_COVERAGE_TARGET_DAYS = 15; // For export suggestion

const productFromFirestore = (data: any): Product => {
  return {
    ...data,
    collectionStartDate: data.collectionStartDate instanceof Timestamp ? data.collectionStartDate.toDate() : null,
    collectionEndDate: data.collectionEndDate instanceof Timestamp ? data.collectionEndDate.toDate() : null,
  } as Product;
};

interface ProjectedChartDataPoint {
  dayLabel: string;
  dayNumber: number;
  stock: number | null;
  hasReplenishment?: boolean;
}

const chartConfig = {
  stock: {
    label: "Estoque Projetado (PE)",
    color: "hsl(var(--chart-1))",
  },
} satisfies ChartConfig;


export default function CollectionStockIntelligencePage() {
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [enhancedProducts, setEnhancedProducts] = useState<EnhancedProductForStockIntelligence[]>([]);
  const [filteredEnhancedProducts, setFilteredEnhancedProducts] = useState<EnhancedProductForStockIntelligence[]>([]);
  
  const [isLoadingPageData, setIsLoadingPageData] = useState(true);
  const [lastDataUpdateTimestamp, setLastDataUpdateTimestamp] = useState<Date | null>(null);

  const [searchTerm, setSearchTerm] = useState('');
  const [selectedCollectionFilter, setSelectedCollectionFilter] = useState<string>(ALL_COLLECTIONS_VALUE);
  const [selectedRiskStatusFilter, setSelectedRiskStatusFilter] = useState<StockRiskStatus | typeof ALL_RISK_STATUS_VALUE>(ALL_RISK_STATUS_VALUE);
  const [isExporting, setIsExporting] = useState(false);

  // State for Trend Chart and Simulation
  const [selectedProductForChart, setSelectedProductForChart] = useState<EnhancedProductForStockIntelligence | null>(null);
  const [simulationParams, setSimulationParams] = useState({
    salesAdjustment: 0,
    replenishmentAmount: 0,
    replenishmentDay: 0, // Days from today
  });
  const [projectedChartData, setProjectedChartData] = useState<ProjectedChartDataPoint[]>([]);
  const [projectedRuptureDayIndex, setProjectedRuptureDayIndex] = useState<number | null>(null);


  useEffect(() => {
    if (isAuthLoading) {
      setIsLoadingPageData(true);
      return;
    }
    if (firestoreClientInitializationError || !firestore) {
      toast({ title: "Erro Crítico de Configuração/Conexão Firebase", description: firestoreClientInitializationError || "Instância do Firestore não disponível.", variant: "destructive", duration: Infinity });
      setIsLoadingPageData(false);
      return;
    }

    if (currentUser) {
      if (allProducts.length === 0) {
        setIsLoadingPageData(true);
        const fetchProducts = async () => {
          try {
            const productsQuery = query(collection(firestore, "shared_products"));
            const snapshot = await getDocs(productsQuery);
            const productsFromDb: Product[] = snapshot.docs.map(docSnap => productFromFirestore(docSnap.data()));
            setAllProducts(productsFromDb);

            const metadataDocRef = doc(firestore, "app_metadata", "products_metadata");
            const metadataDocSnap = await getDoc(metadataDocRef);
            if (metadataDocSnap.exists()) {
              const data = metadataDocSnap.data();
              if (data.lastUpdatedAt && data.lastUpdatedAt instanceof Timestamp) {
                setLastDataUpdateTimestamp(data.lastUpdatedAt.toDate());
              }
            }
            if (productsFromDb.length === 0) {
              toast({ title: "Sem Dados no Sistema", description: "Nenhum produto encontrado. Faça upload no Dashboard.", variant: "default" });
            }
          } catch (error) {
            console.error("Error fetching products (Collection Intelligence):", error);
            toast({ title: "Erro ao Carregar Dados", description: `Não foi possível buscar os produtos: ${(error as Error).message}`, variant: "destructive" });
          } finally {
            setIsLoadingPageData(false);
          }
        };
        fetchProducts();
      } else {
        setIsLoadingPageData(false);
      }
    } else {
      setIsLoadingPageData(false);
      setAllProducts([]);
      setEnhancedProducts([]);
    }
  }, [currentUser, isAuthLoading, allProducts.length, toast]);

  useEffect(() => {
    if (allProducts.length === 0) {
      setEnhancedProducts([]);
      return;
    }

    const today = new Date();
    const processed: EnhancedProductForStockIntelligence[] = allProducts.map(p => {
      const dailyAverageSales = p.sales30d && p.sales30d > 0 ? p.sales30d / 30 : 0;
      const availableStockForCoverage = (p.readyToShip || 0) + (p.regulatorStock || 0);
      const estimatedCoverageDays = dailyAverageSales > 0 ? availableStockForCoverage / dailyAverageSales : null;
      const dailyDepletionRate = p.stock > 0 && dailyAverageSales > 0 ? (dailyAverageSales / p.stock) * 100 : null;

      let stockRiskStatus: StockRiskStatus = 'N/A';
      if (estimatedCoverageDays !== null) {
        if (estimatedCoverageDays < 7) stockRiskStatus = 'Alerta Crítico';
        else if (estimatedCoverageDays <= 14) stockRiskStatus = 'Risco Moderado';
        else stockRiskStatus = 'Estável';
      } else if (dailyAverageSales === 0 && p.stock > 0) {
        stockRiskStatus = 'Estável'; 
      }

      let recommendedReplenishment = 0;
      if (dailyAverageSales > 0) {
        const targetStock = dailyAverageSales * COVERAGE_TARGET_DAYS_REPLENISHMENT;
        recommendedReplenishment = Math.max(0, Math.round(targetStock - availableStockForCoverage - (p.openOrders || 0) ));
      }
      
      const isHighDemandLowCoverage = dailyAverageSales > 5 && (estimatedCoverageDays !== null && estimatedCoverageDays < 3);
      const isZeroSalesWithStock = dailyAverageSales === 0 && p.stock > 0;
      
      let isRecentCollectionFastDepletion = false;
      if (p.collectionStartDate && isDateValid(p.collectionStartDate)) {
          const daysSinceStart = differenceInDays(today, p.collectionStartDate);
          if (daysSinceStart >= 0 && daysSinceStart <= 15 && dailyDepletionRate !== null && dailyDepletionRate > 5) {
              isRecentCollectionFastDepletion = true;
          }
      }

      let priority: 1 | 2 | 3 | undefined;
      let automatedJustification = '';
      if (estimatedCoverageDays !== null) {
          if (estimatedCoverageDays < 5) {
              priority = 1;
              automatedJustification = `Ruptura Crítica! Cobertura PE+REG: ${estimatedCoverageDays.toFixed(1)} dias.`;
          } else if (estimatedCoverageDays < 10) {
              priority = 2;
              automatedJustification = `Risco Alto! Cobertura PE+REG: ${estimatedCoverageDays.toFixed(1)} dias.`;
          } else {
              priority = 3;
              automatedJustification = `Estoque estável ou ocioso. Cobertura PE+REG: ${estimatedCoverageDays.toFixed(1)} dias.`;
          }
      } else if (isZeroSalesWithStock) {
          priority = 3;
          automatedJustification = 'Estoque parado (sem vendas recentes).';
      }

      return {
        ...p,
        dailyAverageSales,
        estimatedCoverageDays,
        dailyDepletionRate,
        stockRiskStatus,
        recommendedReplenishment,
        isHighDemandLowCoverage,
        isZeroSalesWithStock,
        isRecentCollectionFastDepletion,
        priority,
        automatedJustification
      };
    });
    setEnhancedProducts(processed);
  }, [allProducts]);

  useEffect(() => {
    let tempFiltered = [...enhancedProducts];
    if (searchTerm) {
      tempFiltered = tempFiltered.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.vtexId).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    if (selectedCollectionFilter !== ALL_COLLECTIONS_VALUE) {
      tempFiltered = tempFiltered.filter(p => p.collection === selectedCollectionFilter);
    }
    if (selectedRiskStatusFilter !== ALL_RISK_STATUS_VALUE) {
      tempFiltered = tempFiltered.filter(p => p.stockRiskStatus === selectedRiskStatusFilter);
    }
    setFilteredEnhancedProducts(tempFiltered);
  }, [searchTerm, selectedCollectionFilter, selectedRiskStatusFilter, enhancedProducts]);

  const availableCollections = useMemo(() => Array.from(new Set(allProducts.map(p => p.collection).filter(Boolean))).sort(), [allProducts]);
  const riskStatuses: StockRiskStatus[] = ['Alerta Crítico', 'Risco Moderado', 'Estável', 'N/A'];

  const insights = useMemo(() => {
    return {
      ruptureUnder7Days: enhancedProducts.filter(p => p.estimatedCoverageDays !== null && p.estimatedCoverageDays < 7 && p.stockRiskStatus === 'Alerta Crítico'),
      stagnantStock: enhancedProducts.filter(p => p.isZeroSalesWithStock),
      fastDepletionRecent: enhancedProducts.filter(p => p.isRecentCollectionFastDepletion),
      dailySalesExceedsPE: enhancedProducts.filter(p => p.dailyAverageSales > 0 && p.readyToShip < p.dailyAverageSales && p.stockRiskStatus !== 'Estável'),
    };
  }, [enhancedProducts]);

  const actionListProducts = useMemo(() => {
    return enhancedProducts
      .filter(p => p.priority !== undefined)
      .sort((a, b) => (a.priority || 3) - (b.priority || 3) || (a.estimatedCoverageDays || Infinity) - (b.estimatedCoverageDays || Infinity));
  }, [enhancedProducts]);

  // Logic for Trend Chart & Simulation
  useEffect(() => {
    if (!selectedProductForChart) {
      setProjectedChartData([]);
      setProjectedRuptureDayIndex(null);
      return;
    }

    const projectionDays = 60;
    const data: ProjectedChartDataPoint[] = [];
    let currentSimulatedStock = selectedProductForChart.readyToShip || 0;
    const effectiveDailySales = (selectedProductForChart.dailyAverageSales || 0) + (simulationParams.salesAdjustment || 0);
    let ruptureDay: number | null = null;

    for (let i = 0; i <= projectionDays; i++) {
      let dayStock = currentSimulatedStock;
      let hasReplenishment = false;

      if (i > 0) { // Apply sales from day 1 onwards
        dayStock -= effectiveDailySales;
      }

      if (simulationParams.replenishmentAmount > 0 && i === simulationParams.replenishmentDay && i > 0) {
        dayStock += simulationParams.replenishmentAmount;
        hasReplenishment = true;
      }
      
      dayStock = Math.max(0, dayStock); // Stock cannot go below zero
      currentSimulatedStock = dayStock; // Update for next iteration's start

      data.push({
        dayLabel: `D${i}`,
        dayNumber: i,
        stock: dayStock,
        hasReplenishment,
      });

      if (dayStock === 0 && ruptureDay === null && effectiveDailySales > 0) {
        ruptureDay = i;
      }
    }
    setProjectedChartData(data);
    setProjectedRuptureDayIndex(ruptureDay);
  }, [selectedProductForChart, simulationParams]);

  const productsForChartSelection = useMemo(() => {
    return enhancedProducts.filter(p => (p.dailyAverageSales || 0) > 0 || (p.readyToShip || 0) > 0).sort((a,b) => a.name.localeCompare(b.name));
  }, [enhancedProducts]);

  const backofficeMetrics = useMemo(() => {
    if (filteredEnhancedProducts.length === 0) {
      return { avgCoverageDays: 0, criticalSkus: 0, moderateSkus: 0 };
    }
    const productsWithCoverage = filteredEnhancedProducts.filter(p => p.estimatedCoverageDays !== null && Number.isFinite(p.estimatedCoverageDays));
    const totalCoverageDays = productsWithCoverage.reduce((sum, p) => sum + (p.estimatedCoverageDays || 0), 0);
    
    return {
      avgCoverageDays: productsWithCoverage.length > 0 ? totalCoverageDays / productsWithCoverage.length : 0,
      criticalSkus: filteredEnhancedProducts.filter(p => p.stockRiskStatus === 'Alerta Crítico').length,
      moderateSkus: filteredEnhancedProducts.filter(p => p.stockRiskStatus === 'Risco Moderado').length,
    };
  }, [filteredEnhancedProducts]);


  const handleExportReplenishment = () => {
     if (actionListProducts.length === 0) {
      toast({ title: "Nenhum Dado para Exportar", description: "Não há produtos na lista de ações para exportar.", variant: "default" });
      return;
    }
    setIsExporting(true);
    toast({ title: "Exportando...", description: "Gerando sugestão de reposição." });

    const dataToExport = actionListProducts
        .filter(p => p.priority === 1 || p.priority === 2)
        .map(p => {
          const targetStockFor15dPE = (p.dailyAverageSales || 0) * ACTION_LIST_COVERAGE_TARGET_DAYS;
          const replenishmentSuggestion15d = Math.max(0, Math.round(targetStockFor15dPE - (p.readyToShip || 0) - (p.openOrders || 0)));
          return {
            "Produto": p.name,
            "ID VTEX": String(p.vtexId ?? ''),
            "Prioridade": p.priority,
            "Status Risco Estoque (PE+REG)": p.stockRiskStatus,
            "Cobertura Atual (PE+REG Dias)": p.estimatedCoverageDays?.toFixed(1) ?? 'N/A',
            "Estoque Total": p.stock,
            "Pronta Entrega": p.readyToShip,
            "Regulador": p.regulatorStock,
            "Pedidos em Aberto": p.openOrders,
            "Média Venda Diária": p.dailyAverageSales.toFixed(2),
            "Reposição Sugerida (p/ 15d PE)": replenishmentSuggestion15d,
            "Justificativa": p.automatedJustification,
            "Coleção": p.collection,
        }});

    try {
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "SugestaoReposicao");
      XLSX.writeFile(workbook, `Sugestao_Reposicao_Estoque_${formatDateFns(new Date(), 'yyyy-MM-dd')}.xlsx`);
      toast({ title: "Exportação Concluída", description: "A sugestão de reposição foi exportada." });
    } catch (error) {
      console.error("Erro ao exportar para Excel:", error);
      toast({ title: "Erro na Exportação", description: "Não foi possível gerar o arquivo Excel.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const handleSimulationParamChange = (param: keyof typeof simulationParams, value: string) => {
    const numValue = parseInt(value, 10);
    setSimulationParams(prev => ({
      ...prev,
      [param]: isNaN(numValue) ? 0 : numValue,
    }));
  };

  if (isLoadingPageData && allProducts.length === 0) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando dados...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <Brain className="mr-3 h-8 w-8 text-primary" />
            Inteligência de Estoque para Coleções
          </h1>
          <p className="text-muted-foreground">
            Análise de sortimento, cobertura, risco de ruptura e recomendações para coleções vigentes.
          </p>
        </div>
      </div>
      {lastDataUpdateTimestamp && (
        <div className="text-sm text-muted-foreground flex items-center">
          <Clock className="mr-2 h-4 w-4" />
          Dados de produtos atualizados em: {formatDateFns(lastDataUpdateTimestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
        </div>
      )}

      {allProducts.length === 0 && !isLoadingPageData && (
         <Card className="shadow-lg text-center py-10"><CardHeader><CardTitle className="flex items-center justify-center text-xl">
              <Database className="mr-2 h-7 w-7 text-primary" /> Sem Dados para Análise
            </CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Nenhum dado de produto encontrado. Faça upload de uma planilha na página do Dashboard.</p></CardContent></Card>
      )}

      {allProducts.length > 0 && (
        <>
          <Card className="shadow-sm border-dashed border-blue-500">
            <CardHeader>
                <CardTitle className="flex items-center text-blue-700"><Settings2 className="mr-2 h-5 w-5"/>Configurações e Importação Avançada de Dados</CardTitle>
            </CardHeader>
            <CardContent>
                <p className="text-sm text-muted-foreground">
                    Esta seção será futuramente utilizada para importação regular de dados de vendas diárias (Componente 6) e outras configurações específicas para esta tela de inteligência.
                    <br />
                    Atualmente, os cálculos (como Média Diária de Venda) são baseados no campo "Venda nos Últimos 30 Dias" da planilha principal carregada no Dashboard.
                </p>
            </CardContent>
          </Card>

          <Card className="shadow-md">
            <CardHeader>
              <CardTitle className="flex items-center"><AlertTriangle className="mr-2 h-5 w-5 text-amber-500" />Alertas e Insights Chave</CardTitle>
            </CardHeader>
            <CardContent className="space-y-3">
              {isLoadingPageData && enhancedProducts.length === 0 && <p><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Analisando...</p>}
              {!isLoadingPageData && Object.values(insights).every(arr => arr.length === 0) && <p className="text-muted-foreground">Nenhum alerta crítico ou insight relevante no momento com base nos dados atuais.</p>}
              
              {insights.ruptureUnder7Days.length > 0 && (
                <div className="p-3 border border-destructive rounded-md bg-destructive/5">
                  <h4 className="font-semibold text-destructive flex items-center"><PackageX className="mr-2 h-5 w-5"/>Risco de Ruptura (PE+REG &lt; 7 dias): {insights.ruptureUnder7Days.length} SKU(s)</h4>
                  <ul className="list-disc list-inside text-sm text-destructive/90 max-h-32 overflow-y-auto">
                    {insights.ruptureUnder7Days.slice(0,5).map(p => <li key={p.vtexId}>{p.name} ({p.estimatedCoverageDays?.toFixed(1)}d)</li>)}
                    {insights.ruptureUnder7Days.length > 5 && <li>E mais {insights.ruptureUnder7Days.length - 5}...</li>}
                  </ul>
                </div>
              )}
              {insights.stagnantStock.length > 0 && (
                <div className="p-3 border border-blue-500 rounded-md bg-blue-500/5">
                  <h4 className="font-semibold text-blue-700 flex items-center"><ShoppingBag className="mr-2 h-5 w-5"/>Estoque Parado (Venda 30d = 0): {insights.stagnantStock.length} SKU(s)</h4>
                   <ul className="list-disc list-inside text-sm text-blue-600/90 max-h-32 overflow-y-auto">
                    {insights.stagnantStock.slice(0,5).map(p => <li key={p.vtexId}>{p.name} (Est: {p.stock})</li>)}
                    {insights.stagnantStock.length > 5 && <li>E mais {insights.stagnantStock.length - 5}...</li>}
                  </ul>
                </div>
              )}
              {insights.dailySalesExceedsPE.length > 0 && (
                <div className="p-3 border border-orange-500 rounded-md bg-orange-500/5">
                  <h4 className="font-semibold text-orange-600 flex items-center"><AlertCircle className="mr-2 h-5 w-5"/>Venda Diária &gt; Pronta Entrega: {insights.dailySalesExceedsPE.length} SKU(s)</h4>
                  <ul className="list-disc list-inside text-sm text-orange-500/90 max-h-32 overflow-y-auto">
                    {insights.dailySalesExceedsPE.slice(0,5).map(p => <li key={p.vtexId}>{p.name} (VMD: {p.dailyAverageSales.toFixed(1)}, PE: {p.readyToShip})</li>)}
                    {insights.dailySalesExceedsPE.length > 5 && <li>E mais {insights.dailySalesExceedsPE.length - 5}...</li>}
                  </ul>
                </div>
              )}
              {insights.fastDepletionRecent.length > 0 && (
                <div className="p-3 border border-purple-500 rounded-md bg-purple-500/5">
                  <h4 className="font-semibold text-purple-700 flex items-center"><TrendingUp className="mr-2 h-5 w-5"/>Saída Acelerada (Início Coleção): {insights.fastDepletionRecent.length} SKU(s)</h4>
                   <ul className="list-disc list-inside text-sm text-purple-600/90 max-h-32 overflow-y-auto">
                    {insights.fastDepletionRecent.slice(0,5).map(p => <li key={p.vtexId}>{p.name} (Esgot./dia: {p.dailyDepletionRate?.toFixed(1)}%)</li>)}
                    {insights.fastDepletionRecent.length > 5 && <li>E mais {insights.fastDepletionRecent.length - 5}...</li>}
                  </ul>
                </div>
              )}
            </CardContent>
          </Card>
          
          <div className="grid md:grid-cols-2 gap-6">
            {/* Component 4: Gráfico de Tendência e Simulação */}
            <Card className="shadow-lg">
              <CardHeader>
                <CardTitle className="flex items-center">
                  <LineChart className="mr-2 h-5 w-5 text-primary" />
                  Gráfico de Tendência de Estoque (Pronta Entrega) e Simulação
                </CardTitle>
                <CardDescription>Selecione um produto e simule ajustes para visualizar o impacto no estoque.</CardDescription>
              </CardHeader>
              <CardContent className="space-y-4">
                <div>
                  <Label htmlFor="productChartSelect">Selecionar Produto para Gráfico</Label>
                  <Select
                    value={selectedProductForChart?.vtexId ? String(selectedProductForChart.vtexId) : ""}
                    onValueChange={(value) => {
                      const product = productsForChartSelection.find(p => String(p.vtexId) === value);
                      setSelectedProductForChart(product || null);
                    }}
                  >
                    <SelectTrigger id="productChartSelect" className="mt-1">
                      <SelectValue placeholder="Selecione um produto..." />
                    </SelectTrigger>
                    <SelectContent>
                      {productsForChartSelection.length > 0 ? (
                        productsForChartSelection.map(p => (
                          <SelectItem key={String(p.vtexId)} value={String(p.vtexId)}>
                            {p.name} (PE: {p.readyToShip}, VMD: {p.dailyAverageSales.toFixed(1)})
                          </SelectItem>
                        ))
                      ) : (
                        <SelectItem value="" disabled>Nenhum produto com vendas para projetar</SelectItem>
                      )}
                    </SelectContent>
                  </Select>
                </div>

                {selectedProductForChart && (
                  <>
                    <div className="grid grid-cols-1 sm:grid-cols-3 gap-3 text-xs">
                      <div>
                        <Label htmlFor="salesAdjustment">Ajuste Venda Diária (+/-)</Label>
                        <Input id="salesAdjustment" type="number" value={simulationParams.salesAdjustment} onChange={(e) => handleSimulationParamChange('salesAdjustment', e.target.value)} placeholder="Ex: 5 ou -2" className="mt-1"/>
                      </div>
                      <div>
                        <Label htmlFor="replenishmentAmount">Reposição (Unidades)</Label>
                        <Input id="replenishmentAmount" type="number" value={simulationParams.replenishmentAmount} onChange={(e) => handleSimulationParamChange('replenishmentAmount', e.target.value)} placeholder="Ex: 50" className="mt-1" min="0"/>
                      </div>
                      <div>
                        <Label htmlFor="replenishmentDay">Dia Chegada Reposição</Label>
                        <Input id="replenishmentDay" type="number" value={simulationParams.replenishmentDay} onChange={(e) => handleSimulationParamChange('replenishmentDay', e.target.value)} placeholder="Ex: 10 (dias de hoje)" className="mt-1" min="0" max="60"/>
                      </div>
                    </div>
                    <div className="h-[300px] w-full mt-2">
                      <ChartContainer config={chartConfig} className="h-full w-full">
                        <RechartsLineChart data={projectedChartData} margin={{ top: 5, right: 20, bottom: 5, left: -20 }}>
                          <CartesianGrid strokeDasharray="3 3" vertical={false} />
                          <XAxis dataKey="dayLabel" tick={{ fontSize: 10 }} interval={6}/>
                          <YAxis tickFormatter={(value) => value.toLocaleString()} tick={{ fontSize: 10 }} domain={['auto', 'auto']}/>
                          <RechartsTooltip
                            content={<ChartTooltipContent 
                              indicator="line"
                              formatter={(value, name, props) => {
                                const point = props.payload as ProjectedChartDataPoint | undefined;
                                let label = `${value.toLocaleString()} unidades`;
                                if (point?.hasReplenishment) {
                                  label += ` (+${simulationParams.replenishmentAmount} reposição)`;
                                }
                                return [label, "Estoque PE Projetado"];
                              }}
                            />}
                          />
                          <RechartsLineElement type="monotone" dataKey="stock" stroke="hsl(var(--chart-1))" strokeWidth={2} dot={false} name="Estoque PE Projetado"/>
                          <ReferenceLine y={0} stroke="hsl(var(--destructive))" strokeDasharray="3 3" strokeWidth={1.5} />
                          {projectedRuptureDayIndex !== null && projectedRuptureDayIndex <= 60 && (
                             <ReferenceLine 
                                x={projectedChartData[projectedRuptureDayIndex]?.dayLabel} 
                                stroke="hsl(var(--destructive))" 
                                strokeWidth={1.5}
                                label={{ value: `Ruptura D${projectedRuptureDayIndex}`, position: "insideTopRight", fill: "hsl(var(--destructive))", fontSize: 10, dy: -5 }} 
                              />
                          )}
                        </RechartsLineChart>
                      </ChartContainer>
                    </div>
                  </>
                )}
                {!selectedProductForChart && <p className="text-sm text-muted-foreground text-center py-4">Selecione um produto acima para visualizar a projeção de estoque.</p>}
              </CardContent>
            </Card>

            {/* Component 7: Backoffice de Cobertura da Coleção */}
            <Card className="shadow-lg">
                <CardHeader>
                    <CardTitle className="flex items-center"><BarChart2 className="mr-2 h-5 w-5 text-primary"/>Visão Geral da Cobertura e Riscos (PE)</CardTitle>
                    <CardDescription>Métricas agregadas sobre a saúde do estoque de Pronta Entrega com base nos filtros atuais.</CardDescription>
                </CardHeader>
                <CardContent className="space-y-3">
                    {isLoadingPageData && filteredEnhancedProducts.length === 0 ? (
                        <Skeleton className="h-8 w-3/4 my-2" count={3} />
                    ): filteredEnhancedProducts.length > 0 ? (
                        <>
                            <div className="flex justify-between items-center p-3 bg-muted/50 rounded-md">
                                <span className="font-medium text-sm">Média de Cobertura (PE Geral):</span>
                                <span className="font-bold text-lg text-primary">{backofficeMetrics.avgCoverageDays.toFixed(1)} dias</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-destructive/10 rounded-md">
                                <span className="font-medium text-sm text-destructive">SKUs em Alerta Crítico (PE):</span>
                                <span className="font-bold text-lg text-destructive">{backofficeMetrics.criticalSkus}</span>
                            </div>
                            <div className="flex justify-between items-center p-3 bg-amber-500/10 rounded-md">
                                <span className="font-medium text-sm text-amber-700">SKUs em Risco Moderado (PE):</span>
                                <span className="font-bold text-lg text-amber-700">{backofficeMetrics.moderateSkus}</span>
                            </div>
                        </>
                    ) : (
                         <p className="text-sm text-muted-foreground">Nenhum produto corresponde aos filtros para exibir métricas de cobertura.</p>
                    )}
                     <p className="text-xs text-muted-foreground pt-2">
                        Métricas avançadas como "% vendida da coleção" e "data de esgotamento da coleção" estão em desenvolvimento e exigirão dados de histórico de vendas ou estoque inicial da coleção.
                    </p>
                </CardContent>
            </Card>
          </div>

          <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center"><ListFilter className="mr-2 h-5 w-5 text-primary" />Lista de Ações Priorizadas</CardTitle>
                <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
                    <CardDescription>SKUs priorizados por risco de ruptura da cobertura de Pronta Entrega + Regulador.</CardDescription>
                    <Button onClick={handleExportReplenishment} disabled={actionListProducts.filter(p => p.priority === 1 || p.priority === 2).length === 0 || isExporting || isLoadingPageData} size="sm">
                        {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
                        Exportar Sugestão (P1 & P2)
                    </Button>
                </div>
            </CardHeader>
            <CardContent>
                 {isLoadingPageData && actionListProducts.length === 0 && <p><Loader2 className="inline mr-2 h-4 w-4 animate-spin" />Processando ações...</p>}
                 {!isLoadingPageData && actionListProducts.length === 0 && <p className="text-muted-foreground">Nenhuma ação prioritária identificada no momento.</p>}
                 {actionListProducts.length > 0 && (
                    <div className="overflow-x-auto rounded-md border max-h-96">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="w-[50px]">Prio.</TableHead>
                                    <TableHead>Produto</TableHead>
                                    <TableHead className="text-right">Cobertura (PE+REG)</TableHead>
                                    <TableHead>Justificativa</TableHead>
                                    <TableHead className="text-right">Repor (p/ {COVERAGE_TARGET_DAYS_REPLENISHMENT}d)</TableHead>
                                    <TableHead className="text-center">Ação</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {actionListProducts.slice(0, 15).map(p => ( 
                                    <TableRow key={String(p.vtexId)} className={
                                        p.priority === 1 ? 'bg-red-500/10 hover:bg-red-500/20' :
                                        p.priority === 2 ? 'bg-amber-500/10 hover:bg-amber-500/20' : ''
                                    }>
                                        <TableCell className="font-bold text-center">{p.priority === 1 ? '🔴 1' : p.priority === 2 ? '🟡 2' : '🟢 3'}</TableCell>
                                        <TableCell className="font-medium text-xs">{p.name}</TableCell>
                                        <TableCell className="text-right text-xs">{p.estimatedCoverageDays?.toFixed(1) ?? 'N/A'} dias</TableCell>
                                        <TableCell className="text-xs italic text-muted-foreground">{p.automatedJustification}</TableCell>
                                        <TableCell className="text-right text-xs font-semibold">{p.recommendedReplenishment > 0 ? p.recommendedReplenishment : '-'}</TableCell>
                                        <TableCell className="text-center">
                                            <Button variant="outline" size="xs" disabled><PlusCircle className="mr-1 h-3 w-3"/>Sugerir Compra</Button>
                                        </TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                 )}
                 {actionListProducts.length > 15 && <p className="text-xs text-muted-foreground mt-2 text-center">Exibindo os primeiros 15 itens priorizados. Exporte para ver a lista completa.</p>}
            </CardContent>
          </Card>
          
           <Card className="shadow-sm">
            <CardHeader className="pb-3">
              <CardTitle className="flex items-center"><FilterIcon className="mr-2 h-5 w-5 text-primary" />Filtrar Análise Detalhada</CardTitle>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-3 gap-4">
              <div>
                <Label htmlFor="searchTermTable">Buscar Produto (Nome/ID)</Label>
                <Input id="searchTermTable" placeholder="Digite nome ou ID..." value={searchTerm} onChange={(e) => setSearchTerm(e.target.value)} className="mt-1" />
              </div>
              <div>
                <Label htmlFor="collectionFilterTable">Filtrar por Coleção</Label>
                <Select value={selectedCollectionFilter} onValueChange={setSelectedCollectionFilter}>
                  <SelectTrigger id="collectionFilterTable" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_COLLECTIONS_VALUE}>Todas as Coleções</SelectItem>
                    {availableCollections.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
              <div>
                <Label htmlFor="riskStatusFilterTable">Filtrar por Status de Risco (PE+REG)</Label>
                <Select value={selectedRiskStatusFilter} onValueChange={(val) => setSelectedRiskStatusFilter(val as any)}>
                  <SelectTrigger id="riskStatusFilterTable" className="mt-1"><SelectValue /></SelectTrigger>
                  <SelectContent>
                    <SelectItem value={ALL_RISK_STATUS_VALUE}>Todos os Status</SelectItem>
                    {riskStatuses.map(s => <SelectItem key={s} value={s}>{s === 'Alerta Crítico' ? '🔴 ' : s === 'Risco Moderado' ? '🟡 ' : s === 'Estável' ? '🟢 ' : ''}{s}</SelectItem>)}
                  </SelectContent>
                </Select>
              </div>
            </CardContent>
          </Card>

          <Card>
            <CardHeader>
                <CardTitle className="flex items-center"><PackageSearch className="mr-2 h-5 w-5 text-primary"/>Visão Detalhada de Produtos e Projeções (PE+REG)</CardTitle>
                <CardDescription>Clique nos cabeçalhos para ordenar. Cobertura e Risco baseados em Pronta Entrega + Regulador.</CardDescription>
            </CardHeader>
            <CardContent>
                {isLoadingPageData && filteredEnhancedProducts.length === 0 && <p className="flex items-center justify-center py-4"><Loader2 className="inline mr-2 h-5 w-5 animate-spin" />Carregando tabela detalhada...</p>}
                {!isLoadingPageData && filteredEnhancedProducts.length === 0 && <p className="text-muted-foreground text-center py-4">Nenhum produto encontrado para os filtros atuais.</p>}
                {filteredEnhancedProducts.length > 0 && (
                    <div className="overflow-x-auto rounded-md border">
                        <Table>
                            <TableHeader>
                                <TableRow>
                                    <TableHead className="min-w-[200px]">Produto</TableHead>
                                    <TableHead className="text-right">Est.Total</TableHead>
                                    <TableHead className="text-right text-green-600">P.Entrega</TableHead>
                                    <TableHead className="text-right text-orange-600">Regulador</TableHead>
                                    <TableHead className="text-right text-blue-600">Ped.Aberto</TableHead>
                                    <TableHead className="text-right">Preço</TableHead>
                                    <TableHead className="text-right">Venda 30d</TableHead>
                                    <TableHead className="text-right font-semibold">Média Venda Dia</TableHead>
                                    <TableHead className="text-right font-semibold">Cobertura (PE+REG)</TableHead>
                                    <TableHead className="text-center font-semibold">Status Risco (PE+REG)</TableHead>
                                    <TableHead className="text-right font-semibold">Repor (p/ {COVERAGE_TARGET_DAYS_REPLENISHMENT}d)</TableHead>
                                </TableRow>
                            </TableHeader>
                            <TableBody>
                                {filteredEnhancedProducts.slice(0,50).map(p => ( 
                                    <TableRow key={String(p.vtexId)}>
                                        <TableCell className="font-medium text-xs max-w-xs truncate" title={p.name}>{p.name}</TableCell>
                                        <TableCell className="text-right text-xs">{p.stock.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-xs text-green-700 font-medium">{p.readyToShip.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-xs text-orange-700 font-medium">{p.regulatorStock.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-xs text-blue-700 font-medium">{p.openOrders.toLocaleString()}</TableCell>
                                        <TableCell className="text-right text-xs">{p.price?.toLocaleString('pt-BR', {style:'currency', currency:'BRL'}) ?? 'N/A'}</TableCell>
                                        <TableCell className="text-right text-xs">{p.sales30d?.toLocaleString() ?? 'N/A'}</TableCell>
                                        <TableCell className="text-right text-xs font-semibold">{p.dailyAverageSales.toFixed(2)}</TableCell>
                                        <TableCell className="text-right text-xs font-semibold">{p.estimatedCoverageDays?.toFixed(1) ?? (p.dailyAverageSales === 0 ? '∞ (Sem Venda)' : '0.0') } dias</TableCell>
                                        <TableCell className="text-center text-xs">
                                            <Badge variant={
                                                p.stockRiskStatus === 'Alerta Crítico' ? 'destructive' :
                                                p.stockRiskStatus === 'Risco Moderado' ? 'default' : 
                                                p.stockRiskStatus === 'Estável' ? 'default' : 'outline' 
                                            } className={
                                                p.stockRiskStatus === 'Risco Moderado' ? 'bg-amber-500 hover:bg-amber-600 text-white' : 
                                                p.stockRiskStatus === 'Estável' ? 'bg-green-600 hover:bg-green-700 text-white' : ''
                                            }>
                                                {p.stockRiskStatus === 'Alerta Crítico' ? '🔴 ' : p.stockRiskStatus === 'Risco Moderado' ? '🟡 ' : p.stockRiskStatus === 'Estável' ? '🟢 ' : ''}
                                                {p.stockRiskStatus}
                                            </Badge>
                                        </TableCell>
                                        <TableCell className="text-right text-xs font-bold text-indigo-600">{p.recommendedReplenishment > 0 ? p.recommendedReplenishment.toLocaleString() : '-'}</TableCell>
                                    </TableRow>
                                ))}
                            </TableBody>
                        </Table>
                    </div>
                )}
                {filteredEnhancedProducts.length > 50 && <p className="text-xs text-muted-foreground mt-2 text-center">Exibindo os primeiros 50 produtos. Use filtros para refinar ou exporte para ver todos.</p>}
            </CardContent>
          </Card>
        </>
      )}
    </div>
  );
}
