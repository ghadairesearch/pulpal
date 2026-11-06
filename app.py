from fastapi import FastAPI, HTTPException, Query
from fastapi.staticfiles import StaticFiles
from fastapi.responses import FileResponse
from pydantic import BaseModel
from typing import Optional, Dict, Any, List
from datetime import datetime, timezone
import json
import csv
import random
import os
import sqlite3

try:
    import psycopg
    from psycopg.types.json import Jsonb
except ImportError:
    psycopg = None
    Jsonb = None

app = FastAPI()

cases_db = []
cases_mtime = 0
BASE_DIR = os.path.dirname(os.path.abspath(__file__))
CASES_FILE = os.path.join(BASE_DIR, "cases.json")
REVIEWS_DB_FILE = os.path.join(BASE_DIR, "reviews.db")
REVIEWS_FILE = os.path.join(BASE_DIR, "reviews.json")
REVIEWS_CSV_FILE = os.path.join(BASE_DIR, "reviews.csv")
DATABASE_URL = os.getenv("DATABASE_URL")
USING_POSTGRES = bool(DATABASE_URL)


def get_reviews_connection():
    if USING_POSTGRES:
        if psycopg is None:
            raise RuntimeError("DATABASE_URL is set, but psycopg is not installed")
        return psycopg.connect(DATABASE_URL)
    connection = sqlite3.connect(REVIEWS_DB_FILE, timeout=30)
    connection.row_factory = sqlite3.Row
    return connection


