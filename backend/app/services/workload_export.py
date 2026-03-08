"""Export instructor workload to XLSX matching department report format."""
from __future__ import annotations

import io

from openpyxl import Workbook
from openpyxl.styles import Font, Alignment, Border, Side, PatternFill
from sqlalchemy.orm import Session

from app.services.workload import compute_instructor_workload


def export_workload_xlsx(db: Session, term_id: int) -> bytes:
    """Generate an Excel workbook for instructor workload."""
    data = compute_instructor_workload(db, term_id)

    wb = Workbook()
    ws = wb.active
    ws.title = "Faculty Load"

    # Styles
    header_font = Font(bold=True, size=11)
    header_fill = PatternFill(start_color="D9E1F2", end_color="D9E1F2", fill_type="solid")
    bold_font = Font(bold=True)
    thin_border = Border(
        bottom=Side(style="thin"),
    )
    wrap_align = Alignment(wrap_text=True, vertical="top")
    overload_fill = PatternFill(start_color="FFF2CC", end_color="FFF2CC", fill_type="solid")

    # Headers
    headers = [
        "Last Name", "First Name", "Status", "Dept", "Course#", "Section#",
        "Class Name", "Enrollment", "Actual Credits",
        "Equivalent Credits", "SCH", "Total Load", "Notes",
    ]
    for col_idx, header in enumerate(headers, 1):
        cell = ws.cell(row=1, column=col_idx, value=header)
        cell.font = header_font
        cell.fill = header_fill
        cell.alignment = wrap_align

    # Column widths
    widths = [14, 12, 10, 8, 10, 10, 24, 12, 14, 16, 8, 12, 24]
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[chr(64 + i) if i <= 26 else None].width = w
    # Fix column width setting for all columns
    from openpyxl.utils import get_column_letter
    for i, w in enumerate(widths, 1):
        ws.column_dimensions[get_column_letter(i)].width = w

    row = 2

    for inst in data["instructors"]:
        first_row = row
        has_sections = len(inst["sections"]) > 0

        # Write section rows
        for sect in inst["sections"]:
            ws.cell(row=row, column=1, value=inst["last_name"])
            ws.cell(row=row, column=2, value=inst["first_name"])
            ws.cell(row=row, column=3, value=(inst["instructor_type"] or "").upper())
            ws.cell(row=row, column=4, value=sect["department_code"])
            ws.cell(row=row, column=5, value=sect["course_number"])
            ws.cell(row=row, column=6, value=sect["section_number"])
            ws.cell(row=row, column=7, value=sect["title"])
            ws.cell(row=row, column=8, value=sect["enrollment_cap"])
            ws.cell(row=row, column=9, value=sect["actual_credits"])
            ws.cell(row=row, column=10, value=sect["equivalent_credits"])
            ws.cell(row=row, column=11, value=sect["sch"])
            ws.cell(row=row, column=13, value=sect["schedule_info"])
            row += 1

        # Write adjustment rows (release/ADHOC)
        for adj in inst["adjustments"]:
            ws.cell(row=row, column=1, value=inst["last_name"])
            ws.cell(row=row, column=2, value=inst["first_name"])
            ws.cell(row=row, column=7, value=adj["description"])
            ws.cell(row=row, column=10, value=adj["equivalent_credits"])
            ws.cell(row=row, column=13, value=adj["adjustment_type"].replace("_", " ").title())
            row += 1

        if not has_sections and not inst["adjustments"]:
            # Write a placeholder row for instructors with only adjustments or nothing
            ws.cell(row=row, column=1, value=inst["last_name"])
            ws.cell(row=row, column=2, value=inst["first_name"])
            ws.cell(row=row, column=3, value=(inst["instructor_type"] or "").upper())
            ws.cell(row=row, column=4, value=inst["department"])
            row += 1

        # Total row
        for col_idx in range(1, len(headers) + 1):
            ws.cell(row=row, column=col_idx).border = thin_border

        ws.cell(row=row, column=1, value=inst["last_name"]).font = bold_font
        ws.cell(row=row, column=2, value=inst["first_name"]).font = bold_font
        total_cell = ws.cell(row=row, column=9, value=inst["total_teaching_credits"])
        total_cell.font = bold_font
        equiv_cell = ws.cell(row=row, column=10, value=inst["total_equivalent_credits"])
        equiv_cell.font = bold_font
        sch_cell = ws.cell(row=row, column=11, value=inst["total_sch"])
        sch_cell.font = bold_font
        load_cell = ws.cell(row=row, column=12, value=inst["total_equivalent_credits"])
        load_cell.font = bold_font

        if inst["is_overloaded"]:
            load_cell.fill = overload_fill

        row += 1
        row += 1  # blank separator row

    # Unassigned sections
    if data["unassigned_sections"]:
        ws.cell(row=row, column=1, value="NEEDS TO BE ASSIGNED").font = Font(bold=True, size=12)
        row += 1

        for sect in data["unassigned_sections"]:
            ws.cell(row=row, column=4, value=sect["department_code"])
            ws.cell(row=row, column=5, value=sect["course_number"])
            ws.cell(row=row, column=6, value=sect["section_number"])
            ws.cell(row=row, column=7, value=sect["title"])
            ws.cell(row=row, column=8, value=sect["enrollment_cap"])
            ws.cell(row=row, column=9, value=sect["actual_credits"])
            ws.cell(row=row, column=10, value=sect["equivalent_credits"])
            ws.cell(row=row, column=11, value=sect["sch"])
            ws.cell(row=row, column=13, value=sect["schedule_info"])
            row += 1

    # Write to bytes
    buffer = io.BytesIO()
    wb.save(buffer)
    buffer.seek(0)
    return buffer.getvalue()
