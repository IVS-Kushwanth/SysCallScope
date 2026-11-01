import Plotly from "plotly.js-dist-min";
import createPlotlyComponent from "react-plotly.js/factory";
import { useMemo } from "react";

const PlotComponent = createPlotlyComponent(Plotly);

export const baseLayout = {
  paper_bgcolor: "rgba(0,0,0,0)",
  plot_bgcolor: "rgba(0,0,0,0)",
  font: { family: "IBM Plex Sans, Inter, Segoe UI, Helvetica, Arial, sans-serif", color: "#9299A8", size: 11 },
  margin: { l: 48, r: 16, t: 12, b: 40 },
  xaxis: { gridcolor: "rgba(255,255,255,0.06)", zerolinecolor: "rgba(255,255,255,0.1)", linecolor: "rgba(255,255,255,0.1)" },
  yaxis: { gridcolor: "rgba(255,255,255,0.06)", zerolinecolor: "rgba(255,255,255,0.1)", linecolor: "rgba(255,255,255,0.1)" },
  hoverlabel: { bgcolor: "#101725", bordercolor: "#1558C9", font: { family: "IBM Plex Mono, Consolas, Menlo, monospace", color: "#F5F7FA", size: 11 } },
  legend: { orientation: "h", y: -0.2, font: { color: "#9299A8" } },
  bargap: 0.25,
};

function merge(a: any, b: any): any {
  const out: any = { ...a };
  for (const k of Object.keys(b ?? {})) {
    out[k] = b[k] && typeof b[k] === "object" && !Array.isArray(b[k]) && a?.[k] ? merge(a[k], b[k]) : b[k];
  }
  return out;
}

export function Chart({ data, layout, height = 280, onClick, onRelayout, config }: {
  data: any[]; layout?: any; height?: number; onClick?: (e: any) => void; onRelayout?: (e: any) => void; config?: any;
}) {
  const l = useMemo(() => merge(baseLayout, { ...layout, height, autosize: true }), [layout, height]);
  return (
    <PlotComponent
      data={data}
      layout={l}
      useResizeHandler
      style={{ width: "100%", height }}
      onClick={onClick}
      onRelayout={onRelayout}
      config={{ displaylogo: false, responsive: true, modeBarButtonsToRemove: ["lasso2d", "select2d", "toImage"], displayModeBar: "hover", ...config }}
    />
  );
}
