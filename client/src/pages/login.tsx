import { useState } from "react";
import { useLocation } from "wouter";
import { z } from "zod";
import { useForm } from "react-hook-form";
import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Mail, Lock, Eye, EyeOff, BarChart2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Checkbox } from "@/components/ui/checkbox";
import { Form, FormControl, FormField, FormItem, FormLabel, FormMessage } from "@/components/ui/form";
import { useToast } from "@/hooks/use-toast";
import { useAuth } from "@/hooks/use-auth";
import { Role } from "@shared/schema";

// Esquema de validação do formulário
const loginSchema = z.object({
  email: z.string().email({ message: "Email inválido" }).min(1, { message: "O email é obrigatório" }),
  password: z.string().min(1, { message: "A senha é obrigatória" }),
  rememberMe: z.boolean().optional()
});

type LoginFormValues = z.infer<typeof loginSchema>;

export default function Login() {
  const [isLoading, setIsLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);
  const [, navigate] = useLocation();
  const { login } = useAuth();
  const { toast } = useToast();

  // Iniciar o formulário com valores padrão
  const form = useForm<LoginFormValues>({
    resolver: zodResolver(loginSchema),
    defaultValues: {
      email: "",
      password: "",
      rememberMe: false
    }
  });

  const onSubmit = async (data: LoginFormValues) => {
    setIsLoading(true);
    try {
      const success = await login(data.email, data.password);
      if (success) {
        toast({
          title: "Login realizado com sucesso!",
          description: "Bem-vindo ao FamaChat",
        });
        navigate("/"); // Redireciona para a página inicial
      } else {
        toast({
          variant: "destructive",
          title: "Erro de login",
          description: "Email ou senha inválidos.",
        });
      }
    } catch (error) {
      toast({
        variant: "destructive",
        title: "Erro de login",
        description: "Ocorreu um erro ao tentar fazer login.",
      });
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div className="h-screen w-screen flex items-stretch justify-center bg-gradient-to-br from-slate-100 to-blue-50 p-0 m-0 overflow-hidden">
      <div className="flex w-full h-full bg-white">
        {/* Painel esquerdo */}
        <div className="hidden lg:flex lg:w-3/5 bg-[#0099CC] text-white p-8 lg:p-12 flex-col justify-center">
          <h1 className="text-3xl lg:text-5xl font-bold mb-2 lg:mb-3">Bem-vindo de volta!</h1>
          <h2 className="text-2xl lg:text-4xl font-semibold mb-8 lg:mb-12">FamaChat</h2>
          <p className="mb-10 lg:mb-14 opacity-90 text-lg lg:text-xl">Acesse sua conta para gerenciar seus recursos imobiliários e acompanhar seu progresso.</p>
          
          <div className="space-y-6 lg:space-y-10 pl-2 lg:pl-4">
            <div className="flex items-center">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white/20 rounded-full flex items-center justify-center mr-4 lg:mr-6">
                <Check className="h-5 w-5 lg:h-6 lg:w-6" />
              </div>
              <span className="text-lg lg:text-xl">Acesso rápido e seguro</span>
            </div>
            <div className="flex items-center">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white/20 rounded-full flex items-center justify-center mr-4 lg:mr-6">
                <Check className="h-5 w-5 lg:h-6 lg:w-6" />
              </div>
              <span className="text-lg lg:text-xl">Gerenciamento simplificado</span>
            </div>
            <div className="flex items-center">
              <div className="w-10 h-10 lg:w-12 lg:h-12 bg-white/20 rounded-full flex items-center justify-center mr-4 lg:mr-6">
                <Check className="h-5 w-5 lg:h-6 lg:w-6" />
              </div>
              <span className="text-lg lg:text-xl">Suporte 24/7</span>
            </div>
          </div>
        </div>

        {/* Painel direito */}
        <div className="w-full lg:w-2/5 p-0 flex flex-col items-center justify-center">
          <div className="w-full max-w-md px-4 xxs:px-6 sm:px-8 md:px-10">
            <div className="mb-6 xxs:mb-8 md:mb-10 text-center md:text-left">
              <h2 className="text-xl xxs:text-2xl sm:text-3xl md:text-4xl font-bold text-gray-800 mb-2 md:mb-4">Bem-vindo de volta!</h2>
              <p className="text-gray-500 text-base xxs:text-lg sm:text-xl">FamaChat</p>
            </div>

          <Form {...form}>
            <form onSubmit={form.handleSubmit(onSubmit)} className="space-y-6 md:space-y-8">
              <FormField
                control={form.control}
                name="email"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm md:text-base font-medium">Email</FormLabel>
                    <div className="relative">
                      <Mail className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 md:h-5 md:w-5" />
                      <FormControl>
                        <Input 
                          className="pl-10 py-5 md:py-7 text-base md:text-lg"
                          type="email"
                          placeholder="Digite seu email" 
                          {...field} 
                          disabled={isLoading}
                        />
                      </FormControl>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="password"
                render={({ field }) => (
                  <FormItem>
                    <FormLabel className="text-sm md:text-base font-medium">Senha</FormLabel>
                    <div className="relative">
                      <Lock className="absolute left-3 top-1/2 transform -translate-y-1/2 text-gray-400 h-4 w-4 md:h-5 md:w-5" />
                      <FormControl>
                        <Input 
                          className="pl-10 pr-10 py-5 md:py-7 text-base md:text-lg"
                          type={showPassword ? "text" : "password"}
                          placeholder="Digite sua senha" 
                          {...field} 
                          disabled={isLoading}
                        />
                      </FormControl>
                      <button
                        type="button"
                        className="absolute right-3 top-1/2 transform -translate-y-1/2 text-gray-400 hover:text-gray-600 focus:outline-none"
                        onClick={() => setShowPassword(!showPassword)}
                        tabIndex={-1}
                      >
                        {showPassword ? (
                          <EyeOff className="h-4 w-4 md:h-5 md:w-5" />
                        ) : (
                          <Eye className="h-4 w-4 md:h-5 md:w-5" />
                        )}
                      </button>
                    </div>
                    <FormMessage />
                  </FormItem>
                )}
              />

              <FormField
                control={form.control}
                name="rememberMe"
                render={({ field }) => (
                  <div className="flex items-center">
                    <FormControl>
                      <Checkbox
                        checked={field.value}
                        onCheckedChange={field.onChange}
                        className="rounded-sm"
                        disabled={isLoading}
                      />
                    </FormControl>
                    <div className="ml-2 text-sm md:text-base text-gray-700">
                      Lembrar-me
                    </div>
                  </div>
                )}
              />
              
              <Button 
                type="submit" 
                className="w-full py-6 md:py-8 bg-[#0099CC] hover:bg-[#0077a3] text-white text-lg md:text-xl font-medium" 
                disabled={isLoading} 
                size="lg"
              >
                {isLoading ? "Entrando..." : "Entrar"}
              </Button>
            </form>
          </Form>
          
          {/* Footer da página de login */}
          <div className="mt-8 pt-6 border-t border-gray-200 text-center space-y-2">
            <div className="text-sm text-gray-600">
              © {new Date().getFullYear()} Fama Negócios Imobiliários
            </div>
            <div className="flex justify-center space-x-4 text-sm">
              <button
                onClick={() => navigate('/privacy')}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Política de Privacidade
              </button>
              <span className="text-gray-300">•</span>
              <button
                onClick={() => navigate('/terms')}
                className="text-blue-600 hover:text-blue-800 underline"
              >
                Termos de Uso
              </button>
            </div>
            <div className="text-xs text-gray-500">
              Sistema em conformidade com a LGPD
            </div>
          </div>
          </div>
        </div>
      </div>
    </div>
  );
}