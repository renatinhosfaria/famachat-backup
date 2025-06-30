import React, { useEffect, useState } from "react";
import { Input, InputProps } from "@/components/ui/input";
import { formatPhoneNumber } from "@/lib/utils";

interface PhoneInputProps extends Omit<InputProps, "onChange"> {
  value: string;
  onChange: (value: string) => void;
}

/**
 * Componente de input para telefone com máscara automática
 * Formata automaticamente para (99) 99999-9999 ou (99) 9999-9999
 */
const PhoneInput = React.forwardRef<HTMLInputElement, PhoneInputProps>(
  ({ value, onChange, ...props }, ref) => {
    const [inputValue, setInputValue] = useState(value);

    // Formatar valor inicial
    useEffect(() => {
      const formatted = formatPhoneNumber(value);
      if (formatted !== inputValue) {
        setInputValue(formatted);
      }
    }, [value]);

    // Lidar com mudanças no input
    const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
      const rawValue = e.target.value;
      const formatted = formatPhoneNumber(rawValue);
      
      setInputValue(formatted);
      onChange(formatted);
    };

    return (
      <Input 
        ref={ref}
        type="tel" 
        value={inputValue} 
        onChange={handleInputChange}
        placeholder="(00) 00000-0000"
        {...props}
      />
    );
  }
);

PhoneInput.displayName = "PhoneInput";

export { PhoneInput };