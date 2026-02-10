from fastapi import FastAPI
from fastapi.middleware.cors import CORSMiddleware
from app.api.routes import terms, buildings, rooms, instructors, courses, sections, meetings, time_blocks, auth, import_export, suggestions

app = FastAPI(title="UWRF Course Scheduler", version="0.1.0")

app.add_middleware(
    CORSMiddleware,
    allow_origins=["http://localhost:5173"],
    allow_credentials=True,
    allow_methods=["*"],
    allow_headers=["*"],
)

app.include_router(auth.router, prefix="/api/auth", tags=["auth"])
app.include_router(terms.router, prefix="/api/terms", tags=["terms"])
app.include_router(buildings.router, prefix="/api/buildings", tags=["buildings"])
app.include_router(rooms.router, prefix="/api/rooms", tags=["rooms"])
app.include_router(instructors.router, prefix="/api/instructors", tags=["instructors"])
app.include_router(courses.router, prefix="/api/courses", tags=["courses"])
app.include_router(sections.router, prefix="/api/sections", tags=["sections"])
app.include_router(meetings.router, prefix="/api", tags=["meetings"])
app.include_router(time_blocks.router, prefix="/api/timeblocks", tags=["timeblocks"])
app.include_router(import_export.router, prefix="/api", tags=["import-export"])
app.include_router(suggestions.router, prefix="/api/suggestions", tags=["suggestions"])


@app.get("/api/health")
def health():
    return {"status": "ok"}