def initialize_reviews_database():
    with get_reviews_connection() as connection:
        if USING_POSTGRES:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS reviews (
                    question_id TEXT PRIMARY KEY,
                    payload JSONB NOT NULL,
                    submitted_at TIMESTAMPTZ NOT NULL
                )
            """)
        else:
            connection.execute("""
                CREATE TABLE IF NOT EXISTS reviews (
                    question_id TEXT PRIMARY KEY,
                    payload TEXT NOT NULL,
                    submitted_at TEXT NOT NULL
                )
            """)
        count = connection.execute("SELECT COUNT(*) FROM reviews").fetchone()[0]

        # One-time migration of reviews collected before SQLite was introduced.
        if count == 0 and os.path.exists(REVIEWS_FILE):
            try:
                with open(REVIEWS_FILE, "r", encoding="utf-8") as f:
                    existing_reviews = json.load(f)
                for review in existing_reviews:
                    question_id = review.get("question_id")
                    if question_id is None:
                        continue
                    submitted_at = review.get("submitted_at") or utc_now()
                    review["submitted_at"] = submitted_at
                    upsert_review(connection, str(question_id), review, submitted_at)
            except (OSError, json.JSONDecodeError, TypeError):
                pass


def read_reviews():
    with get_reviews_connection() as connection:
        rows = connection.execute(
            "SELECT payload FROM reviews ORDER BY submitted_at, question_id"
        ).fetchall()
    reviews = []
    for row in rows:
        payload = row[0] if USING_POSTGRES else row["payload"]
        reviews.append(payload if isinstance(payload, dict) else json.loads(payload))
    return reviews


def utc_now():
    return datetime.now(timezone.utc).isoformat().replace("+00:00", "Z")


def upsert_review(connection, question_id, payload, submitted_at):
    if USING_POSTGRES:
        connection.execute(
            """
            INSERT INTO reviews (question_id, payload, submitted_at)
            VALUES (%s, %s, %s)
            ON CONFLICT(question_id) DO UPDATE SET
                payload = excluded.payload,
                submitted_at = excluded.submitted_at
            """,
            (question_id, Jsonb(payload), submitted_at),
        )
    else:
        connection.execute(
            """
            INSERT INTO reviews (question_id, payload, submitted_at)
            VALUES (?, ?, ?)
            ON CONFLICT(question_id) DO UPDATE SET
                payload = excluded.payload,
                submitted_at = excluded.submitted_at
            """,
            (question_id, json.dumps(payload, ensure_ascii=False), submitted_at),
        )

def load_database():
    global cases_db, cases_mtime
    if os.path.exists(CASES_FILE):
        mtime = os.path.getmtime(CASES_FILE)
        if mtime != cases_mtime or not cases_db:
            with open(CASES_FILE, "r", encoding="utf-8") as f:
                cases_db = json.load(f)
            cases_mtime = mtime

# Load database into memory at startup
load_database()
initialize_reviews_database()

@app.get("/api/cases")
def get_all_cases():
    load_database()
    return cases_db

@app.get("/api/case/random")
def get_random_case(index: Optional[int] = Query(default=None)):
    load_database()
                
    if not cases_db:
        return {
            "question": "Error: Database is empty. Please generate cases first.",
            "options": {"A": "Error", "B": "Error", "C": "Error", "D": "Error"},
            "option_analysis": {},
            "image": ""
        }
            
    if index is not None and 0 <= index < len(cases_db):
        case = cases_db[index]
    else:
        case = random.choice(cases_db)
    case_with_meta = dict(case)
    case_with_meta["total_cases_in_db"] = len(cases_db)
    return case_with_meta

def write_reviews_csv(reviews: List[Dict[str, Any]]):
    fieldnames = [
        "question_id",
        "selected_option",
        "correct_option",
        "answered_correctly",
        "time_to_answer_seconds",
        "time_to_review_seconds",
        "total_question_time_seconds",
        "usefulness",
        "inappropriate_explanation",
        "rated_difficulty",
        "original_difficulty",
        "distractor_quality_A",
        "distractor_quality_B",
        "distractor_quality_C",
        "distractor_quality_D",
        "explanation_accuracy_A",
        "explanation_accuracy_B",
        "explanation_accuracy_C",
        "explanation_accuracy_D",
        "submitted_at"
    ]
    with open(REVIEWS_CSV_FILE, "w", encoding="utf-8-sig", newline="") as f:
        writer = csv.DictWriter(f, fieldnames=fieldnames)
        writer.writeheader()
        for r in reviews:
            dq = r.get("distractor_quality") or {}
            ea = r.get("explanation_medical_accuracy") or {}
            writer.writerow({
                "question_id": r.get("question_id"),
                "selected_option": r.get("selected_option"),
                "correct_option": r.get("correct_option"),
                "answered_correctly": r.get("answered_correctly"),
                "time_to_answer_seconds": r.get("time_to_answer_seconds"),
                "time_to_review_seconds": r.get("time_to_review_seconds"),
                "total_question_time_seconds": r.get("total_question_time_seconds"),
                "usefulness": r.get("usefulness"),
                "inappropriate_explanation": r.get("inappropriate_explanation", ""),
                "rated_difficulty": r.get("rated_difficulty"),
                "original_difficulty": r.get("question_difficulty_label"),
                "distractor_quality_A": dq.get("A", ""),
                "distractor_quality_B": dq.get("B", ""),
                "distractor_quality_C": dq.get("C", ""),
                "distractor_quality_D": dq.get("D", ""),
                "explanation_accuracy_A": ea.get("A", ""),
                "explanation_accuracy_B": ea.get("B", ""),
                "explanation_accuracy_C": ea.get("C", ""),
                "explanation_accuracy_D": ea.get("D", ""),
                "submitted_at": r.get("submitted_at", "")
            })

@app.post("/api/review")
def save_review(payload: Dict[str, Any]):
    q_id = payload.get("question_id")
    if q_id is None:
        raise HTTPException(status_code=422, detail="question_id is required")

    payload = dict(payload)
    payload["submitted_at"] = utc_now()
    with get_reviews_connection() as connection:
        upsert_review(connection, str(q_id), payload, payload["submitted_at"])
    reviews = read_reviews()

    # Best-effort local exports; PostgreSQL remains the source of truth on Render.
    try:
        with open(REVIEWS_FILE, "w", encoding="utf-8") as f:
            json.dump(reviews, f, indent=2, ensure_ascii=False)
        write_reviews_csv(reviews)
    except OSError:
        pass
    return {"status": "ok", "total_reviews": len(reviews)}

@app.get("/api/reviews")
def get_reviews():
    return read_reviews()

# Mount static files for images specifically
IMAGES_DIR = os.path.join(BASE_DIR, "images")
os.makedirs(IMAGES_DIR, exist_ok=True)
app.mount("/images", StaticFiles(directory=IMAGES_DIR), name="images")

# Serve root index.html with no-cache headers
@app.get("/")
def read_index():
    return FileResponse(
        os.path.join(BASE_DIR, "index.html"),
        headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"}
    )

# Serve other static files like main.js and style.css with no-cache headers
@app.get("/{filename}")
def read_static(filename: str):
    file_path = os.path.join(BASE_DIR, filename)
    if os.path.isfile(file_path):
        return FileResponse(
            file_path,
            headers={"Cache-Control": "no-store, no-cache, must-revalidate, max-age=0"}
        )
    raise HTTPException(status_code=404, detail="File not found")

if __name__ == "__main__":
    import uvicorn
    uvicorn.run(app, host="0.0.0.0", port=8000)
