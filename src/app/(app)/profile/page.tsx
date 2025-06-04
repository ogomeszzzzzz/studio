
'use client';

import { useState, useEffect } from 'react';
import { useAuth } from '@/contexts/AuthContext';
import { useToast } from '@/hooks/use-toast';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import { Label } from '@/components/ui/label';
import { Card, CardContent, CardDescription, CardHeader, CardTitle, CardFooter } from '@/components/ui/card';
import { Loader2, UserCircle, Save, ImagePlus } from 'lucide-react';
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { updateUserProfile } from '@/app/actions/user';

export default function UserProfilePage() {
  const { currentUser, setCurrentUser, isLoading: authLoading } = useAuth();
  const { toast } = useToast();

  const [name, setName] = useState('');
  const [photoURL, setPhotoURL] = useState(''); // For now, just a text field for URL
  const [isSaving, setIsSaving] = useState(false);
  const [initialName, setInitialName] = useState('');

  useEffect(() => {
    if (currentUser) {
      setName(currentUser.name || '');
      setInitialName(currentUser.name || '');
      setPhotoURL(currentUser.photoURL || '');
    }
  }, [currentUser]);

  const handleSubmit = async (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (!currentUser) {
      toast({ title: "Erro", description: "Nenhum usuário logado.", variant: "destructive" });
      return;
    }
    if (name.trim() === '' && name !== initialName) {
        toast({ title: "Erro de Validação", description: "O nome não pode ser vazio.", variant: "destructive" });
        return;
    }
    if (name === initialName && photoURL === (currentUser.photoURL || '')) {
        toast({ title: "Nenhuma Alteração", description: "Nenhum dado foi modificado." });
        return;
    }

    setIsSaving(true);
    try {
      const updates: { name?: string; photoURL?: string } = {};
      if (name !== initialName) updates.name = name;
      // For now, we are not implementing file upload, so photoURL is just a string
      // If you had file upload, you'd upload the file, get the URL, then set updates.photoURL
      if (photoURL !== (currentUser.photoURL || '')) updates.photoURL = photoURL;


      const result = await updateUserProfile(currentUser.email, updates);
      console.log("Profile update result from server action:", result); // For debugging

      if (result && result.status === 'success' && result.user) {
        toast({ title: "Sucesso", description: "Perfil atualizado!" });
        setCurrentUser(result.user); // Update context with new user data
        setInitialName(result.user.name); // Update initialName after successful save
      } else if (result && result.message) {
        toast({ title: "Erro ao Atualizar", description: result.message, variant: "destructive" });
      } else {
        // Handle cases where result is undefined or doesn't have expected properties
        toast({ title: "Erro Crítico", description: "Resposta inesperada do servidor ao atualizar perfil.", variant: "destructive" });
      }
    } catch (error) {
      toast({ title: "Erro Crítico", description: (error as Error).message, variant: "destructive" });
    } finally {
      setIsSaving(false);
    }
  };

  const handleImageUploadPlaceholder = () => {
    // In a real implementation, this would open a file dialog
    // For now, it's just a placeholder.
    toast({ title: "Upload de Imagem", description: "Funcionalidade de upload de imagem ainda não implementada. Você pode colar uma URL de imagem no campo." });
  };

  if (authLoading || !currentUser) {
    return <div className="flex items-center justify-center h-screen"><Loader2 className="h-12 w-12 animate-spin text-primary" /><p className="ml-3">Carregando perfil...</p></div>;
  }

  const userInitial = currentUser.name ? currentUser.name.charAt(0).toUpperCase() : currentUser.email.charAt(0).toUpperCase();

  return (
    <div className="max-w-2xl mx-auto">
      <Card className="shadow-xl">
        <CardHeader className="text-center">
          <div className="mx-auto mb-6">
            <Avatar className="h-24 w-24 ring-2 ring-primary ring-offset-2">
              <AvatarImage src={currentUser.photoURL || photoURL} alt={name} />
              <AvatarFallback className="text-3xl">{userInitial}</AvatarFallback>
            </Avatar>
            <Button variant="outline" size="sm" onClick={handleImageUploadPlaceholder} className="mt-3">
              <ImagePlus className="mr-2 h-4 w-4" /> Alterar Foto (URL)
            </Button>
          </div>
          <CardTitle className="text-3xl font-bold">Meu Perfil</CardTitle>
          <CardDescription>Atualize suas informações pessoais.</CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleSubmit} className="space-y-6">
            <div className="space-y-2">
              <Label htmlFor="email" className="font-semibold">Email</Label>
              <Input id="email" type="email" value={currentUser.email} disabled className="bg-muted/50" />
              <p className="text-xs text-muted-foreground">O email não pode ser alterado.</p>
            </div>
            <div className="space-y-2">
              <Label htmlFor="name" className="font-semibold">Nome de Exibição</Label>
              <Input id="name" type="text" value={name} onChange={(e) => setName(e.target.value)} placeholder="Seu nome completo ou apelido" />
            </div>
            <div className="space-y-2">
              <Label htmlFor="photoURL" className="font-semibold">URL da Foto de Perfil</Label>
              <Input id="photoURL" type="url" value={photoURL} onChange={(e) => setPhotoURL(e.target.value)} placeholder="https://exemplo.com/sua-foto.jpg" />
               <p className="text-xs text-muted-foreground">Cole a URL de uma imagem para seu perfil.</p>
            </div>
            <Button type="submit" className="w-full text-lg py-3" disabled={isSaving}>
              {isSaving ? <Loader2 className="mr-2 h-5 w-5 animate-spin" /> : <Save className="mr-2 h-5 w-5" />}
              Salvar Alterações
            </Button>
          </form>
        </CardContent>
        <CardFooter>
          <p className="text-xs text-muted-foreground mx-auto">Suas informações são gerenciadas com segurança.</p>
        </CardFooter>
      </Card>
    </div>
  );
}
