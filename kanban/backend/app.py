import os
from contextlib import closing
from datetime import date, datetime, timezone

import psycopg2
from psycopg2.extras import Json, RealDictCursor
from dotenv import load_dotenv
from flask import Flask, jsonify, request
from flask_cors import CORS

load_dotenv()

DATABASE_URL = os.getenv("DATABASE_URL")
CORS_ORIGINS = os.getenv("CORS_ORIGINS", "*")

COLUMN_ORDER = ["backlog", "todo", "doing", "done"]
VALID_COLUMNS = set(COLUMN_ORDER)
VALID_PRIORITIES = {"low", "medium", "high", "urgent"}
DEFAULT_WIP_LIMITS = {
    "backlog": 4,
    "todo": 3,
    "doing": 3,
    "done": 0,
}

CARD_SELECT_COLUMNS = """
id,
project_id,
col,
title,
subtitle,
description,
due_date::text AS due_date,
priority,
labels,
assignees,
checklist,
comments,
attachments,
position,
created_at
"""

if not DATABASE_URL:
    raise RuntimeError("DATABASE_URL is required")

app = Flask(__name__)

if CORS_ORIGINS.strip() == "*":
    CORS(app, resources={r"/api/*": {"origins": "*"}})
else:
    origins = [origin.strip() for origin in CORS_ORIGINS.split(",") if origin.strip()]
    CORS(app, resources={r"/api/*": {"origins": origins}})


def get_connection():
    conn = psycopg2.connect(DATABASE_URL)
    conn.autocommit = True
    return conn


def fetch_all(query, params=None):
    with closing(get_connection()) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query, params or ())
        rows = cur.fetchall()
    return [dict(row) for row in rows]


def fetch_one(query, params=None):
    with closing(get_connection()) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
        cur.execute(query, params or ())
        row = cur.fetchone()
    return dict(row) if row else None


def execute(query, params=None):
    with closing(get_connection()) as conn, conn.cursor() as cur:
        cur.execute(query, params or ())
        return cur.rowcount


def api_error(message, status=400):
    return jsonify({"error": message}), status


def get_actor():
    actor = request.headers.get("X-Actor", "You").strip()
    return actor or "You"


def now_iso():
    return datetime.now(timezone.utc).isoformat()


def normalize_wip_limits(value):
    if value is None:
        return dict(DEFAULT_WIP_LIMITS)
    if not isinstance(value, dict):
        raise ValueError("wip_limits must be an object")

    normalized = dict(DEFAULT_WIP_LIMITS)
    for col in COLUMN_ORDER:
        raw = value.get(col, normalized[col])
        if raw in (None, ""):
            normalized[col] = 0
            continue
        try:
            parsed = int(raw)
        except (TypeError, ValueError):
            raise ValueError(f"wip_limits.{col} must be an integer")
        if parsed < 0:
            raise ValueError(f"wip_limits.{col} must be >= 0")
        normalized[col] = parsed
    return normalized


def normalize_string_list(value, field_name):
    if value is None:
        return []
    if isinstance(value, str):
        source = value.split(",")
    elif isinstance(value, list):
        source = value
    else:
        raise ValueError(f"{field_name} must be an array of strings")

    items = []
    seen = set()
    for raw_item in source:
        text = str(raw_item).strip()
        if not text:
            continue
        key = text.lower()
        if key in seen:
            continue
        seen.add(key)
        items.append(text)
    return items


def normalize_due_date(value):
    if value in (None, ""):
        return None
    if isinstance(value, date) and not isinstance(value, datetime):
        return value
    if isinstance(value, str):
        try:
            return date.fromisoformat(value)
        except ValueError as exc:
            raise ValueError("due_date must be YYYY-MM-DD") from exc
    raise ValueError("due_date must be YYYY-MM-DD")


def normalize_priority(value):
    if value in (None, ""):
        return "medium"
    parsed = str(value).strip().lower()
    if parsed not in VALID_PRIORITIES:
        raise ValueError("priority must be one of: low, medium, high, urgent")
    return parsed


