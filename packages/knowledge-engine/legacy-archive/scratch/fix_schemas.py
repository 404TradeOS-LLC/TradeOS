import os

schema_dir = "schemas"
replacements = {
    '"type": "OBJECT"': '"type": "object"',
    '"type": "STRING"': '"type": "string"',
    '"type": "NUMBER"': '"type": "number"',
    '"type": "ARRAY"': '"type": "array"',
    '"type": "BOOLEAN"': '"type": "boolean"',
    '"type": "INTEGER"': '"type": "integer"'
}

for f in os.listdir(schema_dir):
    if f.endswith(".json"):
        path = os.path.join(schema_dir, f)
        with open(path, "r") as file:
            content = file.read()
        
        original_content = content
        for k, v in replacements.items():
            content = content.replace(k, v)
        
        if content != original_content:
            with open(path, "w") as file:
                file.write(content)
            print(f"Standardized JSON schema types in: {f}")
