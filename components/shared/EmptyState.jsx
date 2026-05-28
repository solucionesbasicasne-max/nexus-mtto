import React from 'react';
import { Button } from '@/components/ui/button';
import { Inbox } from 'lucide-react';

export default function EmptyState({ icon: Icon = Inbox, title, description, actionLabel, onAction }) {
  return (
    <div className="flex flex-col items-center justify-center py-16 text-center">
      <div className="w-14 h-14 rounded-2xl bg-muted flex items-center justify-center mb-4">
        <Icon className="w-7 h-7 text-muted-foreground" />
      </div>
      <h3 className="text-lg font-semibold text-foreground mb-1">{title}</h3>
      {description && <p className="text-sm text-muted-foreground max-w-sm mb-4">{description}</p>}
      {actionLabel && onAction && (
        <Button onClick={onAction} variant="outline" size="sm">{actionLabel}</Button>
      )}
    </div>
  );
}