def normalize_checklist(value):
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("checklist must be an array")

    result = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("checklist items must be objects")
        item_id = str(item.get("id") or f"item-{now_iso()}").strip()
        text = str(item.get("text", "")).strip()
        done = bool(item.get("done", False))
        if not text:
            continue
        result.append({"id": item_id, "text": text, "done": done})
    return result


def normalize_comments(value):
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("comments must be an array")

    result = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("comments items must be objects")
        item_id = str(item.get("id") or f"comment-{now_iso()}").strip()
        author = str(item.get("author", "You")).strip() or "You"
        body = str(item.get("body", "")).strip()
        created_at = str(item.get("created_at") or now_iso())
        if not body:
            continue
        result.append(
            {
                "id": item_id,
                "author": author,
                "body": body,
                "created_at": created_at,
            }
        )
    return result


def normalize_attachments(value):
    if value is None:
        return []
    if not isinstance(value, list):
        raise ValueError("attachments must be an array")

    result = []
    for item in value:
        if not isinstance(item, dict):
            raise ValueError("attachments items must be objects")
        item_id = str(item.get("id") or f"attachment-{now_iso()}").strip()
        name = str(item.get("name", "")).strip()
        url = str(item.get("url", "")).strip()
        if not url:
            continue
        if not name:
            name = url
        result.append({"id": item_id, "name": name, "url": url})
    return result


def log_activity(project_id, actor, action, details=None, card_id=None, cur=None):
    payload = details or {}
    query = """
        INSERT INTO activity_log (project_id, card_id, actor, action, details)
        VALUES (%s, %s, %s, %s, %s)
    """
    params = (project_id, card_id, actor, action, Json(payload))

    if cur is not None:
        cur.execute(query, params)
        return

    with closing(get_connection()) as conn, conn.cursor() as log_cur:
        log_cur.execute(query, params)


def clamp(value, minimum, maximum):
    return max(minimum, min(value, maximum))


def reposition_card(cur, current_card, target_col, requested_position):
    card_id = current_card["id"]
    project_id = current_card["project_id"]
    source_col = current_card["col"]
    source_position = current_card["position"]

    if target_col == source_col:
        cur.execute(
            """
            SELECT COUNT(*) AS total
            FROM cards
            WHERE project_id = %s AND col = %s
            """,
            (project_id, source_col),
        )
        total = cur.fetchone()["total"]
        max_position = max(total - 1, 0)
        if requested_position is None:
            target_position = source_position
        else:
            target_position = clamp(requested_position, 0, max_position)

        if target_position > source_position:
            cur.execute(
                """
                UPDATE cards
                SET position = position - 1
                WHERE project_id = %s
                  AND col = %s
                  AND position > %s
                  AND position <= %s
                  AND id <> %s
                """,
                (project_id, source_col, source_position, target_position, card_id),
            )
        elif target_position < source_position:
            cur.execute(
                """
                UPDATE cards
                SET position = position + 1
                WHERE project_id = %s
                  AND col = %s
                  AND position >= %s
                  AND position < %s
                  AND id <> %s
                """,
                (project_id, source_col, target_position, source_position, card_id),
            )
        return target_col, target_position

    cur.execute(
        """
        UPDATE cards
        SET position = position - 1
        WHERE project_id = %s
          AND col = %s
          AND position > %s
        """,
        (project_id, source_col, source_position),
    )

    cur.execute(
        """
        SELECT COUNT(*) AS total
        FROM cards
        WHERE project_id = %s AND col = %s
        """,
        (project_id, target_col),
    )
    target_total = cur.fetchone()["total"]
    if requested_position is None:
        target_position = target_total
    else:
        target_position = clamp(requested_position, 0, target_total)

    cur.execute(
        """
        UPDATE cards
        SET position = position + 1
        WHERE project_id = %s
          AND col = %s
          AND position >= %s
        """,
        (project_id, target_col, target_position),
    )
    return target_col, target_position


