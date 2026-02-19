from __future__ import annotations

import json
import os
import re
from datetime import time, date, datetime
from typing import Any

import requests
from jinja2 import Environment, FileSystemLoader
from sqlalchemy.orm import Session, joinedload

from app.models.meeting import Meeting
from app.models.section import Section
from app.models.room import Room
from app.models.building import Building
from app.models.instructor import Instructor
from app.models.course import Course
from app.models.term import Term
from app.models.settings import AppSetting


def _term_slug(name: str) -> str:
    """'Fall 2026' -> 'fall-2026'"""
    return re.sub(r"[^a-z0-9]+", "-", name.lower()).strip("-")


def _time_str(t: Any) -> str:
    """time(9,30) -> '09:30'"""
    if isinstance(t, time):
        return t.strftime("%H:%M")
    return str(t) if t else ""


def _parse_days(days_json: str) -> list:
    try:
        days = json.loads(days_json)
        if isinstance(days, list):
            return days
    except (json.JSONDecodeError, TypeError):
        pass
    return []


def _json_serial(obj: Any) -> Any:
    if isinstance(obj, (date, time)):
        return obj.isoformat()
    if hasattr(obj, "value"):
        return obj.value
    raise TypeError(f"Type {type(obj)} not serializable")


def _get_setting(db: Session, key: str) -> str:
    setting = db.query(AppSetting).filter(AppSetting.key == key).first()
    return setting.value if setting else ""


def gather_export_data(db: Session, term_id: int) -> dict:
    """Query all data needed for the HTML export template."""
    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise ValueError(f"Term {term_id} not found")

    meetings = (
        db.query(Meeting)
        .join(Section, Meeting.section_id == Section.id)
        .filter(Section.term_id == term_id)
        .options(
            joinedload(Meeting.section).joinedload(Section.course),
            joinedload(Meeting.room).joinedload(Room.building),
            joinedload(Meeting.instructor),
        )
        .all()
    )

    sections = (
        db.query(Section)
        .filter(Section.term_id == term_id)
        .options(
            joinedload(Section.course),
            joinedload(Section.instructor),
        )
        .all()
    )

    rooms = (
        db.query(Room)
        .options(joinedload(Room.building))
        .all()
    )

    instructors = (
        db.query(Instructor)
        .filter(Instructor.is_active == True)
        .all()
    )

    # Serialize meetings
    meeting_data = []
    for m in meetings:
        section = m.section
        course = section.course if section else None
        room = m.room
        building = room.building if room else None
        instructor = m.instructor

        meeting_data.append({
            "id": m.id,
            "section_id": m.section_id,
            "days_of_week": m.days_of_week,
            "start_time": _time_str(m.start_time),
            "end_time": _time_str(m.end_time),
            "room_id": m.room_id,
            "instructor_id": m.instructor_id,
            "section": {
                "id": section.id,
                "section_number": section.section_number,
                "enrollment_cap": section.enrollment_cap,
                "modality": section.modality,
                "session": section.session if hasattr(section, 'session') else "regular",
                "status": section.status,
                "instructor_id": section.instructor_id,
                "course": {
                    "department_code": course.department_code,
                    "course_number": course.course_number,
                    "title": course.title,
                    "credits": course.credits,
                } if course else None,
            } if section else None,
            "room": {
                "id": room.id,
                "room_number": room.room_number,
                "capacity": room.capacity,
                "building": {
                    "abbreviation": building.abbreviation,
                    "name": building.name,
                } if building else None,
            } if room else None,
            "instructor": {
                "id": instructor.id,
                "name": instructor.name,
            } if instructor else None,
        })

    # Online async sections: modality=online_async
    online_sections = []
    for s in sections:
        if s.modality == "online_async":
            course = s.course
            instructor = s.instructor
            online_sections.append({
                "id": s.id,
                "section_number": s.section_number,
                "enrollment_cap": s.enrollment_cap,
                "modality": s.modality,
                "session": s.session if hasattr(s, 'session') else "regular",
                "status": s.status,
                "instructor_id": s.instructor_id,
                "course": {
                    "department_code": course.department_code,
                    "course_number": course.course_number,
                    "title": course.title,
                    "credits": course.credits,
                } if course else None,
                "instructor": {
                    "id": instructor.id,
                    "name": instructor.name,
                } if instructor else None,
            })

    room_data = []
    for r in rooms:
        building = r.building
        room_data.append({
            "id": r.id,
            "room_number": r.room_number,
            "capacity": r.capacity,
            "building": {
                "abbreviation": building.abbreviation,
                "name": building.name,
            } if building else None,
        })

    instructor_data = [
        {"id": i.id, "name": i.name}
        for i in instructors
    ]

    department_name = _get_setting(db, "department_name")

    return {
        "term": {"id": term.id, "name": term.name, "status": str(term.status.value) if hasattr(term.status, 'value') else str(term.status)},
        "meetings": meeting_data,
        "online_sections": online_sections,
        "rooms": room_data,
        "instructors": instructor_data,
        "department_name": department_name,
    }


