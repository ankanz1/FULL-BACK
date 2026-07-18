import ast
with open("sports_api.py", encoding="utf-8") as f:
    ast.parse(f.read())
print("sports_api.py syntax OK")