def ensure_schema():
    with closing(get_connection()) as conn, conn.cursor() as cur:
        cur.execute(
            """
            ALTER TABLE projects
            ADD COLUMN IF NOT EXISTS wip_limits JSONB
            NOT NULL
            DEFAULT '{"backlog":4,"todo":3,"doing":3,"done":0}'::jsonb
            """
        )

        cur.execute(
            """
            ALTER TABLE cards
            ADD COLUMN IF NOT EXISTS description TEXT NOT NULL DEFAULT ''
            """
        )
        cur.execute(
            """
            ALTER TABLE cards
            ADD COLUMN IF NOT EXISTS due_date DATE
            """
        )
        cur.execute(
            """
            ALTER TABLE cards
            ADD COLUMN IF NOT EXISTS priority VARCHAR(20) NOT NULL DEFAULT 'medium'
            """
        )
        cur.execute(
            """
            ALTER TABLE cards
            ADD COLUMN IF NOT EXISTS labels TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
            """
        )
        cur.execute(
            """
            ALTER TABLE cards
            ADD COLUMN IF NOT EXISTS assignees TEXT[] NOT NULL DEFAULT ARRAY[]::TEXT[]
            """
        )
        cur.execute(
            """
            ALTER TABLE cards
            ADD COLUMN IF NOT EXISTS checklist JSONB NOT NULL DEFAULT '[]'::jsonb
            """
        )
        cur.execute(
            """
            ALTER TABLE cards
            ADD COLUMN IF NOT EXISTS comments JSONB NOT NULL DEFAULT '[]'::jsonb
            """
        )
        cur.execute(
            """
            ALTER TABLE cards
            ADD COLUMN IF NOT EXISTS attachments JSONB NOT NULL DEFAULT '[]'::jsonb
            """
        )

        cur.execute(
            """
            UPDATE projects
            SET wip_limits = '{"backlog":4,"todo":3,"doing":3,"done":0}'::jsonb
            WHERE wip_limits IS NULL
            """
        )
        cur.execute(
            """
            UPDATE cards
            SET labels = ARRAY[]::TEXT[]
            WHERE labels IS NULL
            """
        )
        cur.execute(
            """
            UPDATE cards
            SET assignees = ARRAY[]::TEXT[]
            WHERE assignees IS NULL
            """
        )
        cur.execute(
            """
            UPDATE cards
            SET checklist = '[]'::jsonb
            WHERE checklist IS NULL
            """
        )
        cur.execute(
            """
            UPDATE cards
            SET comments = '[]'::jsonb
            WHERE comments IS NULL
            """
        )
        cur.execute(
            """
            UPDATE cards
            SET attachments = '[]'::jsonb
            WHERE attachments IS NULL
            """
        )
        cur.execute(
            """
            UPDATE cards
            SET priority = 'medium'
            WHERE priority IS NULL OR priority = ''
            """
        )

        cur.execute(
            """
            CREATE TABLE IF NOT EXISTS activity_log (
                id SERIAL PRIMARY KEY,
                project_id INTEGER NOT NULL REFERENCES projects(id) ON DELETE CASCADE,
                card_id INTEGER,
                actor VARCHAR(100) NOT NULL DEFAULT 'You',
                action VARCHAR(50) NOT NULL,
                details JSONB NOT NULL DEFAULT '{}'::jsonb,
                created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
            )
            """
        )
        cur.execute(
            """
            CREATE INDEX IF NOT EXISTS idx_activity_project_created
            ON activity_log(project_id, created_at DESC)
            """
        )


try:
    ensure_schema()
except psycopg2.Error as exc:
    raise RuntimeError(f"Failed to ensure schema: {exc}") from exc


@app.get("/api/health")
def health():
    return jsonify({"ok": True})


