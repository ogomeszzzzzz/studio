'use client';

import type { ChangeEvent } from 'react';
import { useState } from 'react';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { useToast } from '@/hooks/use-toast';
import type { Product } from '@/types';
import { parseExcelData } from '@/lib/excel-parser';
import { UploadCloud, Loader2 } from 'lucide-react';

interface ExcelUploadSectionProps {
  onDataParsed: (data: Product[]) => void;
  onProcessingStart: () => void;
  onProcessingEnd: () => void;
}

export function ExcelUploadSection({ onDataParsed, onProcessingStart, onProcessingEnd }: ExcelUploadSectionProps) {
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
        event.target.value = ''; // Reset file input
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
      const data = await parseExcelData(selectedFile);
      onDataParsed(data);
      toast({
        title: "File Processed",
        description: `${data.length} products loaded successfully.`,
      });
    } catch (error: any) {
      console.error("Error processing file:", error);
      toast({
        title: "Processing Error",
        description: error.message || "An unknown error occurred while parsing the file.",
        variant: "destructive",
      });
      onDataParsed([]); // Clear any previous data
    } finally {
      setIsParsing(false);
      onProcessingEnd();
    }
  };

  return (
    <Card className="shadow-lg">
      <CardHeader>
        <CardTitle className="flex items-center text-xl">
          <UploadCloud className="mr-2 h-6 w-6 text-primary" />
          Upload Collection Data
        </CardTitle>
        <CardDescription>
          Upload an Excel file with product details (ID VTEX, Name, Stock, Collection, Dates, etc.).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col sm:flex-row gap-4 items-center">
          <Input
            type="file"
            accept=".xlsx, .xls"
            onChange={handleFileChange}
            className="flex-grow file:mr-4 file:py-2 file:px-4 file:rounded-full file:border-0 file:text-sm file:font-semibold file:bg-primary/10 file:text-primary hover:file:bg-primary/20"
            aria-label="Upload Excel file"
          />
          <Button onClick={handleProcessFile} disabled={!selectedFile || isParsing} className="w-full sm:w-auto">
            {isParsing ? (
              <>
                <Loader2 className="mr-2 h-4 w-4 animate-spin" />
                Processing...
              </>
            ) : (
              "Process File"
            )}
          </Button>
        </div>
        {selectedFile && <p className="text-sm text-muted-foreground">Selected file: {selectedFile.name}</p>}
      </CardContent>
    </Card>
  );
}
