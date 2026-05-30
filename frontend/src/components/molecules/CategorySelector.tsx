interface CategoryItem {
  id: string;
  icon: string;
  label: string;
  accentClass?: string;
}

interface CategorySelectorProps {
  categories: CategoryItem[];
  selected: string;
  onSelect: (id: string) => void;
  ariaLabel: string;
}

export function CategorySelector({ categories, selected, onSelect, ariaLabel }: CategorySelectorProps) {
  return (
    // Wrapper relative para hostear el fade gradient en el borde derecho.
    // El fade le indica al usuario que hay más opciones a la derecha en mobile
    // (sólo se muestra cuando hay scroll horizontal, oculto en sm+ con grid).
    <div className="relative">
      <div
        className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-7 sm:overflow-visible sm:px-0"
        role="group"
        aria-label={ariaLabel}
      >
        {categories.map((cat) => (
          <button
            key={cat.id}
            type="button"
            onClick={() => onSelect(cat.id)}
            aria-pressed={selected === cat.id}
            className={`pressable menu-category-selector flex-none flex flex-col items-center justify-center w-[72px] min-h-[4.5rem] rounded-xl px-1 py-2.5 border transition-colors sm:w-auto sm:flex-1 ${
              selected === cat.id
                ? (cat.accentClass ?? 'border-primary/50 bg-primary/15 text-primary') + ' shadow-sm'
                : 'border-app-border bg-app-surface/80 text-app-secondary hover:border-app-border hover:text-app-text hover:bg-app-muted/60'
            }`}
          >
            <span aria-hidden="true" className="menu-category-selector__icon text-xl leading-none">{cat.icon}</span>
            <span className="menu-category-selector__label text-[0.7rem] font-medium leading-tight xs:text-[0.75rem] sm:text-xs">
              {cat.label}
            </span>
          </button>
        ))}
      </div>
      {/* Fade gradient indicando scroll horizontal disponible. Solo visible
          mientras el contenido excede el viewport (overflow-x-auto activo);
          en sm+ desaparece junto con el scroll. */}
      <div
        aria-hidden="true"
        className="pointer-events-none absolute inset-y-0 right-0 w-10 bg-gradient-to-l from-[var(--color-bg-app)] to-transparent sm:hidden"
      />
    </div>
  );
}