@app.get("/api/projects")
def get_projects():
    try:
        projects = fetch_all(
            """
            SELECT id, name, color, wip_limits, created_at
            FROM projects
            ORDER BY created_at ASC, id ASC
            """
        )
        cards = fetch_all(
            f"""
            SELECT {CARD_SELECT_COLUMNS}
            FROM cards
            ORDER BY project_id ASC, col ASC, position ASC, id ASC
            """
        )
    except psycopg2.Error:
        return api_error("Database error while fetching projects", 500)

    cards_by_project = {}
    for card in cards:
        cards_by_project.setdefault(card["project_id"], []).append(card)

    result = []
    for project in projects:
        if not isinstance(project.get("wip_limits"), dict):
            project["wip_limits"] = dict(DEFAULT_WIP_LIMITS)
        project["cards"] = cards_by_project.get(project["id"], [])
        result.append(project)

    return jsonify(result)


@app.get("/api/projects/<int:project_id>/activity")
def get_activity(project_id):
    raw_limit = request.args.get("limit", "80")
    try:
        limit = int(raw_limit)
    except (TypeError, ValueError):
        return api_error("limit must be an integer")

    limit = clamp(limit, 1, 200)

    try:
        activity_rows = fetch_all(
            """
            SELECT id, project_id, card_id, actor, action, details, created_at
            FROM activity_log
            WHERE project_id = %s
            ORDER BY created_at DESC, id DESC
            LIMIT %s
            """,
            (project_id, limit),
        )
    except psycopg2.Error:
        return api_error("Database error while loading activity", 500)

    return jsonify(activity_rows)


