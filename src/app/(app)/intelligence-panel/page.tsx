
'use client';

import { useState, useEffect, useMemo, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Badge } from '@/components/ui/badge';
import { AlertTriangle, ArrowUpDown, BarChart3, Brain, CalendarDays, AlertCircle, Clock, DollarSign, Download, Filter as FilterIcon, HelpCircle, TrendingDown, TrendingUp, PackageSearch, PieChart, ListFilter, CheckSquare, Lightbulb, Settings, Eye, Info, LineChart, ShoppingCart } from 'lucide-react';
import { Loader2 } from 'lucide-react';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types';
import { firestore, firestoreClientInitializationError } from '@/lib/firebase/config';
import { collection, getDocs, doc, Timestamp, query, getDoc } from 'firebase/firestore';
import { useAuth } from '@/contexts/AuthContext';
import { format as formatDateFns, isValid as isDateValid } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import * as XLSX from 'xlsx';
import { predictLogistics, type LogisticsPredictionInput, type LogisticsPredictionOutput } from '@/ai/flows/logistics-predictor-flow';
import { Tooltip, TooltipContent, TooltipProvider, TooltipTrigger } from "@/components/ui/tooltip";
import { Skeleton } from '@/components/ui/skeleton';


const ALL_COLLECTIONS_VALUE = "_ALL_COLLECTIONS_INTEL_";
const ALL_PRODUCT_TYPES_VALUE = "_ALL_PRODUCT_TYPES_INTEL_";
const ALL_RISK_STATUS_VALUE = "_ALL_RISK_STATUS_INTEL_";

const productFromFirestore = (data: any): Product => {
  return {
    ...data,
    collectionStartDate: data.collectionStartDate instanceof Timestamp ? data.collectionStartDate.toDate() : null,
    collectionEndDate: data.collectionEndDate instanceof Timestamp ? data.collectionEndDate.toDate() : null,
  } as Product;
};

interface EnhancedProduct extends Product {
  prediction?: LogisticsPredictionOutput;
  sales7d?: number;
  sales15d?: number;
  scoreGiroCobertura?: number; // Placeholder
}

const formatDaysToRuptureForDisplay = (days: number | null | undefined): string => {
  if (days === Infinity || days === null || days === undefined) {
    return 'N/A (Sem Venda)';
  }
  if (typeof days === 'number') {
    return days.toFixed(0);
  }
  return '...';
};


