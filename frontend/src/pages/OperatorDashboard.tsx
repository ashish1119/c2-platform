import AlertTable from "../components/AlertTable";
import MapView from "../components/MapView";

export default function OperatorDashboard() {
  return (
    <div>
      <h2>Operator Dashboard</h2>
      <MapView />
      <AlertTable />
    </div>
  );
}