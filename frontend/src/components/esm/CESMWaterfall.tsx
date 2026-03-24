import React, { useState, useMemo, useEffect, useRef } from "react";
//import AppLayout from "../../components/layout/AppLayout";
//import PageContainer from "../../components/layout/PageContainer";
import Card from "../../components/ui/Card";

export default function CESMWaterfall() {
    const waterfallData = useMemo(() => Array.from({ length: 40 }, (_, t) =>
        Array.from({ length: 100 }, (_, f) => ({
            freq: 400 + f * 1,
            time: t,
            intensity: Math.random() * 100 + (f === 50 ? 200 : 0),
        }))
    ),[]);

    return (
        <Card>
            <div style={{ height: 220, position: "relative" }}>
                <canvas
                    width={800}
                    height={220}
                    style={{ width: "100%", height: "100%", background: "#001024" }}
                    ref={el => {
                        if (el) {
                            const ctx = el.getContext("2d");
                                if (ctx) {
                                    for (let t = 0; t < waterfallData.length; t++) {
                                    for (let f = 0; f < waterfallData[t].length; f++) {
                                        const intensity = waterfallData[t][f].intensity;
                                        const brightness = Math.round(Math.min(255, Math.max(10, (intensity / 300) * 255)));
                                        ctx.fillStyle = `rgb(${Math.floor(brightness / 3)},${Math.floor(brightness / 1.5)},${brightness})`;
                                        ctx.fillRect((f / waterfallData[t].length) * el.width, (t / waterfallData.length) * el.height, el.width / waterfallData[t].length, el.height / waterfallData.length);
                                    }
                                    }
                                }
                            }
                        }}
                />
            </div>
        </Card>
    );
}