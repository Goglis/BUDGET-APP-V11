"use client";

import {
  Bar,
  BarChart,
  CartesianGrid,
  Legend,
  ResponsiveContainer,
  Tooltip,
  XAxis,
  YAxis,
} from "recharts";
import type { MonthBucket } from "@/lib/summary";

interface Props {
  buckets: MonthBucket[];
}

export function SummaryChart({ buckets }: Props) {
  if (buckets.length === 0) {
    return (
      <p className="text-center text-sm text-[var(--muted)] py-8">
        Son 6 ay için henüz kayıt yok.
      </p>
    );
  }
  return (
    <div className="h-72 w-full">
      <ResponsiveContainer width="100%" height="100%">
        <BarChart data={buckets} margin={{ top: 8, right: 8, left: 0, bottom: 0 }}>
          <CartesianGrid strokeDasharray="3 3" stroke="#2d3a4f" />
          <XAxis dataKey="ayEtiket" tick={{ fill: "#8b9cb3", fontSize: 11 }} />
          <YAxis tick={{ fill: "#8b9cb3", fontSize: 11 }} />
          <Tooltip
            contentStyle={{
              backgroundColor: "#1a2332",
              border: "1px solid #2d3a4f",
              borderRadius: "12px",
            }}
            labelStyle={{ color: "#e8eef7" }}
          />
          <Legend />
          <Bar
            dataKey="gelir"
            name="Gelir"
            fill="#16a34a"
            radius={[4, 4, 0, 0]}
          />
          <Bar
            dataKey="gider"
            name="Gider"
            fill="#dc2626"
            radius={[4, 4, 0, 0]}
          />
        </BarChart>
      </ResponsiveContainer>
    </div>
  );
}
