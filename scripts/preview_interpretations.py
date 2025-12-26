import yaml
from pathlib import Path

papers = yaml.safe_load(Path("../data/papers.yaml").read_text())

for p in papers:
    if "why_it_matters" in p:
        print("=" * 80)
        print(f"{p['title']} ({p['year']})")
        print(f"Impact: {p.get('impact_type')}")
        if "relations" in p:
            print("Relations:")
            for r in p["relations"]:
                print(f"  - {r['type']} → {r['target']}")
        print()
        print(p["why_it_matters"])
        print()