export default function IntelligencePanelPage() {
  const { currentUser, isLoading: isAuthLoading } = useAuth();
  const { toast } = useToast();

  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [enhancedProducts, setEnhancedProducts] = useState<EnhancedProduct[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);
  const [isLoadingPredictions, setIsLoadingPredictions] = useState(false);
  const [lastDataUpdateTimestamp, setLastDataUpdateTimestamp] = useState<Date | null>(null);

  const [selectedCollection, setSelectedCollection] = useState<string>(ALL_COLLECTIONS_VALUE);
  const [selectedProductType, setSelectedProductType] = useState<string>(ALL_PRODUCT_TYPES_VALUE);
  const [selectedRiskStatus, setSelectedRiskStatus] = useState<string>(ALL_RISK_STATUS_VALUE);
  const [searchTerm, setSearchTerm] = useState('');
  
  const [sortKey, setSortKey] = useState<keyof EnhancedProduct | 'daysToRupture' | ''>('name');
  const [sortOrder, setSortOrder] = useState<'asc' | 'desc'>('asc');
  const [currentPage, setCurrentPage] = useState(1);
  const itemsPerPage = 15;


  useEffect(() => {
    if (isAuthLoading) return;
    if (firestoreClientInitializationError || !firestore) {
      toast({ title: "Erro de Conexão", description: firestoreClientInitializationError || "Firestore não disponível.", variant: "destructive" });
      setIsLoadingFirestore(false);
      return;
    }
    if (currentUser && allProducts.length === 0) {
      setIsLoadingFirestore(true);
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
            if (data.lastUpdatedAt instanceof Timestamp) setLastDataUpdateTimestamp(data.lastUpdatedAt.toDate());
          }
        } catch (error) {
          toast({ title: "Erro ao Carregar Produtos", description: (error as Error).message, variant: "destructive" });
        } finally {
          setIsLoadingFirestore(false);
        }
      };
      fetchProducts();
    } else if (!currentUser) {
      setAllProducts([]);
      setEnhancedProducts([]);
      setIsLoadingFirestore(false);
    }
  }, [currentUser, isAuthLoading, allProducts.length, toast]);

  const fetchPredictionsForProducts = useCallback(async (productsToPredict: Product[]) => {
    if (productsToPredict.length === 0) {
      setEnhancedProducts([]);
      return;
    }
    setIsLoadingPredictions(true);
    const predictionsPromises = productsToPredict.map(async (p) => {
      try {
        const predictionInput: LogisticsPredictionInput = {
          productId: String(p.vtexId) || p.name,
          currentStock: p.stock,
          sales30d: p.sales30d || 0,
          price: p.price || 0,
          productName: p.name,
          readyToShipStock: p.readyToShip,
          regulatorStock: p.regulatorStock,
          openOrders: p.openOrders,
        };
        const predictionResult = await predictLogistics(predictionInput);
        return { ...p, prediction: predictionResult };
      } catch (error) {
        console.error(`Error fetching prediction for ${p.name}:`, error);
        return { ...p, prediction: undefined }; // Handle individual errors
      }
    });

    const results = await Promise.all(predictionsPromises);
    setEnhancedProducts(results.map(ep => ({
      ...ep,
      sales7d: ep.sales30d ? parseFloat((ep.sales30d / 30 * 7).toFixed(1)) : 0, // Simplified
      sales15d: ep.sales30d ? parseFloat((ep.sales30d / 30 * 15).toFixed(1)) : 0, // Simplified
      scoreGiroCobertura: Math.floor(Math.random() * 30) + 70, // Placeholder score
    })));
    setIsLoadingPredictions(false);
  }, []);

  useEffect(() => {
    if (allProducts.length > 0) {
      fetchPredictionsForProducts(allProducts);
    } else {
      setEnhancedProducts([]);
    }
  }, [allProducts, fetchPredictionsForProducts]);


  const filteredAndSortedProducts = useMemo(() => {
    let tempProducts = [...enhancedProducts];

    if (selectedCollection !== ALL_COLLECTIONS_VALUE) {
      tempProducts = tempProducts.filter(p => p.collection === selectedCollection);
    }
    if (selectedProductType !== ALL_PRODUCT_TYPES_VALUE) {
      tempProducts = tempProducts.filter(p => p.productType === selectedProductType);
    }
    if (selectedRiskStatus !== ALL_RISK_STATUS_VALUE) {
      tempProducts = tempProducts.filter(p => p.prediction?.riskStatus === selectedRiskStatus);
    }
    if (searchTerm) {
      tempProducts = tempProducts.filter(p =>
        p.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
        String(p.vtexId).toLowerCase().includes(searchTerm.toLowerCase())
      );
    }
    
    if (sortKey) {
        tempProducts.sort((a, b) => {
            let valA, valB;
            if (sortKey === 'daysToRupture') {
                // Handle null by treating it like Infinity for sorting purposes
                valA = a.prediction?.daysToRupture === null ? Infinity : a.prediction?.daysToRupture ?? Infinity;
                valB = b.prediction?.daysToRupture === null ? Infinity : b.prediction?.daysToRupture ?? Infinity;
            } else {
                valA = a[sortKey as keyof EnhancedProduct];
                valB = b[sortKey as keyof EnhancedProduct];
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
  }, [enhancedProducts, selectedCollection, selectedProductType, selectedRiskStatus, searchTerm, sortKey, sortOrder]);

  const paginatedProducts = useMemo(() => {
    const startIndex = (currentPage - 1) * itemsPerPage;
    return filteredAndSortedProducts.slice(startIndex, startIndex + itemsPerPage);
  }, [filteredAndSortedProducts, currentPage, itemsPerPage]);

  const totalPages = Math.ceil(filteredAndSortedProducts.length / itemsPerPage);

  const handleSort = (key: keyof EnhancedProduct | 'daysToRupture') => {
    if (sortKey === key) {
      setSortOrder(prev => prev === 'asc' ? 'desc' : 'asc');
    } else {
      setSortKey(key);
      setSortOrder('asc');
    }
    setCurrentPage(1);
  };

  const renderSortIcon = (key: keyof EnhancedProduct | 'daysToRupture') => {
    if (sortKey === key) {
      return sortOrder === 'asc' ? <ArrowUpDown className="h-3 w-3 inline ml-1 transform rotate-180" /> : <ArrowUpDown className="h-3 w-3 inline ml-1" />;
    }
    return <ArrowUpDown className="h-3 w-3 inline ml-1 opacity-30" />;
  };


  const availableCollections = useMemo(() => Array.from(new Set(allProducts.map(p => p.collection).filter(Boolean))).sort(), [allProducts]);
  const availableProductTypes = useMemo(() => Array.from(new Set(allProducts.map(p => p.productType).filter(Boolean))).sort(), [allProducts]);
  const riskStatusOptions = ['Baixo', 'Médio', 'Alto', 'Crítico', 'N/A'];

  // --- Component 1: Dashboard Analítico com IA ---
  const analyticalDashboardData = useMemo(() => {
    if (isLoadingPredictions || enhancedProducts.length === 0) {
      return {
        ruptura3d: { count: 0, icon: <Loader2 className="h-5 w-5 animate-spin" /> },
        ruptura7d: { count: 0, icon: <Loader2 className="h-5 w-5 animate-spin" /> },
        ruptura15d: { count: 0, icon: <Loader2 className="h-5 w-5 animate-spin" /> },
        volumeRisco: { value: 0, icon: <Loader2 className="h-5 w-5 animate-spin" /> },
        altoGiroBaixaCobertura: { count: 0, icon: <Loader2 className="h-5 w-5 animate-spin" /> },
        superestoque: { count: 0, icon: <Loader2 className="h-5 w-5 animate-spin" /> },
        coberturaMediaDias: { value: 0, icon: <Loader2 className="h-5 w-5 animate-spin" /> },
        indiceExecucaoPedidos: { value: 0, icon: <Loader2 className="h-5 w-5 animate-spin" /> },
      };
    }

    const productsWithSalesAndPrediction = enhancedProducts.filter(p => (p.sales30d || 0) > 0 && p.prediction && (p.prediction.daysToRupture !== null && p.prediction.daysToRupture !== Infinity));
    const coberturaMediaDias = productsWithSalesAndPrediction.length > 0
        ? productsWithSalesAndPrediction.reduce((sum, p) => sum + (p.prediction!.daysToRupture!), 0) / productsWithSalesAndPrediction.length
        : 0;

    const getRuptureCount = (days: number) => enhancedProducts.filter(p => p.prediction && p.prediction.daysToRupture !== null && p.prediction.daysToRupture !== Infinity && p.prediction.daysToRupture <= days).length;

    const volumeRisco = enhancedProducts.filter(p => p.prediction?.riskStatus === 'Alto' || p.prediction?.riskStatus === 'Crítico')
                           .reduce((sum, p) => sum + ((p.price || 0) * (p.sales30d || 0)),0);
    const altoGiroBaixaCobertura = enhancedProducts.filter(p => (p.sales30d || 0) > 20 && p.prediction && p.prediction.daysToRupture !== null && p.prediction.daysToRupture !== Infinity && p.prediction.daysToRupture < 7).length;
    const superestoque = enhancedProducts.filter(p => p.stock > 100 && (p.sales30d || 0) < 5).length;
    const indiceExecucaoPedidos = "95%"; // Placeholder

    return {
      ruptura3d: { count: getRuptureCount(3), icon: <AlertTriangle className="h-5 w-5 text-red-500" />, color: 'text-red-600' },
      ruptura7d: { count: getRuptureCount(7), icon: <AlertCircle className="h-5 w-5 text-orange-500" />, color: 'text-orange-600' },
      ruptura15d: { count: getRuptureCount(15), icon: <TrendingDown className="h-5 w-5 text-yellow-500" />, color: 'text-yellow-600' },
      volumeRisco: { value: volumeRisco, icon: <DollarSign className="h-5 w-5 text-red-500" />, color: 'text-red-600', isCurrency: true },
      altoGiroBaixaCobertura: { count: altoGiroBaixaCobertura, icon: <TrendingUp className="h-5 w-5 text-orange-500" />, color: 'text-orange-600' },
      superestoque: { count: superestoque, icon: <PackageSearch className="h-5 w-5 text-blue-500" />, color: 'text-blue-600' },
      coberturaMediaDias: { value: coberturaMediaDias, icon: <CalendarDays className="h-5 w-5 text-green-500" />, color: 'text-green-600', isDays: true },
      indiceExecucaoPedidos: { value: indiceExecucaoPedidos, icon: <CheckSquare className="h-5 w-5 text-green-500" />, color: 'text-green-600' },
    };
  }, [enhancedProducts, isLoadingPredictions]);

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const displayGlobalLoader = (isLoadingFirestore || isAuthLoading) && allProducts.length === 0;

  if (displayGlobalLoader) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando dados iniciais...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <Brain className="mr-3 h-8 w-8 text-primary" />
            Painel de Inteligência Logística e Comercial
          </h1>
          <p className="text-muted-foreground">
            Previsões, alertas e sugestões para otimizar estoque e decisões comerciais.
          </p>
        </div>
      </div>
       {lastDataUpdateTimestamp && (
        <div className="text-sm text-muted-foreground flex items-center">
            <Clock className="mr-2 h-4 w-4" />
            Dados dos produtos atualizados em: {formatDateFns(lastDataUpdateTimestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
        </div>
      )}

      {/* Component 1: Dashboard Analítico com IA */}
      <Card className="shadow-lg border-l-4 border-primary">
        <CardHeader>
          <CardTitle className="flex items-center"><BarChart3 className="mr-2 h-5 w-5 text-primary" />Dashboard Analítico com IA</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-2 md:grid-cols-3 lg:grid-cols-4 gap-4">
          {Object.entries(analyticalDashboardData).map(([key, item]) => (
            <Card key={key} className="shadow-sm hover:shadow-md transition-shadow">
              <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-1 pt-3 px-4">
                <CardTitle className="text-xs font-medium uppercase text-muted-foreground">
                  {key.replace(/([A-Z])/g, ' $1').replace(/^./, str => str.toUpperCase())}
                </CardTitle>
                {isLoadingPredictions && !item.icon.type.displayName?.includes("Loader2") ? <Loader2 className="h-4 w-4 text-muted-foreground animate-spin" /> : item.icon}
              </CardHeader>
              <CardContent className="px-4 pb-3">
                <div className={`text-2xl font-bold ${item.color || 'text-foreground'}`}>
                  {isLoadingPredictions && !item.icon.type.displayName?.includes("Loader2") ? <Skeleton className="h-8 w-20" /> : (
                    item.isCurrency ? formatCurrency(item.value as number) : 
                    (item.isDays ? `${(item.value as number).toFixed(1)} dias` : (item.value || item.count || 0).toLocaleString())
                  )}
                </div>
              </CardContent>
            </Card>
          ))}
        </CardContent>
      </Card>
      
      {/* Filtros Avançados e Busca */}
      <Card className="shadow-md">
        <CardHeader>
            <CardTitle className="flex items-center"><FilterIcon className="mr-2 h-5 w-5 text-primary"/>Filtros Avançados e Busca</CardTitle>
        </CardHeader>
        <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-4">
            <div>
                <Label htmlFor="intelSearch">Busca por Nome/ID</Label>
                <Input id="intelSearch" placeholder="Nome ou ID VTEX..." value={searchTerm} onChange={e => setSearchTerm(e.target.value)} className="mt-1"/>
            </div>
            <div>
                <Label htmlFor="intelCollection">Coleção</Label>
                <Select value={selectedCollection} onValueChange={setSelectedCollection}>
                    <SelectTrigger id="intelCollection" className="mt-1"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_COLLECTIONS_VALUE}>Todas Coleções</SelectItem>
                        {availableCollections.map(c => <SelectItem key={c} value={c}>{c}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="intelProductType">Tipo Produto</Label>
                <Select value={selectedProductType} onValueChange={setSelectedProductType}>
                    <SelectTrigger id="intelProductType" className="mt-1"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_PRODUCT_TYPES_VALUE}>Todos Tipos</SelectItem>
                        {availableProductTypes.map(pt => <SelectItem key={pt} value={pt}>{pt}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
            <div>
                <Label htmlFor="intelRiskStatus">Status de Risco (IA)</Label>
                <Select value={selectedRiskStatus} onValueChange={setSelectedRiskStatus}>
                    <SelectTrigger id="intelRiskStatus" className="mt-1"><SelectValue/></SelectTrigger>
                    <SelectContent>
                        <SelectItem value={ALL_RISK_STATUS_VALUE}>Todos Status</SelectItem>
                        {riskStatusOptions.map(rs => <SelectItem key={rs} value={rs}>{rs}</SelectItem>)}
                    </SelectContent>
                </Select>
            </div>
        </CardContent>
      </Card>


      {/* Component 2: Tabela Dinâmica com Lógica Avançada */}
      <Card className="shadow-lg">
        <CardHeader>
          <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-2">
            <div className="flex-grow">
                <CardTitle className="flex items-center"><ListFilter className="mr-2 h-5 w-5 text-primary"/>Tabela Dinâmica com Lógica Avançada</CardTitle>
                <CardDescription>Produtos com projeções, status de risco e ações sugeridas.</CardDescription>
            </div>
            <Button onClick={() => alert("Exportar para Excel (funcionalidade futura)")} size="sm" variant="outline" disabled={isLoadingPredictions || paginatedProducts.length === 0}>
                <Download className="mr-2 h-4 w-4" /> Exportar para Excel
            </Button>
           </div>
        </CardHeader>
        <CardContent>
          {(isLoadingPredictions && paginatedProducts.length === 0 && allProducts.length > 0) ? (
            <div className="flex items-center justify-center py-10"><Loader2 className="h-8 w-8 animate-spin text-primary" /><p className="ml-3">Carregando previsões e dados da tabela...</p></div>
          ) : paginatedProducts.length === 0 ? (
            <p className="text-center text-muted-foreground py-6">Nenhum produto corresponde aos filtros atuais.</p>
          ) : (
            <>
            <div className="rounded-md border overflow-x-auto">
            <Table>
              <TableHeader>
                <TableRow>
                  <TableHead onClick={() => handleSort('name')} className="cursor-pointer hover:bg-muted/50 text-xs">Nome Produto {renderSortIcon('name')}</TableHead>
                  <TableHead onClick={() => handleSort('stock')} className="cursor-pointer hover:bg-muted/50 text-xs text-right">Est. Total {renderSortIcon('stock')}</TableHead>
                  <TableHead className="text-xs text-right">PE / Regulador</TableHead>
                  <TableHead onClick={() => handleSort('sales30d')} className="cursor-pointer hover:bg-muted/50 text-xs text-right">Vendas (7/15/30d) {renderSortIcon('sales30d')}</TableHead>
                  <TableHead onClick={() => handleSort('daysToRupture')} className="cursor-pointer hover:bg-muted/50 text-xs text-right">Ruptura (dias) {renderSortIcon('daysToRupture')}</TableHead>
                  <TableHead className="text-xs text-center">Status Risco</TableHead>
                  <TableHead className="text-xs text-right">Score Giro/Cob.</TableHead>
                  <TableHead className="text-xs">Ações Sugeridas (IA)</TableHead>
                  <TableHead className="text-xs text-center">Detalhar</TableHead>
                </TableRow>
              </TableHeader>
              <TableBody>
                {paginatedProducts.map(p => (
                  <TableRow key={String(p.vtexId) + p.name}>
                    <TableCell className="font-medium text-xs max-w-xs truncate" title={p.name}>{p.name}</TableCell>
                    <TableCell className="text-right text-xs">{p.stock.toLocaleString()}</TableCell>
                    <TableCell className="text-right text-xs">
                      <TooltipProvider>
                        <Tooltip>
                          <TooltipTrigger asChild>
                             <span className="cursor-help">{p.readyToShip.toLocaleString()} / {p.regulatorStock.toLocaleString()}</span>
                          </TooltipTrigger>
                          <TooltipContent>
                            <p>Pronta Entrega: {p.readyToShip.toLocaleString()}</p>
                            <p>Regulador: {p.regulatorStock.toLocaleString()}</p>
                            <p>Utilizável: {(p.readyToShip + p.regulatorStock).toLocaleString()}</p>
                          </TooltipContent>
                        </Tooltip>
                      </TooltipProvider>
                    </TableCell>
                    <TableCell className="text-right text-xs">
                       {p.sales7d?.toLocaleString()} / {p.sales15d?.toLocaleString()} / {(p.sales30d || 0).toLocaleString()}
                    </TableCell>
                    <TableCell className={`text-right text-xs font-semibold ${
                        p.prediction?.daysToRupture !== undefined && p.prediction.daysToRupture !== null && p.prediction.daysToRupture <= 7 && p.prediction.daysToRupture !== Infinity ? 'text-red-600' :
                        p.prediction?.daysToRupture !== undefined && p.prediction.daysToRupture !== null && p.prediction.daysToRupture <= 15 && p.prediction.daysToRupture !== Infinity ? 'text-orange-600' : 'text-foreground'
                    }`}>
                      {p.prediction ? formatDaysToRuptureForDisplay(p.prediction.daysToRupture) : '...'}
                    </TableCell>
                    <TableCell className="text-center text-xs">
                      {p.prediction ? (
                        <Badge variant={
                            p.prediction.riskStatus === 'Crítico' ? 'destructive' :
                            p.prediction.riskStatus === 'Alto' ? 'destructive' :
                            p.prediction.riskStatus === 'Médio' ? 'default' : 
                            p.prediction.riskStatus === 'N/A' ? 'outline' : 'outline' // Default to outline for N/A and Baixo
                        } className={
                            p.prediction.riskStatus === 'Médio' ? 'bg-orange-500 text-white border-orange-500' :
                            p.prediction.riskStatus === 'Baixo' ? 'bg-green-500 text-white border-green-500' : 
                            p.prediction.riskStatus === 'N/A' ? 'border-gray-400 text-gray-500' : ''
                        }>
                          {p.prediction.riskStatus}
                        </Badge>
                      ) : <Skeleton className="h-5 w-12 mx-auto" />}
                    </TableCell>
                    <TableCell className="text-right text-xs">{p.scoreGiroCobertura?.toFixed(0) ?? '...'}%</TableCell>
                    <TableCell className="text-xs max-w-md truncate">
                      <ul className="list-disc list-inside">
                        {p.prediction?.suggestedRestockUnits && p.prediction.suggestedRestockUnits > 0 && (
                            <li className="text-green-600">Repor {p.prediction.suggestedRestockUnits.toLocaleString()} unid.</li>
                        )}
                        {p.prediction?.alerts?.map((alert, i) => <li key={i} className={alert.includes("Crítico") || alert.includes("Alto Risco") ? "text-red-600" : alert.includes("Atenção") || alert.includes("parado") ? "text-orange-600" : ""}>{alert}</li>)}
                        {(p.prediction?.suggestedRestockUnits === 0 || !p.prediction?.suggestedRestockUnits) && (!p.prediction?.alerts || p.prediction.alerts.length === 0) && <span className="text-muted-foreground">Nenhuma ação imediata.</span>}
                      </ul>
                    </TableCell>
                    <TableCell className="text-center">
                      <Button variant="ghost" size="icon" onClick={() => alert(`Detalhar ${p.name} (futuro)`)} className="h-7 w-7">
                        <Eye className="h-4 w-4" />
                      </Button>
                    </TableCell>
                  </TableRow>
                ))}
              </TableBody>
            </Table>
            </div>
            {totalPages > 1 && (
              <div className="flex items-center justify-between pt-4">
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.max(1, p - 1))} disabled={currentPage === 1}>Anterior</Button>
                <span className="text-sm text-muted-foreground">Página {currentPage} de {totalPages}</span>
                <Button variant="outline" size="sm" onClick={() => setCurrentPage(p => Math.min(totalPages, p + 1))} disabled={currentPage === totalPages}>Próxima</Button>
              </div>
            )}
            </>
          )}
        </CardContent>
      </Card>

      {/* Component 3: Gráfico Preditivo com Linha do Tempo */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center"><LineChart className="mr-2 h-5 w-5 text-primary"/>Gráfico Preditivo com Linha do Tempo</CardTitle>
          <CardDescription>Previsão visual de estoque x venda para os próximos 30 dias. (Funcionalidade Futura)</CardDescription>
        </CardHeader>
        <CardContent className="h-60 flex items-center justify-center text-muted-foreground">
            <Info className="mr-2 h-5 w-5"/> Em Desenvolvimento
        </CardContent>
      </Card>

      {/* Component 4: Módulo de Ações Inteligentes */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center"><Lightbulb className="mr-2 h-5 w-5 text-primary"/>Módulo de Ações Inteligentes</CardTitle>
          <CardDescription>Ações geradas automaticamente para otimizar a logística. (Funcionalidade Futura)</CardDescription>
        </CardHeader>
        <CardContent className="h-40 flex items-center justify-center text-muted-foreground">
            <Info className="mr-2 h-5 w-5"/> Em Desenvolvimento
        </CardContent>
      </Card>

      {/* Component 5: Simulador de Cenário */}
      <Card className="shadow-md">
        <CardHeader>
          <CardTitle className="flex items-center"><Settings className="mr-2 h-5 w-5 text-primary"/>Simulador de Cenário</CardTitle>
          <CardDescription>Avalie impactos de diferentes cenários logísticos e comerciais. (Funcionalidade Futura)</CardDescription>
        </CardHeader>
        <CardContent className="h-40 flex items-center justify-center text-muted-foreground">
            <Info className="mr-2 h-5 w-5"/> Em Desenvolvimento
        </CardContent>
      </Card>

    </div>
  );
}
