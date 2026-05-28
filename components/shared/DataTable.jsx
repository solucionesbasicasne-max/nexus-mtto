import React from 'react';
import { Table, TableBody, TableCell, TableHead, TableHeader, TableRow } from '@/components/ui/table';
import { Card } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';

export default function DataTable({ columns, data, isLoading, onRowClick, emptyMessage = 'No hay datos' }) {
  if (isLoading) {
    return (
      <Card className="border-0 shadow-sm overflow-hidden">
        <div className="p-4 space-y-3">
          {Array(5).fill(0).map((_, i) => (
            <Skeleton key={i} className="h-10 w-full" />
          ))}
        </div>
      </Card>
    );
  }

  return (
    <Card className="border-0 shadow-sm overflow-hidden">
      <div className="overflow-x-auto">
        <Table>
          <TableHeader>
            <TableRow className="bg-muted/50 hover:bg-muted/50">
              {columns.map(col => (
                <TableHead key={col.key} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground whitespace-nowrap">
                  {col.label}
                </TableHead>
              ))}
            </TableRow>
          </TableHeader>
          <TableBody>
            {data.length === 0 ? (
              <TableRow>
                <TableCell colSpan={columns.length} className="text-center text-muted-foreground py-12">
                  {emptyMessage}
                </TableCell>
              </TableRow>
            ) : (
              data.map((row, i) => (
                <TableRow
                  key={row.id || i}
                  className={onRowClick ? 'cursor-pointer hover:bg-muted/30 transition-colors' : ''}
                  onClick={() => onRowClick?.(row)}
                >
                  {columns.map(col => (
                    <TableCell key={col.key} className="text-sm whitespace-nowrap">
                      {col.render ? col.render(row) : row[col.key]}
                    </TableCell>
                  ))}
                </TableRow>
              ))
            )}
          </TableBody>
        </Table>
      </div>
    </Card>
  );
}