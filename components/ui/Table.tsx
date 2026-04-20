export interface TableColumn<T> {
  key: string;
  header: string;
  render?: (item: T) => React.ReactNode;
  className?: string;
}

export interface TableProps<T> {
  columns: TableColumn<T>[];
  data: T[];
  keyExtractor: (item: T) => string;
  emptyMessage?: string;
}

export function Table<T>({ columns, data, keyExtractor, emptyMessage = 'No data available' }: TableProps<T>) {
  if (data.length === 0) {
    return (
      <div style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent: 'center',
        padding: 'var(--space-12)',
        color: 'var(--color-outline)',
        fontFamily: 'var(--font-body)',
      }}>
        {emptyMessage}
      </div>
    );
  }

  return (
    <div style={{ overflowX: 'auto' }}>
      <table style={{ width: '100%' }}>
        <thead>
          <tr style={{ borderBottom: '1px solid var(--color-outline-variant)' }}>
            {columns.map((column) => (
              <th
                key={column.key}
                style={{
                  padding: 'var(--space-3) var(--space-4)',
                  textAlign: 'left',
                  fontFamily: 'var(--font-label)',
                  fontSize: 'var(--text-label-sm)',
                  fontWeight: '600',
                  color: 'var(--color-outline)',
                  letterSpacing: 'var(--tracking-wider)',
                  textTransform: 'uppercase',
                }}
              >
                {column.header}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {data.map((item) => (
            <tr
              key={keyExtractor(item)}
              style={{
                borderBottom: '1px solid var(--color-outline-variant)',
                transition: 'background-color var(--transition-fast)',
              }}
              onMouseEnter={(e) => {
                e.currentTarget.style.backgroundColor = 'var(--color-surface-container)';
              }}
              onMouseLeave={(e) => {
                e.currentTarget.style.backgroundColor = 'transparent';
              }}
            >
              {columns.map((column) => (
                <td
                  key={column.key}
                  style={{
                    padding: 'var(--space-3) var(--space-4)',
                    fontFamily: 'var(--font-body)',
                    fontSize: 'var(--text-body-md)',
                    color: 'var(--color-on-surface-variant)',
                  }}
                >
                  {column.render
                    ? column.render(item)
                    : String((item as Record<string, unknown>)[column.key] ?? '')}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}