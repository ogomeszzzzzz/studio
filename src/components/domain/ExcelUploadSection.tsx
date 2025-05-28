
'use client';

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types';
import { parseExcelData } from '@/lib/excel-parser';
import { UploadCloud, Loader2, Save } from 'lucide-react';

interface ExcelUploadSectionProps {
  onDataParsed: (data: Product[]) => void;
  onProcessingStart: () => void;
  onProcessingEnd: () => void;
  collectionColumnKey?: string;
  cardTitle?: string;
  cardDescription?: string;
  isProcessingParent?: boolean; // New prop to reflect parent's saving state
}

export function ExcelUploadSection({ 
  onDataParsed, 
  onProcessingStart, 
  onProcessingEnd, 
  collectionColumnKey = 'COLEÇÃO',
  cardTitle = "Upload Collection Data",
  cardDescription = "Upload an Excel file with product details (ID VTEX, Name, Stock, Collection, Dates, etc.).",
  isProcessingParent = false, // Default to false
}: ExcelUploadSectionProps) {
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isParsing, setIsParsing] = useState(false);
  const { toast } = useToast();

  const handleFileChange = (event: ChangeEvent<HTMLInputElement>) => {
    if (event.target.files && event.target.files[0]) {
      const file = event.target.files[0];
      if (file.type === "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" || file.type === "application/vnd.ms-excel") {
        setSelectedFile(file);
      } else {
        toast({
          title: "Invalid File Type",
          description: "Please upload a valid Excel file (.xlsx or .xls).",
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
        title: "No File Selected",
        description: "Please select an Excel file to process.",
        variant: "destructive",
      });
      return;
    }

    setIsParsing(true);
    onProcessingStart();
    try {
      const data = await parseExcelData(selectedFile, collectionColumnKey);
      onDataParsed(data); // This will now trigger saving to Firestore
      // Toast for successful parsing is good, saving toast will come from parent
      toast({
        title: "Arquivo Processado",
        description: `${data.length} produtos carregados da planilha. Salvando no banco de dados...`,
      });
    } catch (error: any) {
      console.error("Error processing file:", error);
      toast({
        title: "Processing Error",
        description: error.message || "An unknown error occurred while parsing the file.",
        variant: "destructive",
      });
      onDataParsed([]); 
    } finally {
      setIsParsing(false);
      onProcessingEnd();
      setSelectedFile(null); // Clear selected file after processing
      const fileInput = document.getElementById('excel-upload-input') as HTMLInputElement;
      if (fileInput) fileInput.value = '';
    }
  };

  const effectiveIsProcessing = isParsing || isProcessingParent;

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <UploadCloud className="mr-2 h-6 w-6 text-primary" />
          {cardTitle}
        </CardTitle>
        <CardDescription>
          {cardDescription}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
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
      </CardContent>
    </Card>
  );
}
