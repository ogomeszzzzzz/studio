
'use client';

import { useState, useMemo, useEffect, useCallback } from 'react';
import { Card, CardContent, CardHeader, CardTitle, CardDescription } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { ProductDataTableSection } from '@/components/domain/ProductDataTableSection';
import type { Product } from '@/types';
import { clientAuth, firestore } from '@/lib/firebase/config';
import type { User } from 'firebase/auth';
import { collection, getDocs, doc, Timestamp, query, getDoc } from 'firebase/firestore';
import { useToast } from '@/hooks/use-toast';
import { Loader2, BarChart, PieChartIcon as PieChartLucide, Filter, Download, Database, ListFilter, Clock } from 'lucide-react';
import { ResponsiveContainer, BarChart as RechartsBarChart, Bar, XAxis, YAxis, Tooltip as RechartsTooltip, Legend as RechartsLegend, CartesianGrid, PieChart, Pie, Cell } from 'recharts';
import { ChartConfig, ChartContainer, ChartTooltipContent } from "@/components/ui/chart";
import * as XLSX from 'xlsx';
import { format as formatDateFns } from 'date-fns';
import { ptBR } from 'date-fns/locale';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';
import { Label } from '@/components/ui/label';

const productFromFirestore = (data: any): Product => {
  return {
    ...data,
    collectionStartDate: data.collectionStartDate ? (data.collectionStartDate as Timestamp).toDate() : null,
    collectionEndDate: data.collectionEndDate ? (data.collectionEndDate as Timestamp).toDate() : null,
  } as Product;
};

const CURVE_COLORS: ChartConfig = {
  A: { label: "Curva A", color: "hsl(var(--chart-1))" },
  B: { label: "Curva B", color: "hsl(var(--chart-2))" },
  C: { label: "Curva C", color: "hsl(var(--chart-3))" },
  'N/A': { label: "N/A", color: "hsl(var(--muted))" },
};

