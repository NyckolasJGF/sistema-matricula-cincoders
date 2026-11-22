export default function Table({ rows, columns, action, renderCell = {} }) {
  return <div className="table-scroll"><table><thead><tr>{columns.map((column) => <th key={column}>{column}</th>)}{action && <th>Ação</th>}</tr></thead><tbody>{rows.length ? rows.map((row, index) => <tr key={row.id ?? row.sectionId ?? index}>{columns.map((column) => <td key={column}>{renderCell[column] ? renderCell[column](row[column], row) : row[column]}</td>)}{action && <td>{action(row)}</td>}</tr>) : <tr><td colSpan={columns.length + 1}>Nenhum resultado.</td></tr>}</tbody></table></div>;
}
