// import Card from "./Card";

// export default function MetricCard({
//   label,
//   value,
// }: {
//   label: string;
//   value: string | number;
// }) {
//   return (
//     <Card>
//       <div
//         style={{
//           display: "flex",
//           flexDirection: "column",
//           gap: 8,
//         }}
//       >
//         {/* Top Accent Line */}
//         <div
//           style={{
//             height: 3,
//             width: 40,
//             background: "#11c1ca",
//             borderRadius: 2,
//           }}
//         />

//         {/* Label */}
//         <div
//           style={{
//             fontSize: 13,
//             color: "#64748B",
//             fontWeight: 500,
//             letterSpacing: "0.3px",
//           }}
//         >
//           {label}
//         </div>

//         {/* Value */}
//         <div
//           style={{
//             fontSize: 26,
//             fontWeight: 700,
//             color: "#0f172a",
//             lineHeight: 1.2,
//           }}
//         >
//           {value}
//         </div>
//       </div>
//     </Card>
//   );
// }



import Card from "./Card";
import { useTheme } from "../../context/ThemeContext";

export default function MetricCard({
  label,
  value,
  accent = "#11C1CA",
}: {
  label: string;
  value: string | number;
  accent?: string;
}) {
  const { theme } = useTheme();
  const isDark = theme.mode === "dark";

  return (
    <Card>
      <div
        style={{
          display: "flex",
          flexDirection: "column",
          gap: 12,
        }}
      >
        {/* 🔹 Accent Line */}
        <div
          style={{
            height: 3,
            width: 42,
            background: accent,
            borderRadius: 2,
            boxShadow: `0 0 10px ${accent}80`,
          }}
        />

        {/* 🔹 Label */}
        <div
          style={{
            fontSize: 13,
            fontWeight: 500,
            letterSpacing: "0.3px",
            color: isDark ? "#94A3B8" : "#475569",
          }}
        >
          {label}
        </div>

        {/* 🔹 Value */}
        <div
          style={{
            fontSize: 28,
            fontWeight: 700,
            lineHeight: 1.2,
            color: isDark ? "#E2E8F0" : "#0f172a",
          }}
        >
          {value}
        </div>
      </div>
    </Card>
  );
}