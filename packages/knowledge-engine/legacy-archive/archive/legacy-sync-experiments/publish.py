import json

print("--- Step 9: Publishing to backend (SyncPublisherAgent) ---")
print("Connecting to Supabase (Mock)...")

try:
    with open("Data/export/costbook.json", "r") as f:
        data = json.load(f)
        items_count = len(data.get("items", []))
        assemblies_count = len(data.get("assemblies", []))
        print(f"200 OK: Successfully synchronized {items_count} items and {assemblies_count} assemblies.")
except Exception as e:
    print(f"500 Error: Failed to publish -> {e}")
