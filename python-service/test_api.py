
import os
import sys

# Add the current directory to Python path
sys.path.insert(0, os.path.dirname(os.path.abspath(__file__)))

import main

print("Testing process_clustering...")
main.process_clustering()
print("✓ process_clustering successful!")
print(f"✓ Loaded {len(main.processed_data['df'])} players!")
print(f"✓ Silhouette score: {main.processed_data['silhouette_score']}")
print("✓ Archetypes:", main.processed_data["archetypes"])

print("\nAPI endpoints are ready to be tested at http://localhost:8000!")