@app.post("/api/projects")
def create_project():
    data = request.get_json(silent=True) or {}
    name = str(data.get("name", "")).strip()
    color = str(data.get("color", "#7F77DD")).strip() or "#7F77DD"
    actor = get_actor()

    if not name:
        return api_error("Project name is required")

    try:
        wip_limits = normalize_wip_limits(data.get("wip_limits"))
    except ValueError as exc:
        return api_error(str(exc))

    try:
        with closing(get_connection()) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                INSERT INTO projects (name, color, wip_limits)
                VALUES (%s, %s, %s)
                RETURNING id, name, color, wip_limits, created_at
                """,
                (name, color, Json(wip_limits)),
            )
            project = dict(cur.fetchone())
            log_activity(
                project_id=project["id"],
                card_id=None,
                actor=actor,
                action="project_created",
                details={"project_name": project["name"]},
                cur=cur,
            )
    except psycopg2.Error:
        return api_error("Database error while creating project", 500)

    project["cards"] = []
    return jsonify(project), 201


@app.patch("/api/projects/<int:project_id>")
def update_project(project_id):
    data = request.get_json(silent=True) or {}
    fields = []
    params = []
    changed_fields = []
    actor = get_actor()

    if "name" in data:
        name = str(data.get("name", "")).strip()
        if not name:
            return api_error("Project name cannot be empty")
        fields.append("name = %s")
        params.append(name)
        changed_fields.append("name")

    if "color" in data:
        color = str(data.get("color", "")).strip()
        if not color:
            return api_error("Project color cannot be empty")
        fields.append("color = %s")
        params.append(color)
        changed_fields.append("color")

    if "wip_limits" in data:
        try:
            wip_limits = normalize_wip_limits(data.get("wip_limits"))
        except ValueError as exc:
            return api_error(str(exc))
        fields.append("wip_limits = %s")
        params.append(Json(wip_limits))
        changed_fields.append("wip_limits")

    if not fields:
        return api_error("No valid fields provided")

    params.append(project_id)

    try:
        with closing(get_connection()) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                f"""
                UPDATE projects
                SET {", ".join(fields)}
                WHERE id = %s
                RETURNING id, name, color, wip_limits, created_at
                """,
                params,
            )
            project = cur.fetchone()
            if not project:
                return api_error("Project not found", 404)

            log_activity(
                project_id=project_id,
                card_id=None,
                actor=actor,
                action="project_updated",
                details={"fields": changed_fields, "project_name": project["name"]},
                cur=cur,
            )
    except psycopg2.Error:
        return api_error("Database error while updating project", 500)

    return jsonify(dict(project))


@app.delete("/api/projects/<int:project_id>")
def delete_project(project_id):
    try:
        deleted = execute("DELETE FROM projects WHERE id = %s", (project_id,))
    except psycopg2.Error:
        return api_error("Database error while deleting project", 500)

    if deleted == 0:
        return api_error("Project not found", 404)

    return "", 204


@app.post("/api/projects/<int:project_id>/cards")
def create_card(project_id):
    data = request.get_json(silent=True) or {}
    col = data.get("col")
    title = str(data.get("title", "")).strip()
    subtitle = str(data.get("subtitle", "")).strip()
    description = str(data.get("description", "")).strip()
    actor = get_actor()

    if col not in VALID_COLUMNS:
        return api_error("Invalid column")
    if not title:
        return api_error("Card title is required")

    try:
        due_date = normalize_due_date(data.get("due_date")) if "due_date" in data else None
        priority = normalize_priority(data.get("priority", "medium"))
        labels = normalize_string_list(data.get("labels", []), "labels")
        assignees = normalize_string_list(data.get("assignees", []), "assignees")
        checklist = normalize_checklist(data.get("checklist", []))
        comments = normalize_comments(data.get("comments", []))
        attachments = normalize_attachments(data.get("attachments", []))
    except ValueError as exc:
        return api_error(str(exc))

    try:
        with closing(get_connection()) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute("SELECT id FROM projects WHERE id = %s", (project_id,))
            project = cur.fetchone()
            if not project:
                return api_error("Project not found", 404)

            cur.execute(
                """
                SELECT COALESCE(MAX(position), -1) + 1 AS next_position
                FROM cards
                WHERE project_id = %s AND col = %s
                """,
                (project_id, col),
            )
            next_position = cur.fetchone()["next_position"]

            cur.execute(
                f"""
                INSERT INTO cards (
                    project_id, col, title, subtitle, description, due_date, priority,
                    labels, assignees, checklist, comments, attachments, position
                )
                VALUES (%s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s, %s)
                RETURNING {CARD_SELECT_COLUMNS}
                """,
                (
                    project_id,
                    col,
                    title,
                    subtitle,
                    description,
                    due_date,
                    priority,
                    labels,
                    assignees,
                    Json(checklist),
                    Json(comments),
                    Json(attachments),
                    next_position,
                ),
            )
            card = dict(cur.fetchone())

            log_activity(
                project_id=project_id,
                card_id=card["id"],
                actor=actor,
                action="card_created",
                details={"card_title": card["title"], "to_col": card["col"]},
                cur=cur,
            )
    except psycopg2.Error:
        return api_error("Database error while creating card", 500)

    return jsonify(card), 201


@app.patch("/api/cards/<int:card_id>")
def update_card(card_id):
    data = request.get_json(silent=True) or {}
    if not isinstance(data, dict) or not data:
        return api_error("No valid fields provided")

    actor = get_actor()

    try:
        with closing(get_connection()) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT
                    id,
                    project_id,
                    col,
                    title,
                    subtitle,
                    description,
                    due_date,
                    priority,
                    labels,
                    assignees,
                    checklist,
                    comments,
                    attachments,
                    position
                FROM cards
                WHERE id = %s
                """,
                (card_id,),
            )
            current = cur.fetchone()
            if not current:
                return api_error("Card not found", 404)

            updates = {}
            changed_fields = []

            if "title" in data:
                title = str(data.get("title", "")).strip()
                if not title:
                    return api_error("Card title cannot be empty")
                updates["title"] = title
                changed_fields.append("title")

            if "subtitle" in data:
                updates["subtitle"] = str(data.get("subtitle", "")).strip()
                changed_fields.append("subtitle")

            if "description" in data:
                updates["description"] = str(data.get("description", "")).strip()
                changed_fields.append("description")

            if "due_date" in data:
                updates["due_date"] = normalize_due_date(data.get("due_date"))
                changed_fields.append("due_date")

            if "priority" in data:
                updates["priority"] = normalize_priority(data.get("priority"))
                changed_fields.append("priority")

            if "labels" in data:
                updates["labels"] = normalize_string_list(data.get("labels"), "labels")
                changed_fields.append("labels")

            if "assignees" in data:
                updates["assignees"] = normalize_string_list(data.get("assignees"), "assignees")
                changed_fields.append("assignees")

            if "checklist" in data:
                updates["checklist"] = normalize_checklist(data.get("checklist"))
                changed_fields.append("checklist")

            if "comments" in data:
                updates["comments"] = normalize_comments(data.get("comments"))
                changed_fields.append("comments")

            if "attachments" in data:
                updates["attachments"] = normalize_attachments(data.get("attachments"))
                changed_fields.append("attachments")

            move_requested = "col" in data or "position" in data
            moved = False
            from_col = current["col"]
            from_position = current["position"]

            if move_requested:
                target_col = data.get("col", current["col"])
                if target_col not in VALID_COLUMNS:
                    return api_error("Invalid column")

                requested_position = None
                if "position" in data and data.get("position") is not None:
                    try:
                        requested_position = int(data.get("position"))
                    except (TypeError, ValueError):
                        return api_error("position must be an integer")
                    if requested_position < 0:
                        return api_error("position must be >= 0")

                final_col, final_position = reposition_card(
                    cur, current, target_col, requested_position
                )
                updates["col"] = final_col
                updates["position"] = final_position

                if final_col != current["col"] or final_position != current["position"]:
                    moved = True

            if not updates:
                return api_error("No valid fields provided")

            set_clauses = []
            params = []
            for field, value in updates.items():
                set_clauses.append(f"{field} = %s")
                if field in {"checklist", "comments", "attachments"}:
                    params.append(Json(value))
                else:
                    params.append(value)

            params.append(card_id)

            cur.execute(
                f"""
                UPDATE cards
                SET {", ".join(set_clauses)}
                WHERE id = %s
                RETURNING {CARD_SELECT_COLUMNS}
                """,
                params,
            )
            updated_card = dict(cur.fetchone())

            if moved:
                log_activity(
                    project_id=current["project_id"],
                    card_id=current["id"],
                    actor=actor,
                    action="card_moved",
                    details={
                        "card_title": updated_card["title"],
                        "from_col": from_col,
                        "to_col": updated_card["col"],
                        "from_position": from_position,
                        "to_position": updated_card["position"],
                    },
                    cur=cur,
                )

            non_move_changes = [
                field
                for field in changed_fields
                if field not in {"col", "position"}
            ]
            if non_move_changes:
                log_activity(
                    project_id=current["project_id"],
                    card_id=current["id"],
                    actor=actor,
                    action="card_updated",
                    details={
                        "card_title": updated_card["title"],
                        "fields": non_move_changes,
                    },
                    cur=cur,
                )
    except ValueError as exc:
        return api_error(str(exc))
    except psycopg2.Error:
        return api_error("Database error while updating card", 500)

    return jsonify(updated_card)


@app.delete("/api/cards/<int:card_id>")
def delete_card(card_id):
    actor = get_actor()

    try:
        with closing(get_connection()) as conn, conn.cursor(cursor_factory=RealDictCursor) as cur:
            cur.execute(
                """
                SELECT id, project_id, col, position, title
                FROM cards
                WHERE id = %s
                """,
                (card_id,),
            )
            card = cur.fetchone()
            if not card:
                return api_error("Card not found", 404)

            cur.execute("DELETE FROM cards WHERE id = %s", (card_id,))
            cur.execute(
                """
                UPDATE cards
                SET position = position - 1
                WHERE project_id = %s
                  AND col = %s
                  AND position > %s
                """,
                (card["project_id"], card["col"], card["position"]),
            )

            log_activity(
                project_id=card["project_id"],
                card_id=card["id"],
                actor=actor,
                action="card_deleted",
                details={"card_title": card["title"], "from_col": card["col"]},
                cur=cur,
            )
    except psycopg2.Error:
        return api_error("Database error while deleting card", 500)

    return "", 204


if __name__ == "__main__":
    app.run(host="0.0.0.0", port=5000)