def render_export_html(db: Session, term_id: int) -> str:
    """Render the static HTML export for a term."""
    data = gather_export_data(db, term_id)

    templates_dir = os.path.join(os.path.dirname(__file__), "..", "templates")
    env = Environment(loader=FileSystemLoader(templates_dir), autoescape=False)
    template = env.get_template("schedule_export.html")

    return template.render(
        term_name=data["term"]["name"],
        department_name=data["department_name"],
        schedule_data=json.dumps(data, default=_json_serial),
        generation_date=datetime.now().strftime("%B %d, %Y at %-I:%M %p"),
    )


def save_to_directory(db: Session, term_id: int) -> str:
    """Save HTML export to the configured local directory. Returns filepath."""
    export_dir = _get_setting(db, "export_directory")
    if not export_dir:
        raise ValueError("Export directory not configured. Set it in Settings.")

    export_dir = os.path.expanduser(export_dir)
    os.makedirs(export_dir, exist_ok=True)

    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise ValueError(f"Term {term_id} not found")

    filename = f"{_term_slug(term.name)}.html"
    filepath = os.path.join(export_dir, filename)

    html = render_export_html(db, term_id)
    with open(filepath, "w", encoding="utf-8") as f:
        f.write(html)

    return filepath


def push_to_github(db: Session, term_id: int) -> dict:
    """Push HTML export to a GitHub repo via the Contents API. Returns pages_url + filename."""
    repo_url = _get_setting(db, "github_repo_url")
    token = os.environ.get("GITHUB_TOKEN", "")

    if not repo_url or not token:
        raise ValueError("GitHub not configured. Use the GitHub Setup wizard in Settings.")

    # Parse owner/repo from URL like https://github.com/owner/repo
    match = re.search(r"github\.com[/:]([^/]+)/([^/.]+)", repo_url)
    if not match:
        raise ValueError(f"Could not parse GitHub repo from URL: {repo_url}")
    owner, repo = match.group(1), match.group(2)

    term = db.query(Term).filter(Term.id == term_id).first()
    if not term:
        raise ValueError(f"Term {term_id} not found")

    filename = f"{_term_slug(term.name)}.html"
    html = render_export_html(db, term_id)

    headers = {
        "Authorization": f"token {token}",
        "Accept": "application/vnd.github.v3+json",
    }

    api_base = f"https://api.github.com/repos/{owner}/{repo}"

    # Check if repo exists, create if not
    resp = requests.get(api_base, headers=headers, timeout=15)
    if resp.status_code == 404:
        create_resp = requests.post(
            "https://api.github.com/user/repos",
            headers=headers,
            json={"name": repo, "auto_init": True},
            timeout=15,
        )
        if create_resp.status_code not in (200, 201):
            raise ValueError(f"Failed to create repo: {create_resp.text}")

    # Check if file already exists (to get its SHA for update)
    file_url = f"{api_base}/contents/{filename}"
    existing = requests.get(file_url, headers=headers, timeout=15)
    sha = None
    if existing.status_code == 200:
        sha = existing.json().get("sha")

    # Create/update file
    import base64
    payload = {
        "message": f"Update {filename}",
        "content": base64.b64encode(html.encode("utf-8")).decode("ascii"),
    }
    if sha:
        payload["sha"] = sha

    put_resp = requests.put(file_url, headers=headers, json=payload, timeout=30)
    if put_resp.status_code not in (200, 201):
        raise ValueError(f"Failed to push file: {put_resp.text}")

    # Enable GitHub Pages on main branch (root)
    pages_url = f"{api_base}/pages"
    pages_resp = requests.get(pages_url, headers=headers, timeout=15)
    if pages_resp.status_code == 404:
        requests.post(
            pages_url,
            headers=headers,
            json={"source": {"branch": "main", "path": "/"}},
            timeout=15,
        )

    pages_base = f"https://{owner}.github.io/{repo}"
    return {
        "pages_url": f"{pages_base}/{filename}",
        "filename": filename,
    }