export default function AbcAnalysisPage() {
  const [allProducts, setAllProducts] = useState<Product[]>([]);
  const [abcAnalyzedProducts, setAbcAnalyzedProducts] = useState<Product[]>([]);
  const [isLoadingFirestore, setIsLoadingFirestore] = useState(true);
  const [isCalculatingAbc, setIsCalculatingAbc] = useState(false);
  const [isExporting, setIsExporting] = useState(false);
  const [currentUser, setCurrentUser] = useState<User | null>(null);
  const { toast } = useToast();
  const [lastDataUpdateTimestamp, setLastDataUpdateTimestamp] = useState<Date | null>(null);
  const [selectedAbcFilter, setSelectedAbcFilter] = useState<'ALL' | 'A' | 'B' | 'C' | 'N/A'>('ALL');


  useEffect(() => {
    const unsubscribe = clientAuth.onAuthStateChanged((user) => {
      setCurrentUser(user);
      if (!user) {
        setAllProducts([]);
        setAbcAnalyzedProducts([]);
        setLastDataUpdateTimestamp(null);
        setIsLoadingFirestore(false);
      }
    });
    return () => unsubscribe();
  }, []);

  useEffect(() => {
    if (currentUser && allProducts.length === 0) {
      setIsLoadingFirestore(true);
      const fetchProducts = async () => {
        try {
          const productsCol = collection(firestore, 'users', currentUser.uid, 'products');
          const snapshot = await getDocs(query(productsCol));
          const productsFromDb: Product[] = [];
          snapshot.docs.forEach(docSnap => {
            if (docSnap.id !== '_metadata') {
              productsFromDb.push(productFromFirestore(docSnap.data()));
            }
          });
          setAllProducts(productsFromDb);

          const metadataDocRef = doc(firestore, 'users', currentUser.uid, 'products', '_metadata');
          const metadataDocSnap = await getDoc(metadataDocRef);
          if (metadataDocSnap.exists()) {
            const data = metadataDocSnap.data();
            if (data.lastUpdatedAt && data.lastUpdatedAt instanceof Timestamp) {
              setLastDataUpdateTimestamp(data.lastUpdatedAt.toDate());
            }
          }
          if (productsFromDb.length > 0) {
            toast({ title: "Dados Carregados", description: `${productsFromDb.length} produtos carregados do banco de dados.` });
          }
        } catch (error) {
          console.error("Error fetching products from Firestore (ABC Analysis):", error);
          toast({ title: "Erro ao Carregar Dados", description: `Não foi possível buscar os produtos: ${(error as Error).message}`, variant: "destructive" });
        } finally {
          setIsLoadingFirestore(false);
        }
      };
      fetchProducts();
    } else if (!currentUser) {
      setIsLoadingFirestore(false);
    }
  }, [currentUser, allProducts.length, toast]);

  const performAbcAnalysis = useCallback((products: Product[]): Product[] => {
    if (products.length === 0) return [];
    setIsCalculatingAbc(true);

    const productsWithRevenue = products
      .map(p => ({
        ...p,
        revenue30d: (p.price || 0) * (p.sales30d || 0),
      }))
      .filter(p => p.revenue30d > 0); // Consider only products with positive revenue

    if (productsWithRevenue.length === 0) {
        setIsCalculatingAbc(false);
        return products.map(p => ({ ...p, abcCurve: 'N/A', revenue30d: 0, cumulativeRevenuePercentage: 0 }));
    }

    productsWithRevenue.sort((a, b) => (b.revenue30d || 0) - (a.revenue30d || 0));

    const totalRevenue = productsWithRevenue.reduce((sum, p) => sum + (p.revenue30d || 0), 0);
    if (totalRevenue === 0) {
        setIsCalculatingAbc(false);
        return products.map(p => ({ ...p, abcCurve: 'N/A', revenue30d: 0, cumulativeRevenuePercentage: 0 }));
    }

    let cumulativeRevenue = 0;
    const analyzed = productsWithRevenue.map(p => {
      cumulativeRevenue += p.revenue30d || 0;
      const cumulativePercentage = (cumulativeRevenue / totalRevenue) * 100;
      let curve: Product['abcCurve'] = 'C';
      if (cumulativePercentage <= 80) {
        curve = 'A';
      } else if (cumulativePercentage <= 95) {
        curve = 'B';
      }
      return { ...p, abcCurve: curve, cumulativeRevenuePercentage: cumulativePercentage };
    });

    // Add back products with no revenue as N/A
    const productsWithoutRevenue = products
        .filter(p => (p.price || 0) * (p.sales30d || 0) <= 0)
        .map(p => ({...p, abcCurve: 'N/A' as const, revenue30d: 0, cumulativeRevenuePercentage: 0}));

    setIsCalculatingAbc(false);
    return [...analyzed, ...productsWithoutRevenue];
  }, []);

  useEffect(() => {
    if (allProducts.length > 0) {
      const analyzed = performAbcAnalysis(allProducts);
      setAbcAnalyzedProducts(analyzed);
    } else {
      setAbcAnalyzedProducts([]);
    }
  }, [allProducts, performAbcAnalysis]);

  const filteredTableProducts = useMemo(() => {
    if (selectedAbcFilter === 'ALL') {
      return abcAnalyzedProducts;
    }
    return abcAnalyzedProducts.filter(p => p.abcCurve === selectedAbcFilter);
  }, [abcAnalyzedProducts, selectedAbcFilter]);


  const abcSummary = useMemo(() => {
    if (abcAnalyzedProducts.length === 0) {
      return {
        totalRevenue30d: 0,
        curveA_skus: 0, curveA_revenue: 0, curveA_sku_percent: 0, curveA_revenue_percent: 0,
        curveB_skus: 0, curveB_revenue: 0, curveB_sku_percent: 0, curveB_revenue_percent: 0,
        curveC_skus: 0, curveC_revenue: 0, curveC_sku_percent: 0, curveC_revenue_percent: 0,
        curveNA_skus: 0,
        chartRevenueByCurve: [],
        chartSkuDistribution: [],
      };
    }

    const totalRevenue30d = abcAnalyzedProducts.reduce((sum, p) => sum + (p.revenue30d || 0), 0);
    const totalSkus = abcAnalyzedProducts.length;

    const curves = { A: { skus: 0, revenue: 0 }, B: { skus: 0, revenue: 0 }, C: { skus: 0, revenue: 0 }, 'N/A': {skus: 0, revenue: 0}};

    abcAnalyzedProducts.forEach(p => {
      const curve = p.abcCurve || 'N/A';
      curves[curve].skus += 1;
      curves[curve].revenue += p.revenue30d || 0;
    });
    
    const calculatePercentage = (value: number, total: number) => (total > 0 ? (value / total) * 100 : 0);

    return {
      totalRevenue30d,
      curveA_skus: curves.A.skus,
      curveA_revenue: curves.A.revenue,
      curveA_sku_percent: calculatePercentage(curves.A.skus, totalSkus),
      curveA_revenue_percent: calculatePercentage(curves.A.revenue, totalRevenue30d),
      curveB_skus: curves.B.skus,
      curveB_revenue: curves.B.revenue,
      curveB_sku_percent: calculatePercentage(curves.B.skus, totalSkus),
      curveB_revenue_percent: calculatePercentage(curves.B.revenue, totalRevenue30d),
      curveC_skus: curves.C.skus,
      curveC_revenue: curves.C.revenue,
      curveC_sku_percent: calculatePercentage(curves.C.skus, totalSkus),
      curveC_revenue_percent: calculatePercentage(curves.C.revenue, totalRevenue30d),
      curveNA_skus: curves['N/A'].skus,
      chartRevenueByCurve: [
        { name: 'Curva A', value: curves.A.revenue, fill: CURVE_COLORS.A.color },
        { name: 'Curva B', value: curves.B.revenue, fill: CURVE_COLORS.B.color },
        { name: 'Curva C', value: curves.C.revenue, fill: CURVE_COLORS.C.color },
      ].filter(item => item.value > 0),
      chartSkuDistribution: [
        { name: 'Curva A', value: curves.A.skus, fill: CURVE_COLORS.A.color },
        { name: 'Curva B', value: curves.B.skus, fill: CURVE_COLORS.B.color },
        { name: 'Curva C', value: curves.C.skus, fill: CURVE_COLORS.C.color },
        { name: 'N/A', value: curves['N/A'].skus, fill: CURVE_COLORS['N/A'].color },
      ].filter(item => item.value > 0),
    };
  }, [abcAnalyzedProducts]);

  const formatCurrency = (value: number) => value.toLocaleString('pt-BR', { style: 'currency', currency: 'BRL' });

  const handleExportToExcel = () => {
    if (abcAnalyzedProducts.length === 0) {
      toast({ title: "Nenhum Dado para Exportar", description: "Não há produtos analisados para exportar.", variant: "default" });
      return;
    }
    setIsExporting(true);
    toast({ title: "Exportando...", description: "Gerando arquivo Excel da Análise ABC." });

    const dataToExport = abcAnalyzedProducts.map(p => ({
      "ID VTEX": typeof p.vtexId === 'number' ? p.vtexId : String(p.vtexId ?? ''),
      "Nome Produto": p.name,
      "Produto-Derivação": p.productDerivation,
      "Preço": p.price,
      "Venda 30d": p.sales30d,
      "Faturamento 30d": p.revenue30d,
      "Curva ABC": p.abcCurve,
      "% Acum. Faturamento": p.cumulativeRevenuePercentage?.toFixed(2) + '%',
      "Coleção (Desc. Linha Comercial)": p.collection,
      "Tipo Produto": p.productType,
      "Estoque Atual": p.stock,
    }));

    try {
      const worksheet = XLSX.utils.json_to_sheet(dataToExport);
      const workbook = XLSX.utils.book_new();
      XLSX.utils.book_append_sheet(workbook, worksheet, "AnaliseABC");
      XLSX.writeFile(workbook, `Analise_ABC_${new Date().toISOString().split('T')[0]}.xlsx`);
      toast({ title: "Exportação Concluída", description: "Os dados da Análise ABC foram exportados." });
    } catch (error) {
      console.error("Erro ao exportar para Excel (ABC):", error);
      toast({ title: "Erro na Exportação", description: "Não foi possível gerar o arquivo Excel.", variant: "destructive" });
    } finally {
      setIsExporting(false);
    }
  };

  const renderCustomizedLabel = ({ cx, cy, midAngle, innerRadius, outerRadius, percent, name }: any) => {
    const RADIAN = Math.PI / 180;
    const radius = innerRadius + (outerRadius - innerRadius) * 0.5;
    const x = cx + radius * Math.cos(-midAngle * RADIAN);
    const y = cy + radius * Math.sin(-midAngle * RADIAN);
    const percentage = (percent * 100).toFixed(0);

    if (percentage === "0") return null;

    return (
      <text x={x} y={y} fill="white" textAnchor={x > cx ? 'start' : 'end'} dominantBaseline="central" fontSize="12px" fontWeight="bold">
        {`${name}: ${percentage}%`}
      </text>
    );
  };


  if (isLoadingFirestore) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando dados...</p></div>;
  }

  return (
    <div className="space-y-6">
      <div className="flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
        <div>
          <h1 className="text-3xl font-bold tracking-tight text-foreground flex items-center">
            <BarChart className="mr-3 h-8 w-8 text-primary" />
            Análise Curva ABC de Faturamento (30 dias)
          </h1>
          <p className="text-muted-foreground">
            Identifique os produtos mais importantes para o faturamento com base nas colunas "Preço" e "Venda 30d".
            <br />
            Os dados são carregados do último upload feito na página do Dashboard.
          </p>
        </div>
        <Button onClick={handleExportToExcel} disabled={isExporting || abcAnalyzedProducts.length === 0}>
          {isExporting ? <Loader2 className="mr-2 h-4 w-4 animate-spin" /> : <Download className="mr-2 h-4 w-4" />}
          Exportar Análise ABC
        </Button>
      </div>
      {lastDataUpdateTimestamp && (
        <div className="text-sm text-muted-foreground flex items-center">
          <Clock className="mr-2 h-4 w-4" />
          Última atualização dos dados: {formatDateFns(lastDataUpdateTimestamp, 'dd/MM/yyyy HH:mm:ss', { locale: ptBR })}
        </div>
      )}

      {allProducts.length === 0 && !isLoadingFirestore && (
        <Card className="shadow-lg text-center py-10">
          <CardHeader><CardTitle className="flex items-center justify-center text-xl"><Database className="mr-2 h-7 w-7 text-primary" />Sem Dados para Análise</CardTitle></CardHeader>
          <CardContent>
            <p className="text-muted-foreground">Nenhum dado de produto encontrado. Por favor, vá para a página do Dashboard e carregue um arquivo Excel com as colunas "Preço" e "Venda 30d".</p>
          </CardContent>
        </Card>
      )}

      {isCalculatingAbc && (
        <Card className="shadow-lg"><CardHeader><CardTitle className="flex items-center"><Loader2 className="mr-2 h-6 w-6 animate-spin text-primary" />Calculando Curva ABC...</CardTitle></CardHeader><CardContent><p className="text-muted-foreground">Aguarde enquanto a análise é processada.</p></CardContent></Card>
      )}

      {allProducts.length > 0 && !isCalculatingAbc && (
        <>
          <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center"><ListFilter className="mr-2 h-5 w-5 text-primary" />Resumo da Curva ABC</CardTitle>
                <CardDescription>Faturamento total nos últimos 30 dias: <span className="font-bold text-primary">{formatCurrency(abcSummary.totalRevenue30d)}</span></CardDescription>
            </CardHeader>
            <CardContent className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
                <Card className="border-l-4 border-chart-1 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-lg">Curva A</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                        <p><strong>{abcSummary.curveA_sku_percent.toFixed(1)}%</strong> dos SKUs</p>
                        <p>Geram <strong>{abcSummary.curveA_revenue_percent.toFixed(1)}%</strong> do Faturamento</p>
                        <p>({formatCurrency(abcSummary.curveA_revenue)})</p>
                        <p>({abcSummary.curveA_skus.toLocaleString()} SKUs)</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-chart-2 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-lg">Curva B</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                        <p><strong>{abcSummary.curveB_sku_percent.toFixed(1)}%</strong> dos SKUs</p>
                        <p>Geram <strong>{abcSummary.curveB_revenue_percent.toFixed(1)}%</strong> do Faturamento</p>
                         <p>({formatCurrency(abcSummary.curveB_revenue)})</p>
                         <p>({abcSummary.curveB_skus.toLocaleString()} SKUs)</p>
                    </CardContent>
                </Card>
                <Card className="border-l-4 border-chart-3 shadow-sm">
                    <CardHeader className="pb-2"><CardTitle className="text-lg">Curva C</CardTitle></CardHeader>
                    <CardContent className="text-sm space-y-1">
                        <p><strong>{abcSummary.curveC_sku_percent.toFixed(1)}%</strong> dos SKUs</p>
                        <p>Geram <strong>{abcSummary.curveC_revenue_percent.toFixed(1)}%</strong> do Faturamento</p>
                        <p>({formatCurrency(abcSummary.curveC_revenue)})</p>
                        <p>({abcSummary.curveC_skus.toLocaleString()} SKUs)</p>
                    </CardContent>
                </Card>
                {abcSummary.curveNA_skus > 0 && (
                    <Card className="border-l-4 border-muted shadow-sm md:col-span-3 lg:col-span-1">
                        <CardHeader className="pb-2"><CardTitle className="text-lg">Não Aplicável (N/A)</CardTitle></CardHeader>
                        <CardContent className="text-sm space-y-1">
                            <p><strong>{abcSummary.curveNA_skus.toLocaleString()} SKUs</strong> sem faturamento ou dados de preço/venda.</p>
                        </CardContent>
                    </Card>
                )}
            </CardContent>
          </Card>

          <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
            {abcSummary.chartRevenueByCurve.length > 0 && (
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center"><BarChart className="mr-2 h-5 w-5 text-primary" />Faturamento por Curva</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                        <ChartContainer config={CURVE_COLORS} className="h-full w-full">
                            <RechartsBarChart data={abcSummary.chartRevenueByCurve} layout="vertical" margin={{ left: 20, right: 30}}>
                                <CartesianGrid horizontal={false} strokeDasharray="3 3" />
                                <XAxis type="number" tickFormatter={formatCurrency} />
                                <YAxis dataKey="name" type="category" width={80} />
                                <RechartsTooltip content={<ChartTooltipContent formatter={(value) => formatCurrency(value as number)} />} />
                                <Bar dataKey="value" name="Faturamento" radius={[0, 4, 4, 0]} />
                            </RechartsBarChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            )}
            {abcSummary.chartSkuDistribution.length > 0 && (
                <Card className="shadow-lg">
                    <CardHeader>
                        <CardTitle className="flex items-center"><PieChartLucide className="mr-2 h-5 w-5 text-primary" />Distribuição de SKUs por Curva</CardTitle>
                    </CardHeader>
                    <CardContent className="h-[350px]">
                         <ChartContainer config={CURVE_COLORS} className="h-full w-full">
                            <PieChart>
                                <RechartsTooltip content={<ChartTooltipContent formatter={(value) => `${(value as number).toLocaleString()} SKUs`} />} />
                                <Pie
                                    data={abcSummary.chartSkuDistribution}
                                    dataKey="value"
                                    nameKey="name"
                                    cx="50%"
                                    cy="50%"
                                    outerRadius={100}
                                    label={renderCustomizedLabel}
                                    labelLine={false}
                                >
                                    {abcSummary.chartSkuDistribution.map((entry) => (
                                        <Cell key={`cell-${entry.name}`} fill={entry.fill} />
                                    ))}
                                </Pie>
                                <RechartsLegend />
                            </PieChart>
                        </ChartContainer>
                    </CardContent>
                </Card>
            )}
          </div>
          
          <Card className="shadow-md">
            <CardHeader>
                <CardTitle className="flex items-center"><Filter className="mr-2 h-5 w-5 text-primary" />Filtrar Produtos por Curva</CardTitle>
            </CardHeader>
            <CardContent>
                <div className="max-w-xs">
                    <Label htmlFor="abcFilterTable">Mostrar produtos da Curva:</Label>
                    <Select value={selectedAbcFilter} onValueChange={(value) => setSelectedAbcFilter(value as any)}>
                        <SelectTrigger id="abcFilterTable" className="mt-1">
                            <SelectValue placeholder="Selecionar Curva..." />
                        </SelectTrigger>
                        <SelectContent>
                            <SelectItem value="ALL">Todas as Curvas</SelectItem>
                            <SelectItem value="A">Curva A</SelectItem>
                            <SelectItem value="B">Curva B</SelectItem>
                            <SelectItem value="C">Curva C</SelectItem>
                            <SelectItem value="N/A">N/A (Sem Faturamento)</SelectItem>
                        </SelectContent>
                    </Select>
                </div>
            </CardContent>
          </Card>

          <ProductDataTableSection
            products={filteredTableProducts}
            isLoading={isLoadingFirestore || isCalculatingAbc}
            cardTitle="Detalhes dos Produtos na Análise ABC"
            cardDescription="Lista de produtos com sua classificação na Curva ABC e dados de faturamento. Clique nos cabeçalhos para ordenar."
            cardIcon={ListFilter}
            showVtexIdColumn={true}
            showNameColumn={true}
            showProductDerivationColumn={true}
            showPriceColumn={true}
            showSales30dColumn={true}
            showRevenue30dColumn={true}
            showAbcCurveColumn={true}
            showStockColumn={true} // Keep stock for context
            showCollectionColumn={true} // Keep collection for context
            itemsPerPage={15}
          />
        </>
      )}
    </div>
  );
}
