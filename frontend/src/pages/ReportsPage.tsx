export default function ReportsPage() {
  const exportReport = () => {
    alert("Export triggered");
  };

  return (
    <div>
      <h2>Reports</h2>
      <button onClick={exportReport}>Export CSV</button>
    </div>
  );
}