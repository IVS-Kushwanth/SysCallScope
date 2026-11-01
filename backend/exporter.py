"""CSV / JSON / PDF exports for a trace session."""
from __future__ import annotations

import csv
import io
import json
from datetime import datetime

from reportlab.graphics.charts.barcharts import HorizontalBarChart
from reportlab.graphics.shapes import Drawing, String
from reportlab.lib import colors
from reportlab.lib.pagesizes import A4
from reportlab.lib.styles import ParagraphStyle, getSampleStyleSheet
from reportlab.lib.units import mm
from reportlab.platypus import (Paragraph, SimpleDocTemplate, Spacer, Table, TableStyle,
                                PageBreak)

from database import EVENT_COLS

COBALT = colors.HexColor("#1558C9")
LIME = colors.HexColor("#D4FF24")
INK = colors.HexColor("#030407")
RED = colors.HexColor("#FF5252")


def to_csv(events: list[dict]) -> str:
    buf = io.StringIO()
    cols = [c for c in EVENT_COLS if c != "raw"]
    w = csv.DictWriter(buf, fieldnames=cols, extrasaction="ignore")
    w.writeheader()
    for e in events:
        w.writerow(e)
    return buf.getvalue()


def to_json(session: dict, events: list[dict], stats: dict, processes: dict) -> str:
    return json.dumps({
        "generator": "SyscallScope",
        "exported_at": datetime.now().isoformat(timespec="seconds"),
        "data_type": "DEMO DATA" if session["mode"] == "demo" else "LIVE TRACE",
        "session": session,
        "summary": {k: v for k, v in stats.items() if k not in ("durations",)},
        "processes": processes["processes"],
        "events": events,
    }, indent=2, default=str)


def _fmt_us(sec) -> str:
    if sec is None:
        return "—"
    us = sec * 1e6
    return f"{us/1000:.2f} ms" if us >= 1000 else f"{us:.1f} us"


def _ts(t) -> str:
    return datetime.fromtimestamp(t).strftime("%H:%M:%S.%f")[:-3] if t else "—"


def _table(rows, widths, header_bg=COBALT):
    t = Table(rows, colWidths=widths, repeatRows=1)
    t.setStyle(TableStyle([
        ("BACKGROUND", (0, 0), (-1, 0), header_bg),
        ("TEXTCOLOR", (0, 0), (-1, 0), colors.white),
        ("FONTNAME", (0, 0), (-1, 0), "Helvetica-Bold"),
        ("FONTSIZE", (0, 0), (-1, -1), 8),
        ("ROWBACKGROUNDS", (0, 1), (-1, -1), [colors.white, colors.HexColor("#F1F4FA")]),
        ("GRID", (0, 0), (-1, -1), 0.25, colors.HexColor("#C9D2E3")),
        ("VALIGN", (0, 0), (-1, -1), "TOP"),
    ]))
    return t


def _bar_chart(data: list[tuple[str, int]], title: str) -> Drawing:
    data = data[:12]
    h = 30 + 16 * max(1, len(data))
    d = Drawing(170 * mm, h)
    d.add(String(0, h - 12, title, fontName="Helvetica-Bold", fontSize=10, fillColor=INK))
    if not data:
        return d
    bc = HorizontalBarChart()
    bc.x, bc.y = 90, 6
    bc.height, bc.width = h - 30, 170 * mm - 110
    bc.data = [[v for _, v in reversed(data)]]
    bc.categoryAxis.categoryNames = [k for k, _ in reversed(data)]
    bc.categoryAxis.labels.fontSize = 7
    bc.valueAxis.labels.fontSize = 7
    bc.valueAxis.valueMin = 0
    bc.bars[0].fillColor = COBALT
    bc.bars[0].strokeColor = None
    d.add(bc)
    return d


