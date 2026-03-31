import React, { useMemo } from "react";
import type { ChartData, ChartOptions } from 'chart.js';
import { Chart as ChartJS, LineElement, PointElement, LinearScale, Title, Tooltip, CategoryScale, Filler } from 'chart.js';
import { Line } from 'react-chartjs-2';

ChartJS.register(LineElement, PointElement, LinearScale, Title, Tooltip, CategoryScale, Filler);

export interface Point {
  x: number | string;
  y: number | null;
}

interface Props {
  points?: Point[];
  markerX?: number | string | null;
  height?: number;
}

export default function SpectrumChart({ points = [], markerX = null, height = 220 }: Props) {
  const labels = points.map((p) => String(p.x));
  const dataPoints = points.map((p) => (p.y === null || Number.isNaN(Number(p.y)) ? null : Number(p.y)));

  // Create a gradient fill for the line
  const getGradient = (ctx: CanvasRenderingContext2D, chartArea: any) => {
    const gradient = ctx.createLinearGradient(0, chartArea.top, 0, chartArea.bottom);
    gradient.addColorStop(0, 'rgba(29,233,182,0.35)');
    gradient.addColorStop(1, 'rgba(29,233,182,0.02)');
    return gradient;
  };

  const datasets: any[] = [
    {
      label: 'Power (dBm)',
      data: dataPoints,
      borderColor: '#1de9b6',
      borderWidth: 2.5,
      backgroundColor: (ctx: any) => {
        const chart = ctx.chart;
        const { ctx: context, chartArea } = chart;
        if (!chartArea) return 'rgba(29,233,182,0.06)';
        return getGradient(context, chartArea);
      },
      pointRadius: 0,
      tension: 0.18,
      fill: true,
      shadowOffsetX: 0,
      shadowOffsetY: 2,
      shadowBlur: 8,
      shadowColor: 'rgba(29,233,182,0.18)'
    },
  ];

  // dataset for marker point
  const markerDataset = useMemo(() => {
    if (markerX === null) return null;
    const markerData = new Array(dataPoints.length).fill(null);
    const labelIndex = labels.findIndex((l) => l === String(markerX));
    if (labelIndex >= 0) {
      markerData[labelIndex] = dataPoints[labelIndex];
    } else if (typeof markerX === 'number') {
      const idx = Math.round(markerX);
      if (idx >= 0 && idx < dataPoints.length) markerData[idx] = dataPoints[idx];
    }
    return {
      label: 'Marker',
      data: markerData,
      borderColor: 'transparent',
      backgroundColor: 'rgba(255,80,80,0.95)',
      pointRadius: 6,
      pointHoverRadius: 8,
      showLine: false,
      z: 10,
    };
  }, [markerX, dataPoints, labels]);

  if (markerDataset) datasets.push(markerDataset);

  const data = {
    labels,
    datasets,
  };

  // plugin to draw a vertical marker line and dark background
  const markerPlugin = {
    id: 'markerLinePlugin',
    afterDraw: (chart: any) => {
      const ctx = chart.ctx;
      const chartArea = chart.chartArea;
      // draw semi-transparent dark background behind chart area
      ctx.save();
      ctx.shadowColor = 'rgba(0,0,0,0.45)';
      ctx.shadowBlur = 16;
      ctx.fillStyle = 'rgba(10,14,20,0.96)';
      ctx.fillRect(chartArea.left, chartArea.top, chartArea.right - chartArea.left, chartArea.bottom - chartArea.top);
      ctx.restore();

      if (markerX === null) return;
      // compute pixel for marker
      const xScale = chart.scales.x;
      let px;
      try {
        // try by value
        px = xScale.getPixelForValue(String(markerX));
      } catch (e) {
        try {
          px = xScale.getPixelForTick( Math.max(0, Math.min(xScale.ticks.length-1, Math.round(Number(markerX) || 0))) );
        } catch (e2) {
          return;
        }
      }

      if (typeof px !== 'number' || Number.isNaN(px)) return;

      ctx.save();
      ctx.beginPath();
      ctx.strokeStyle = 'rgba(255,80,80,0.9)';
      ctx.lineWidth = 2.5;
      ctx.setLineDash([4, 4]);
      ctx.moveTo(px, chartArea.top);
      ctx.lineTo(px, chartArea.bottom);
      ctx.stroke();
      ctx.restore();
    }
  };

  const options: ChartOptions<'line'> = {
    responsive: true,
    maintainAspectRatio: false,
    plugins: {
      legend: { display: false },
      tooltip: {
        mode: 'index',
        intersect: false,
        bodyColor: '#fff',
        titleColor: '#fff',
        backgroundColor: 'rgba(20,24,28,0.98)',
        borderColor: '#1de9b6',
        borderWidth: 1.5,
        padding: 12,
        titleFont: { size: 16, weight: 'bold' },
        bodyFont: { size: 15 },
        displayColors: false,
        callbacks: {
          label: (ctx: any) => `Power (dBm): ${ctx.parsed.y}`
        }
      },
    },
    scales: {
      x: {
        display: true,
        ticks: { maxRotation: 0, autoSkip: true, color: '#b2ebf2', font: { size: 15, weight: 'bold' } },
        grid: { color: 'rgba(200,200,200,0.13)', lineWidth: 1.2 },
      },
      y: {
        display: true,
        title: { display: true, text: 'dBm', color: '#b2ebf2', font: { size: 16, weight: 'bold' } },
        ticks: { color: '#b2ebf2', font: { size: 15, weight: 'bold' } },
        grid: { color: 'rgba(200,200,200,0.13)', lineWidth: 1.2 },
      },
    },
    interaction: { mode: 'nearest', axis: 'x', intersect: false },
  };

  return (
    <div style={{ width: '100%', height, background: '#0a0e14', padding: 8, borderRadius: 8, boxShadow: '0 2px 16px 0 rgba(0,0,0,0.18)' }}>
      <Line data={data} options={options} plugins={[markerPlugin]} />
    </div>
  );
}
