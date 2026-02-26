import Card from "./Card";

export default function MetricCard({
  label,
  value,
}: {
  label: string;
  value: string | number;
}) {
  return (
    <Card>
      <div style={{ fontSize: "14px", color: "#64748B" }}>{label}</div>
      <div style={{ fontSize: "24px", fontWeight: 600 }}>{value}</div>
    </Card>
  );
}