def to_pdf(session: dict, events: list[dict], stats: dict, processes: dict) -> bytes:
    buf = io.BytesIO()
    doc = SimpleDocTemplate(buf, pagesize=A4, leftMargin=16 * mm, rightMargin=16 * mm,
                            topMargin=16 * mm, bottomMargin=16 * mm,
                            title=f"SyscallScope report — {session['name']}")
    ss = getSampleStyleSheet()
    h1 = ParagraphStyle("h1", parent=ss["Title"], textColor=INK, alignment=0, fontSize=20)
    h2 = ParagraphStyle("h2", parent=ss["Heading2"], textColor=COBALT, spaceBefore=10)
    body = ParagraphStyle("b", parent=ss["BodyText"], fontSize=9, leading=12)
    mono = ParagraphStyle("m", parent=body, fontName="Courier", fontSize=7, leading=9)
    story = []

    story.append(Paragraph("SyscallScope trace report", h1))
    label = "DEMO DATA — generated sample trace, not captured from a real process" if session["mode"] == "demo" else "Live trace captured with strace"
    story.append(Paragraph(f"<b>{label}</b>", ParagraphStyle("lbl", parent=body, textColor=RED if session["mode"] == "demo" else COBALT)))
    story.append(Spacer(1, 6))

    story.append(Paragraph("Program information", h2))
    info = [
        ["Session", session["id"]], ["Program", session.get("program") or "—"],
        ["Arguments", " ".join(session.get("argv") or []) or "—"],
        ["Command", Paragraph(session.get("command") or "—", mono)],
        ["Status", session["status"]], ["Exit code", str(session.get("exit_code"))],
        ["Started", datetime.fromtimestamp(session["started_at"]).strftime("%Y-%m-%d %H:%M:%S") if session.get("started_at") else "—"],
    ]
    story.append(_table([["Field", "Value"], *info], [35 * mm, 140 * mm]))

    story.append(Paragraph("Trace summary", h2))
    summ = [
        ["Total system calls", stats["total"]], ["Successful", stats["successful"]],
        ["Failed", stats["failed"]], ["Interrupted / unfinished", stats["interrupted"] + stats["unfinished"]],
        ["Signals delivered", stats["signals"]], ["Processes created", stats["processes_created"]],
        ["Distinct PIDs", stats["unique_pids"]], ["Files accessed", stats["files_accessed"]],
        ["Wall-clock span", _fmt_us(stats["execution_time"])], ["Time inside syscalls", _fmt_us(stats["syscall_time"])],
        ["Average call duration", _fmt_us(stats["avg_duration"])],
        ["File / memory / process ops", f'{stats["file_ops"]} / {stats["memory_ops"]} / {stats["process_ops"]}'],
    ]
    story.append(_table([["Metric", "Value"], *[[k, str(v)] for k, v in summ]], [70 * mm, 105 * mm]))
    story.append(Spacer(1, 8))
    story.append(_bar_chart(list(stats["by_name"].items()), "Most frequent system calls"))
    story.append(_bar_chart([(k, v) for k, v in stats["by_category"].items() if v], "Calls by category"))

    story.append(Paragraph("System-call statistics", h2))
    rows = [["Call", "Count", "Failed", "Avg", "Max", "Total"]]
    for c in stats["per_call"][:30]:
        rows.append([c["name"], c["count"], c["failed"], _fmt_us(c["avg_time"]), _fmt_us(c["max_time"]), _fmt_us(c["total_time"])])
    story.append(_table(rows, [40 * mm, 20 * mm, 20 * mm, 30 * mm, 30 * mm, 35 * mm]))

    story.append(Paragraph("Process lifecycle", h2))
    rows = [["PID", "PPID", "Created by", "Program", "State", "Exit", "Calls"]]
    for p in processes["processes"]:
        rows.append([p["pid"], p["ppid"] or "—", p["created_by"] or "(traced root)", Paragraph(str(p.get("program") or "—"), mono),
                     f'{p["state"]} ({p["state_basis"]})', p["exit_code"] if p["exit_code"] is not None else (p["signal"] or "—"), p["syscall_count"]])
    story.append(_table(rows, [16 * mm, 16 * mm, 22 * mm, 55 * mm, 32 * mm, 16 * mm, 18 * mm]))

    story.append(Paragraph("Failed system calls", h2))
    if stats["failed_calls"]:
        rows = [["Time", "PID", "Call", "Error", "Arguments"]]
        for e in stats["failed_calls"][:60]:
            rows.append([_ts(e["ts"]), e["pid"], e["name"], f'{e["errno"]}', Paragraph((e["args"] or "")[:160], mono)])
        story.append(_table(rows, [24 * mm, 14 * mm, 22 * mm, 22 * mm, 93 * mm], header_bg=RED))
    else:
        story.append(Paragraph("No failed calls were observed.", body))

    story.append(PageBreak())
    story.append(Paragraph("Execution timeline (first 250 events)", h2))
    rows = [["Time", "PID", "Call", "Status", "Duration", "Result"]]
    for e in events[:250]:
        rows.append([_ts(e["ts"]), e["pid"], e["name"], e["status"], _fmt_us(e.get("duration")),
                     Paragraph(((e.get("ret") or "") + (" " + e["errno"] if e.get("errno") else ""))[:40], mono)])
    story.append(_table(rows, [24 * mm, 14 * mm, 30 * mm, 22 * mm, 22 * mm, 63 * mm]))
    story.append(Spacer(1, 8))
    story.append(Paragraph("Durations are reported by strace -T and include tracing overhead; "
                           "process states marked 'inferred' are deduced from the trace, not read from the scheduler.", body))

    doc.build(story)
    return buf.getvalue()
