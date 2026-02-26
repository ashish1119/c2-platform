export default function PageContainer({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1 style={{ fontSize: "28px", marginBottom: "24px" }}>{title}</h1>
      {children}
    </div>
  );
}