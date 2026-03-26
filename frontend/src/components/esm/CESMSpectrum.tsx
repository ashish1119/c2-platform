import React, { useState, useMemo, useEffect, useRef } from "react";
//import AppLayout from "../../components/layout/AppLayout";
//import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";

// If you use Recharts, install it: npm install recharts
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  ResponsiveContainer,
} from "recharts";


export default function CESMSpectrum() {
    const spectrumData = useMemo(() => Array.from({ length: 100 }, (_, i) => ({
        freq: 400 + i * 1,
        level: Math.random() * 20 - 120 + (i === 50 ? 30 : 0),
    })),[]);

    return (
        <Card>
            <div style={{ height: 220 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart data={spectrumData} margin={{ top: 20, right: 30, left: 0, bottom: 0 }}>
                        <CartesianGrid stroke="rgba(255,255,255,0.08)" />
                        <XAxis dataKey="freq" tick={{ fill: "#ffffff" }} tickLine={{ stroke: "rgba(255,255,255,0.3)" }} axisLine={{ stroke: "rgba(255,255,255,0.5)" }} label={{ value: "Freq [MHz]", position: "insideBottomRight", offset: -6, fill: "#ffffff" }} />
                        <YAxis domain={[-140, 0]} tick={{ fill: "#ffffff" }} tickLine={{ stroke: "rgba(255,255,255,0.3)" }} axisLine={{ stroke: "rgba(255,255,255,0.5)" }} label={{ value: "Level [dBm]", angle: -90, position: "insideLeft", fill: "#ffffff" }} />
                        <Tooltip />
                        <Line type="monotone" dataKey="level" stroke="#00eaff" dot={false} strokeWidth={2} />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </Card>
    );
}