import React, { useState, useEffect } from 'react';
import Pagination from './Pagination';
import useHighlightRow from '../../hooks/useHighlightRow';

const DataTable = ({
  columns,
  data,
  emptyMessage = 'No records found.',
  defaultPageSize = 10,
}) => {
  const [page, setPage]         = useState(1);
  const [pageSize, setPageSize] = useState(defaultPageSize);

  // Reset to page 1 when data changes (e.g. after search)
  useEffect(() => { setPage(1); }, [data.length]);

  const { setRowRef, rowClass } = useHighlightRow({
    items: data,
    displayed: data,
    pageSize,
    setPage,
  });

  const total     = data.length;
  const paginated = data.slice((page - 1) * pageSize, page * pageSize);

  return (
    <div className="overflow-hidden rounded-xl border border-blue-200/70 bg-white shadow-soft">

      {/* ── Table ── */}
      <div className="overflow-x-auto">
        <table className="min-w-full text-sm" style={{ borderCollapse: 'collapse' }}>
          <thead style={{ background: 'linear-gradient(90deg, #1e3a8a 0%, #1d4ed8 50%, #2563eb 100%)' }}>
            <tr>
              {columns.map((col) => (
                <th
                  key={col.key}
                  className="whitespace-nowrap px-4 py-2.5 text-left text-[11px] font-bold uppercase tracking-wider text-blue-100"
                  style={{ borderBottom: '1px solid rgba(147,197,253,0.3)' }}
                >
                  {col.header}
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {total === 0 && (
              <tr>
                <td colSpan={columns.length} className="px-4 py-10 text-center text-ink-400">
                  {emptyMessage}
                </td>
              </tr>
            )}
            {paginated.map((row, i) => (
              <tr
                key={row._id || i}
                ref={setRowRef(row)}
                className={rowClass(row, 'hover:bg-blue-50/30 transition-colors')}
                style={{ borderBottom: '1px solid #f1f5f9' }}
              >
                {columns.map((col) => (
                  <td key={col.key} className="whitespace-nowrap px-4 py-3 text-ink-700">
                    {col.render ? col.render(row) : row[col.key]}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>

      {/* ── Pagination footer ── */}
      <Pagination
        page={page}
        pageSize={pageSize}
        total={total}
        onPage={setPage}
        onPageSize={(s) => { setPageSize(s); setPage(1); }}
      />
    </div>
  );
};

export default DataTable;
