import type { CSSProperties } from 'react';

export function Skeleton({ width = '100%', height = 14 }: { width?: CSSProperties['width']; height?: number }) {
  return <span className="skeleton" aria-hidden="true" style={{ width, height }} />;
}

export function TableSkeleton({ columns, rows = 5, label = 'Loading list…' }: { columns: string[]; rows?: number; label?: string }) {
  return <div role="status" aria-label={label}>
    <span className="sr-only">{label}</span>
    <div className="table-container" aria-hidden="true"><table>
      <thead><tr>{columns.map((column, index) => <th key={index}>{column}</th>)}</tr></thead>
      <tbody>{Array.from({ length: rows }, (_, row) => <tr key={row}>
        {columns.map((_, column) => <td key={column}><Skeleton width={column === 0 ? '85%' : '70%'} />{column === 0 && <Skeleton width="55%" height={10} />}</td>)}
      </tr>)}</tbody>
    </table></div>
  </div>;
}

export function CardListSkeleton({ variant = 'jobs', count = 6, label = 'Loading opportunities…' }: { variant?: 'jobs' | 'resumes'; count?: number; label?: string }) {
  return <div role="status" aria-label={label}>
    <span className="sr-only">{label}</span>
    <div className={variant === 'jobs' ? 'grid-3' : 'grid-2'} aria-hidden="true">
      {Array.from({ length: count }, (_, index) => <div className={variant === 'jobs' ? 'card job-card' : 'card'} key={index}>
        <div className="job-card-top"><Skeleton width={42} height={42} /><Skeleton width={70} height={24} /></div>
        <div className="skeleton-copy"><Skeleton width="80%" height={20} /><Skeleton width="55%" /><Skeleton width="65%" height={12} /></div>
        <div className="skeleton-copy skeleton-description"><Skeleton /><Skeleton /><Skeleton width="75%" /></div>
        <div className="job-card-footer"><Skeleton width={100} height={25} /><Skeleton width={85} height={31} /></div>
      </div>)}
    </div>
  </div>;
}
