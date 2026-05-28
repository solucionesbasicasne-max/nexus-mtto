import React from 'react';
import { ChevronRight } from 'lucide-react';

export default function HierarchyBreadcrumb({ items }) {
  // items: [{ label: 'Empresa', value: 'ACME' }, ...]
  const filtered = items.filter(i => i.value && i.value !== '—');
  if (filtered.length === 0) return null;
  return (
    <div className="flex items-center gap-1 flex-wrap text-xs text-muted-foreground mb-3">
      {filtered.map((item, idx) => (
        <React.Fragment key={idx}>
          {idx > 0 && <ChevronRight className="w-3 h-3 text-muted-foreground/40" />}
          <span className={idx === filtered.length - 1 ? 'text-foreground font-medium' : ''}>
            <span className="text-muted-foreground/60">{item.label}: </span>{item.value}
          </span>
        </React.Fragment>
      ))}
    </div>
  );
}