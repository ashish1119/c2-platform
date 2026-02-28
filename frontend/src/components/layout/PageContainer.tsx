export default function PageContainer({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <div>
      <h1
        style={{
          position: "absolute",
          width: "1px",
          height: "1px",
          padding: 0,
          margin: "-1px",
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {title}
      </h1>
      {children}
    </div>
  );
}