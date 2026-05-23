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
}

export function CategorySelector({ categories, selected, onSelect }: CategorySelectorProps) {
  return (
    <div className="-mx-4 flex gap-2 overflow-x-auto px-4 pb-1 sm:mx-0 sm:grid sm:grid-cols-6 sm:overflow-visible sm:px-0">
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
          <span className="menu-category-selector__icon text-xl leading-none">{cat.icon}</span>
          <span className="menu-category-selector__label text-[0.7rem] font-medium leading-tight xs:text-[0.75rem] sm:text-xs">
            {cat.label}
          </span>
        </button>
      ))}
    </div>
  );
}
