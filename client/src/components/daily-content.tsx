import { useState } from "react";
import { useDailyContent } from "@/hooks/use-daily-content";
import { Calendar, RefreshCw, Clock, BookOpen, ArrowRight } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogTrigger } from "@/components/ui/dialog";

interface DailyContentProps {
  category?: string;
}

export function DailyContent({ category = "mercado_imobiliario" }: DailyContentProps) {
  const { content, isLoading, error, generateNewContent } = useDailyContent(category);
  const [isGenerating, setIsGenerating] = useState(false);
  const [dialogOpen, setDialogOpen] = useState(false);

  const handleRefresh = async () => {
    setIsGenerating(true);
    await generateNewContent();
    setIsGenerating(false);
  };

  // Função para formatar a data
  const formatDate = (dateString: string) => {
    const date = new Date(dateString);
    return date.toLocaleDateString('pt-BR', {
      day: '2-digit',
      month: 'long',
      year: 'numeric'
    });
  };

  // Se estiver carregando, mostrar placeholder
  if (isLoading) {
    return (
      <div className="animate-pulse space-y-4 h-full">
        <div className="h-56 bg-white/10 rounded-xl"></div>
        <div className="h-8 bg-white/10 rounded-md w-3/4"></div>
        <div className="space-y-3">
          <div className="h-3 bg-white/10 rounded-md"></div>
          <div className="h-3 bg-white/10 rounded-md"></div>
          <div className="h-3 bg-white/10 rounded-md w-2/3"></div>
        </div>
      </div>
    );
  }

  // Se houver erro, mostrar mensagem
  if (error) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6 py-10">
        <div className="bg-white/5 p-8 rounded-2xl backdrop-blur-sm border border-white/10 text-center max-w-md">
          <p className="text-white/80 mb-6">{error}</p>
          <Button 
            variant="outline" 
            className="text-white border-white/20 bg-white/5 hover:bg-white/10 hover:text-white"
            onClick={handleRefresh}
            disabled={isGenerating}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {isGenerating ? "Gerando..." : "Gerar conteúdo"}
          </Button>
        </div>
      </div>
    );
  }

  // Se não houver conteúdo
  if (!content) {
    return (
      <div className="flex flex-col items-center justify-center h-full space-y-6 py-10">
        <div className="bg-white/5 p-8 rounded-2xl backdrop-blur-sm border border-white/10 text-center max-w-md">
          <p className="text-white/80 mb-6">Nenhum conteúdo disponível no momento.</p>
          <Button 
            variant="outline" 
            className="text-white border-white/20 bg-white/5 hover:bg-white/10 hover:text-white"
            onClick={handleRefresh}
            disabled={isGenerating}
          >
            <RefreshCw className="mr-2 h-4 w-4" />
            {isGenerating ? "Gerando..." : "Gerar conteúdo"}
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="flex flex-col h-full">
      {/* Card com imagem de fundo e conteúdo sobreposto */}
      <div className="relative bg-gradient-to-b from-blue-900/50 to-blue-950/90 rounded-2xl overflow-hidden border border-white/10 shadow-xl backdrop-blur-sm flex-grow mb-2">
        {/* Imagem de fundo com overlay gradiente */}
        {content.imageUrl && (
          <div className="absolute inset-0 z-0">
            <div className="absolute inset-0 bg-gradient-to-b from-blue-900/30 via-blue-900/70 to-blue-950/95 z-10"></div>
            <img 
              src={content.imageUrl} 
              alt="" 
              className="w-full h-full object-cover opacity-40"
            />
          </div>
        )}
        
        {/* Conteúdo sobreposto */}
        <div className="relative z-20 p-6 flex flex-col h-full">
          {/* Data e botão de atualização */}
          <div className="flex items-center justify-between mb-4">
            <div className="flex items-center text-xs bg-white/10 rounded-full px-3 py-1 text-white/80">
              <Calendar className="w-3 h-3 mr-2" />
              <span>{formatDate(content.generatedDate)}</span>
            </div>
            
            <Button 
              variant="ghost" 
              size="sm"
              className="text-white/70 p-1 h-7 w-7 rounded-full hover:bg-white/10 hover:text-white"
              onClick={handleRefresh}
              disabled={isGenerating}
            >
              <RefreshCw className={`h-4 w-4 ${isGenerating ? 'animate-spin' : ''}`} />
              <span className="sr-only">{isGenerating ? "Gerando..." : "Atualizar"}</span>
            </Button>
          </div>
          
          {/* Título */}
          <h3 className="text-xl font-bold mb-4 leading-tight text-white">
            {content.title}
          </h3>
          
          {/* Conteúdo resumido */}
          <div className="text-white/90 text-sm leading-relaxed mb-4">
            {content.content.length > 180 
              ? `${content.content.substring(0, 180)}...` 
              : content.content
            }
          </div>
          
          {/* Botão de ler mais com dialog */}
          <Dialog open={dialogOpen} onOpenChange={setDialogOpen}>
            <DialogTrigger asChild>
              <Button 
                variant="ghost" 
                className="text-white bg-white/10 border border-white/10 hover:bg-white/20 w-fit mt-auto"
                size="sm"
              >
                <BookOpen className="h-4 w-4 mr-2" />
                Ler artigo completo
              </Button>
            </DialogTrigger>
            <DialogContent className="sm:max-w-[550px] bg-blue-950/95 text-white border-white/20 backdrop-blur-lg">
              <div className="space-y-4">
                <h2 className="text-2xl font-bold">{content.title}</h2>
                <div className="flex items-center text-xs text-white/70 gap-4">
                  <div className="flex items-center">
                    <Calendar className="w-3 h-3 mr-1" />
                    <span>{formatDate(content.generatedDate)}</span>
                  </div>
                  <div className="flex items-center">
                    <Clock className="w-3 h-3 mr-1" />
                    <span>3 min de leitura</span>
                  </div>
                </div>
                <div className="py-4 text-white/90 text-sm leading-relaxed whitespace-pre-line">
                  {content.content}
                </div>
                <div className="flex flex-wrap gap-1 pt-2">
                  {content.tags && content.tags.map((tag, index) => (
                    <span key={index} className="px-2 py-1 bg-white/10 rounded-md text-xs text-white/70">
                      {tag}
                    </span>
                  ))}
                </div>
              </div>
            </DialogContent>
          </Dialog>
          
          {/* Tags em formato de chips */}
          {content.tags && content.tags.length > 0 && (
            <div className="flex flex-wrap gap-1 mt-auto pt-4">
              {content.tags.slice(0, 2).map((tag, index) => (
                <span key={index} className="px-2 py-1 bg-white/10 rounded-full text-xs text-white/70">
                  #{tag}
                </span>
              ))}
              {content.tags.length > 2 && (
                <span className="px-2 py-1 bg-white/10 rounded-full text-xs text-white/70">
                  +{content.tags.length - 2}
                </span>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}