import sqlite3
import argparse
import os

# Database is kept in your home folder so it persists across all projects
DB_PATH = os.path.expanduser("~/.antigravity-mem.db")

def init_db():
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("""
            CREATE TABLE IF NOT EXISTS memories (
                id INTEGER PRIMARY KEY AUTOINCREMENT,
                tags TEXT, 
                content TEXT NOT NULL,
                timestamp DATETIME DEFAULT CURRENT_TIMESTAMP
            )
        """)

def save_memory(text, tags):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("INSERT INTO memories (tags, content) VALUES (?, ?)", (tags, text))
    print(f"✅ Memory saved under tags: {tags}")

def search_memories(query):
    with sqlite3.connect(DB_PATH) as conn:
        cursor = conn.execute(
            "SELECT id, tags, content FROM memories WHERE tags LIKE ? OR content LIKE ? ORDER BY timestamp DESC LIMIT 5",
            (f'%{query}%', f'%{query}%')
        )
        results = cursor.fetchall()
        if results:
            print(f"\n--- Relevant Memories for '{query}' ---")
            for mem_id, tags, content in results:
                print(f"ID: {mem_id} | [{tags.upper()}]: {content}")
        else:
            print(f"ℹ️ No relevant knowledge found for '{query}'.")

def delete_memory(mem_id):
    with sqlite3.connect(DB_PATH) as conn:
        conn.execute("DELETE FROM memories WHERE id = ?", (mem_id,))
    print(f"🗑️ Memory ID {mem_id} deleted.")

def wipe_all():
    confirm = input("Are you sure you want to wipe ALL memories? (y/n): ")
    if confirm.lower() == 'y':
        with sqlite3.connect(DB_PATH) as conn:
            conn.execute("DELETE FROM memories")
        print("💥 All memories wiped.")

if __name__ == "__main__":
    parser = argparse.ArgumentParser()
    parser.add_argument("--save", type=str)
    parser.add_argument("--tags", type=str)
    parser.add_argument("--search", type=str)
    parser.add_argument("--delete", type=int, help="Delete a specific memory ID")
    parser.add_argument("--wipe", action="store_true", help="Wipe all memories")
    args = parser.parse_args()
    init_db()

    if args.save:
        save_memory(args.save, args.tags or "general")
    elif args.search:
        search_memories(args.search)
    elif args.delete:
        delete_memory(args.delete)
    elif args.wipe:
        wipe_all()

