# Guia de Cores do Sistema FamaChat

## Cores Principais (baseadas na página de login)

### Azul Principal
- **Classe Tailwind**: `login-blue` ou `system-blue`
- **Valor**: `#00B2E2`
- **RGB**: `rgb(0, 178, 226)`
- **HSL**: `hsl(193, 100%, 44%)`
- **Uso**: Botões principais, links, elementos de destaque

### Azul Hover
- **Classe Tailwind**: `login-blue-hover`
- **Valor**: `#0077a3`
- **Uso**: Estado hover de botões azuis

### Cinza Escuro
- **Classe Tailwind**: `login-gray-dark` ou `system-dark`
- **Valor**: `#333333`
- **RGB**: `rgb(51, 51, 51)`
- **HSL**: `hsl(0, 0%, 20%)`
- **Uso**: Títulos principais, texto de destaque

### Cinza Médio
- **Classe Tailwind**: `login-gray` ou `system-gray`
- **Valor**: `#B3B3B3`
- **RGB**: `rgb(179, 179, 179)`
- **HSL**: `hsl(0, 0%, 70%)`
- **Uso**: Texto secundário, bordas, ícones

## Cores Complementares (da página de login)

### Cinza Claro
- **Classe Tailwind**: `login-gray-light`
- **Valor**: `#6b7280` (equivalente ao text-gray-500)
- **Uso**: Subtítulos, texto descritivo

### Cinza para Texto
- **Classe Tailwind**: `login-gray-text`
- **Valor**: `#374151` (equivalente ao text-gray-700)
- **Uso**: Texto de formulários, labels

### Cinza para Ícones
- **Classe Tailwind**: `login-gray-icon`
- **Valor**: `#9ca3af` (equivalente ao text-gray-400)
- **Uso**: Ícones de campos, elementos secundários

## Exemplos de Uso

### Botões
```tsx
// Botão principal
<Button className="bg-login-blue hover:bg-login-blue-hover text-white">
  Confirmar
</Button>

// Botão secundário
<Button className="bg-login-gray text-login-gray-dark border border-login-gray">
  Cancelar
</Button>
```

### Texto
```tsx
// Título principal
<h1 className="text-login-gray-dark font-bold">
  Título Principal
</h1>

// Subtítulo
<p className="text-login-gray-light">
  Texto descritivo
</p>

// Label de formulário
<label className="text-login-gray-text">
  Campo obrigatório
</label>
```

### Ícones
```tsx
<Icon className="text-login-gray-icon hover:text-login-blue" />
```

## Variáveis CSS do Sistema

As seguintes variáveis CSS estão configuradas automaticamente:

- `--primary`: `193 100% 44%` (login-blue)
- `--foreground`: `0 0% 20%` (login-gray-dark)
- `--muted-foreground`: `0 0% 70%` (login-gray)
- `--ring`: `193 100% 44%` (login-blue)

## Gradientes

### Fundo da página de login
```css
bg-gradient-to-br from-slate-100 to-blue-50
```

## Fonte

Todo o sistema usa a fonte **Montserrat**:
- `font-heading`: Para títulos
- `font-body`: Para corpo de texto
- `font-sans`: Fonte padrão do sistema
