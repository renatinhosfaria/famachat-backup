# Sistema de Breakpoints Responsivos

## Estrutura dos Breakpoints

Este sistema implementa 4 padrões de breakpoint seguindo as práticas modernas de responsividade:

### 1. Mobile (até 767px)
- **Range**: 0px - 767px
- **Uso**: `mobile:` ou `@media (max-width: 767px)`
- **Container**: padding 16px, largura 100%
- **Grid**: 1-2 colunas
- **Font sizes**: Otimizadas para mobile

### 2. Tablet (768px - 1279px)
- **Range**: 768px - 1279px
- **Uso**: `tablet:` ou `@media (min-width: 768px) and (max-width: 1279px)`
- **Container**: padding 24px, max-width 768px
- **Grid**: 2-4 colunas
- **Font sizes**: Tamanhos médios

### 3. Desktop (1280px - 1535px)
- **Range**: 1280px - 1535px
- **Uso**: `desktop:` ou `@media (min-width: 1280px) and (max-width: 1535px)`
- **Container**: padding 32px, max-width 1280px
- **Grid**: 3-6 colunas
- **Font sizes**: Tamanhos grandes

### 4. Wide (acima de 1536px)
- **Range**: 1536px+
- **Uso**: `wide:` ou `@media (min-width: 1536px)`
- **Container**: padding 48px, max-width 1536px
- **Grid**: 4-12 colunas
- **Font sizes**: Tamanhos extra grandes

## Como Usar

### 1. Classes Tailwind Responsivas

```html
<!-- Container responsivo -->
<div class="container-responsive">
  <!-- Conteúdo -->
</div>

<!-- Grid responsivo -->
<div class="grid grid-responsive gap-spacing-responsive">
  <!-- Itens do grid -->
</div>

<!-- Texto responsivo -->
<h1 class="text-responsive-h1">Título</h1>
<p class="text-responsive-body">Parágrafo</p>
```

### 2. Breakpoints Específicos

```html
<!-- Mobile first approach -->
<div class="text-sm sm:text-base lg:text-lg xl:text-xl">
  Texto que cresce com o breakpoint
</div>

<!-- Grid responsivo por breakpoint -->
<div class="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
  <!-- Itens -->
</div>

<!-- Padding responsivo -->
<div class="p-4 sm:p-6 lg:p-8 xl:p-12">
  <!-- Conteúdo -->
</div>
```

### 3. Classes Utilitárias Customizadas

```html
<!-- Flexbox responsivo -->
<div class="flex-responsive">
  <!-- Coluna no mobile, linha no tablet+ -->
</div>

<!-- Card responsivo -->
<div class="card-responsive">
  <!-- Padding automático baseado no breakpoint -->
</div>

<!-- Button responsivo -->
<button class="button-responsive">
  <!-- Padding automático baseado no breakpoint -->
</button>
```

## Tamanhos de Fonte por Breakpoint

### Mobile
- H1: 24px (1.5rem)
- H2: 20px (1.25rem)
- H3: 18px (1.125rem)
- Body: 16px (1rem)
- Small: 14px (0.875rem)

### Tablet
- H1: 28px (1.75rem)
- H2: 24px (1.5rem)
- H3: 20px (1.25rem)
- Body: 18px (1.125rem)
- Small: 16px (1rem)

### Desktop
- H1: 32px (2rem)
- H2: 28px (1.75rem)
- H3: 24px (1.5rem)
- Body: 20px (1.25rem)
- Small: 18px (1.125rem)

### Wide
- H1: 36px (2.25rem)
- H2: 30px (1.875rem)
- H3: 26px (1.625rem)
- Body: 22px (1.375rem)
- Small: 20px (1.25rem)

## Grid System

### Mobile (1-2 colunas)
```html
<div class="grid grid-mobile-1">1 coluna</div>
<div class="grid grid-mobile-2">2 colunas</div>
```

### Tablet (2-4 colunas)
```html
<div class="grid grid-tablet-2">2 colunas</div>
<div class="grid grid-tablet-3">3 colunas</div>
<div class="grid grid-tablet-4">4 colunas</div>
```

### Desktop (3-6 colunas)
```html
<div class="grid grid-desktop-3">3 colunas</div>
<div class="grid grid-desktop-4">4 colunas</div>
<div class="grid grid-desktop-5">5 colunas</div>
<div class="grid grid-desktop-6">6 colunas</div>
```

### Wide (4-12 colunas)
```html
<div class="grid grid-wide-4">4 colunas</div>
<div class="grid grid-wide-6">6 colunas</div>
<div class="grid grid-wide-8">8 colunas</div>
<div class="grid grid-wide-12">12 colunas</div>
```

## Espaçamentos Responsivos

### Padding
- Mobile: 16px
- Tablet: 24px
- Desktop: 32px
- Wide: 48px

### Margins
- Mobile: 8px
- Tablet: 12px
- Desktop: 16px
- Wide: 24px

### Gaps
- Mobile: 16px
- Tablet: 20px
- Desktop: 24px
- Wide: 32px

## Exemplo Prático de Implementação

```html
<div class="container-responsive">
  <header class="padding-responsive margin-responsive">
    <h1 class="text-responsive-h1">Título Principal</h1>
    <p class="text-responsive-body">Descrição do conteúdo</p>
  </header>
  
  <main class="grid grid-responsive gap-spacing-responsive">
    <div class="card-responsive">
      <h2 class="text-responsive-h2">Card 1</h2>
      <p class="text-responsive-small">Conteúdo do card</p>
    </div>
    
    <div class="card-responsive">
      <h2 class="text-responsive-h2">Card 2</h2>
      <p class="text-responsive-small">Conteúdo do card</p>
    </div>
  </main>
</div>
```

## Boas Práticas

1. **Mobile First**: Sempre comece com o design mobile e adicione breakpoints maiores
2. **Container**: Use `container-responsive` para layouts centralizados
3. **Grid**: Use as classes de grid responsivas para layouts dinâmicos
4. **Texto**: Use as classes `text-responsive-*` para tipografia consistente
5. **Espaçamento**: Use as classes de spacing responsivo para consistência visual
6. **Teste**: Sempre teste em todos os breakpoints durante o desenvolvimento
