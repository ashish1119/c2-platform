// export default function PageContainer({
//   title,
//   children,
// }: {
//   title: string;
//   children: React.ReactNode;
// }) {
//   return (
//     <div>
//       <h1
//         style={{
//           position: "absolute",
//           width: "1px",
//           height: "1px",
//           padding: 0,
//           margin: "-1px",
//           overflow: "hidden",
//           clip: "rect(0, 0, 0, 0)",
//           whiteSpace: "nowrap",
//           border: 0,
//         }}
//       >
//         {title}
//       </h1>
//       {children}
//     </div>
//   );
// }


export default function PageContainer({
  title,
  children,
}: {
  title: string;
  children: React.ReactNode;
}) {
  return (
    <section
      style={{
        display: "flex",
        flexDirection: "column",
        gap: "16px",
        height: "100%",
      }}
    >
      {/* Accessible hidden title (unchanged functionality) */}
      <h1
        style={{
          position: "absolute",
          width: 1,
          height: 1,
          padding: 0,
          margin: -1,
          overflow: "hidden",
          clip: "rect(0, 0, 0, 0)",
          whiteSpace: "nowrap",
          border: 0,
        }}
      >
        {title}
      </h1>

      {/* Visible content wrapper */}
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: "16px",
          width: "100%",
          height: "100%",
        }}
      >
        {children}
      </div>
    </section>
  );
}