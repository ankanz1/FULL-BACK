import ast, sys
with open("main.py", encoding="utf-8") as f:
    ast.parse(f.read())
print("Syntax OK")
