import * as React from "react";
import { Input, InputProps } from "@/components/ui/input";
import { formatCurrency } from "@/lib/date-utils";

interface CurrencyInputProps extends Omit<InputProps, "onChange" | "value"> {
  value: string | undefined;
  onChange: (value: string) => void;
}

/**
 * Componente de input para valores monetários que automaticamente formata
 * a entrada no padrão brasileiro: R$ 1.234,56
 */
export const CurrencyInput = React.forwardRef<HTMLInputElement, CurrencyInputProps>(
  ({ value, onChange, ...props }, ref) => {
    // Remove formatação para exibir apenas os números quando o usuário está digitando
    const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      // Obter apenas os números e vírgula
      const inputValue = e.target.value.replace(/[^\d,]/g, "");
      
      // Formatar com pontos para milhares à medida que digita
      let formattedValue = "";
      if (inputValue) {
        // Separar parte inteira e decimal (se houver)
        const parts = inputValue.split(",");
        const integerPart = parts[0];
        
        // Formatar parte inteira com pontos a cada 3 dígitos
        let formattedInteger = "";
        for (let i = 0; i < integerPart.length; i++) {
          if (i > 0 && (integerPart.length - i) % 3 === 0) {
            formattedInteger += ".";
          }
          formattedInteger += integerPart[i];
        }
        
        // Adicionar parte decimal se existir
        if (parts.length > 1) {
          formattedValue = `R$ ${formattedInteger},${parts[1]}`;
        } else {
          formattedValue = `R$ ${formattedInteger}`;
        }
      } else {
        formattedValue = "";
      }
      
      // Chamar o onChange com o valor formatado
      onChange(formattedValue);
    };

    // Formatar para exibição quando o campo perde o foco
    const handleBlur = (e: React.FocusEvent<HTMLInputElement>) => {
      // Se estiver vazio, não formatar
      if (!value || value === "R$ ") {
        onChange("");
        return;
      }
      
      try {
        // Preservar a formatação atual (com pontos e vírgula)
        if (value && value.startsWith("R$")) {
          // O valor já está formatado corretamente durante a digitação
          return;
        }
        
        // Caso o valor não esteja formatado, aplicar formatação
        // Limpar valores
        const numericValue = value.replace(/[^\d,]/g, "").replace(",", ".");
        
        // Converter para número
        const parsedValue = parseFloat(numericValue);
        
        // Se for um número válido, formatar corretamente
        if (!isNaN(parsedValue)) {
          onChange(formatCurrency(parsedValue));
        }
      } catch (error) {
        // Se houver erro ao formatar, manter o valor original
        
      }
    };

    // Garantir que sempre tenha o prefixo R$ quando o campo recebe o foco
    const handleFocus = (e: React.FocusEvent<HTMLInputElement>) => {
      if (value && !value.startsWith("R$")) {
        onChange(`R$ ${value}`);
      }
    };

    // Certificar que o valor sempre começa com R$
    const displayValue = value
      ? value.startsWith("R$") 
        ? value 
        : `R$ ${value}`
      : "";

    return (
      <Input
        {...props}
        ref={ref}
        value={displayValue}
        onChange={handleChange}
        onBlur={handleBlur}
        onFocus={handleFocus}
      />
    );
  }
);

CurrencyInput.displayName = "CurrencyInput";