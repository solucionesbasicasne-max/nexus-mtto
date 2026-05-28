import React from 'react';
import { Label } from '@/components/ui/label';
import { Select, SelectContent, SelectItem, SelectTrigger, SelectValue } from '@/components/ui/select';

/**
 * Renders a cascade of hierarchy selects.
 * levels: [{ key, label, items, parentKey, parentValue }]
 */
export default function HierarchySelector({ levels, values, onChange }) {
  return (
    <div className="grid gap-3">
      {levels.map(level => {
        const available = level.parentKey
          ? level.items.filter(i => i[level.parentKey] === values[level.parentKey])
          : level.items;
        const isDisabled = level.parentKey && !values[level.parentKey];
        return (
          <div key={level.key}>
            <Label className="text-xs">{level.label}{level.required && ' *'}</Label>
            <Select
              value={values[level.key] || ''}
              onValueChange={v => onChange(level.key, v)}
              disabled={isDisabled}
            >
              <SelectTrigger className="h-9">
                <SelectValue placeholder={isDisabled ? `Selecciona ${levels[levels.findIndex(l => l.key === level.parentKey)]?.label} primero` : `Seleccionar ${level.label}`} />
              </SelectTrigger>
              <SelectContent>
                {available.map(item => (
                  <SelectItem key={item.id} value={item.id}>{item.name || item.code}</SelectItem>
                ))}
                {available.length === 0 && <SelectItem value="__empty__" disabled>Sin opciones</SelectItem>}
              </SelectContent>
            </Select>
          </div>
        );
      })}
    </div>
  );
}