
'use client';

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types';
import { parseExcelData } from '@/lib/excel-parser';
import { UploadCloud, Loader2, Save, ShieldCheck, ShieldAlert, Eye, EyeOff } from 'lucide-react';
import { Label } from '@/components/ui/label';

interface ExcelUploadSectionProps {
  onDataParsed: (data: Product[]) => void;
  onProcessingStart: () => void;
  onProcessingEnd: () => void;
  collectionColumnKey?: string;
  cardTitle?: string;
  cardDescription?: string;
  isProcessingParent?: boolean;
  passwordProtected?: boolean;
  unlockPassword?: string;
}

export function ExcelUploadSection({
  onDataParsed,
  onProcessingStart,
  onProcessingEnd,
  collectionColumnKey = 'COLEÇÃO',
  cardTitle = "Upload Collection Data",
  cardDescription = "Upload an Excel file with product details (ID VTEX, Name, Stock, Collection, Dates, etc.).",
  isProcessingParent = false,
  passwordProtected = false,
  unlockPassword = "",
}: ExcelUploadSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const [isUnlocked, setIsUnlocked] = useState(!passwordProtected); // Unlocked by default if not password protected
  const [enteredPassword, setEnteredPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.type === "application/vnd.ms-excel") {
        setSelectedFile(file);
      } else {
        toast({
          title: "Tipo de Arquivo Inválido",
          description: "Por favor, carregue um arquivo Excel válido (.xlsx ou .xls).",
          variant: "destructive",
        });
        setSelectedFile(null);
        event.target.value = '';
      }
    }
  };

  const handleProcessFile = async () => {
    if (!selectedFile) {
      toast({
        title: "Nenhum Arquivo Selecionado",
        description: "Por favor, selecione um arquivo Excel para processar.",
        variant: "destructive",
      });
      return;
    }

    setIsParsing(true);
    onProcessingStart();
    try {
      const data = await parseExcelData(selectedFile, collectionColumnKey);
      onDataParsed(data);
      toast({
        title: "Arquivo Processado",
        description: `${data.length} produtos carregados da planilha. Salvando no banco de dados...`,
      });
    } catch (error: any) {
      console.error("Error processing file:", error);
      toast({
        title: "Erro ao Processar",
        description: error.message || "Ocorreu um erro desconhecido ao analisar o arquivo.",
        variant: "destructive",
      });
      onDataParsed([]);
    } finally {
      setIsParsing(false);
      onProcessingEnd();
      setSelectedFile(null);
      const fileInput = document.getElementById('excel-upload-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  const handleUnlock = () => {
    if (enteredPassword === unlockPassword) {
      setIsUnlocked(true);
      toast({
        title: "Desbloqueado",
        description: "Upload de Excel habilitado.",
      });
      setEnteredPassword(''); // Clear password after successful unlock
    } else {
      toast({
        title: "Senha Incorreta",
        description: "A senha fornecida está incorreta.",
        variant: "destructive",
      });
    }
  };

  const effectiveIsProcessing = isParsing || isProcessingParent;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          {isUnlocked ? <UploadCloud className="mr-2 h-6 w-6 text-primary" /> : <ShieldAlert className="mr-2 h-6 w-6 text-amber-500" />}
          {cardTitle}
        </CardTitle>
        <CardDescription>
          {cardDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!isUnlocked && passwordProtected ? (
          <div className="space-y-3 p-4 border border-dashed border-amber-500 rounded-md bg-amber-500/5">
            <Label htmlFor="upload-password">Senha para Upload de Excel</Label>
            <div className="flex gap-2 items-center">
              <Input
                id="upload-password"
                type={showPassword ? "text" : "password"}
                value={enteredPassword}
                onChange={(e) => setEnteredPassword(e.target.value)}
                placeholder="Digite a senha"
                className="flex-grow"
                disabled={effectiveIsProcessing}
                onKeyDown={(e) => { if (e.key === 'Enter') handleUnlock();}}
              />
              <Button
                variant="ghost"
                size="icon"
                onClick={() => setShowPassword((prev) => !prev)}
                aria-label={showPassword ? "Ocultar senha" : "Mostrar senha"}
                className="border"
              >
                {showPassword ? <EyeOff className="h-5 w-5" /> : <Eye className="h-5 w-5" />}
              </Button>
            </div>
            <Button onClick={handleUnlock} disabled={effectiveIsProcessing || !enteredPassword} className="w-full sm:w-auto">
              {effectiveIsProcessing ? (
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
              ) : (
                <ShieldCheck className="mr-2 h-4 w-4" />
              )}
              Desbloquear Upload
            </Button>
            <p className="text-xs text-muted-foreground">Insira a senha para habilitar o carregamento de planilhas.</p>
          </div>
        ) : (
          <>
            <div className="flex flex-col sm:flex-row gap-4 items-center">
              <Input
                id="excel-upload-input"
                type="file"
                accept=".xlsx, .xls"
                onChange={handleFileChange}
                className="flex-grow file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
                aria-label="Upload Excel file"
                disabled={effectiveIsProcessing}
              />
              <Button
                onClick={handleProcessFile}
                disabled={!selectedFile || effectiveIsProcessing}
                className="w-full sm:w-auto"
              >
                {effectiveIsProcessing ? (
                  <>
                    <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                    {isProcessingParent ? "Salvando Dados..." : "Processando Planilha..."}
                  </>
                ) : (
                  <>
                    <Save className="mr-2 h-4 w-4" /> Processar e Salvar Dados
                  </>
                )}
              </Button>
            </div>
            {selectedFile && !effectiveIsProcessing && <p className="text-sm text-muted-foreground">Arquivo selecionado: {selectedFile.name}</p>}
          </>
        )}
      </CardContent>
    </Card>
  );
}
