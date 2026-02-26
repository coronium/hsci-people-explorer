#!/usr/bin/env python3
"""Build JSON data files from source CSVs for the HoS People Explorer."""

import csv
import json
import os
from collections import defaultdict

DATA_DIR = os.path.join(os.path.dirname(__file__), "data")


def read_csv(filename):
    """Read a CSV file and return list of dicts, skipping empty rows."""
    path = os.path.join(DATA_DIR, filename)
    rows = []
    with open(path, "r", encoding="utf-8") as f:
        reader = csv.DictReader(f)
        for row in reader:
            # Flatten any list values (extra commas in CSV)
            clean = {}
            for k, v in row.items():
                if isinstance(v, list):
                    clean[k] = ", ".join(v)
                else:
                    clean[k] = v or ""
            # Skip fully empty rows
            if any(v.strip() for v in clean.values()):
                rows.append(clean)
    return rows


def normalize_name(name):
    """Normalize a name for dedup matching."""
    return " ".join(name.strip().lower().split())


def get_person_key(row, qid_field="person_wikidata_id", name_field="person_name"):
    """Get a dedup key: prefer Wikidata QID, fall back to normalized name."""
    qid = (row.get(qid_field) or "").strip()
    if qid:
        return f"qid:{qid}"
    name = (row.get(name_field) or "").strip()
    if name:
        return f"name:{normalize_name(name)}"
    return None


def safe_str(val):
    return (val or "").strip()


def safe_year(val):
    v = safe_str(val)
    if v and v.isdigit():
        return int(v)
    return None


def build_people():
    """Merge all three CSVs into a unified people dict keyed by dedup key."""
    people = {}  # key -> person dict

    def ensure_person(key, name, wikidata_id, description, viaf_id, isiscb_id):
        if key not in people:
            people[key] = {
                "name": name,
                "wikidata_id": wikidata_id or "",
                "description": description or "",
                "viaf_id": "",
                "isiscb_id": "",
                "awards": [],
                "editorships": [],
                "memberships": [],
            }
        p = people[key]
        # Fill in missing fields from later sources
        if not p["description"] and description:
            p["description"] = description
        if not p["viaf_id"] and viaf_id:
            p["viaf_id"] = viaf_id
        if not p["isiscb_id"] and isiscb_id:
            p["isiscb_id"] = isiscb_id
        if not p["wikidata_id"] and wikidata_id:
            p["wikidata_id"] = wikidata_id
        return p

    # --- Awards ---
    awards_rows = read_csv("wikidata_hos_award_recipients.csv")
    for row in awards_rows:
        name = safe_str(row.get("person_name"))
        if not name:
            continue
        key = get_person_key(row)
        if not key:
            continue
        wqid = safe_str(row.get("person_wikidata_id"))
        desc = safe_str(row.get("person_description"))
        viaf = safe_str(row.get("viaf_id"))
        isiscb = safe_str(row.get("isiscb_id"))
        p = ensure_person(key, name, wqid, desc, viaf, isiscb)
        award_name = safe_str(row.get("award_name"))
        year = safe_year(row.get("year"))
        if award_name:
            p["awards"].append({"name": award_name, "year": year})

    # --- Editors ---
    editors_rows = read_csv("wikidata_hos_journal_editors.csv")
    for row in editors_rows:
        name = safe_str(row.get("person_name"))
        if not name:
            continue
        key = get_person_key(row, qid_field="person_qid", name_field="person_name")
        if not key:
            continue
        wqid = safe_str(row.get("person_qid"))
        desc = safe_str(row.get("person_description"))
        viaf = safe_str(row.get("viaf_id"))
        isiscb = safe_str(row.get("isiscb_id"))
        p = ensure_person(key, name, wqid, desc, viaf, isiscb)
        journal = safe_str(row.get("journal_name"))
        role = safe_str(row.get("role"))
        start = safe_str(row.get("start_date"))
        end = safe_str(row.get("end_date"))
        if journal:
            p["editorships"].append({
                "journal": journal,
                "role": role,
                "start": start,
                "end": end,
            })

    # --- Officers/Members ---
    officers_rows = read_csv("wikidata_hos_org_officers.csv")
    for row in officers_rows:
        name = safe_str(row.get("person_name"))
        if not name:
            continue
        key = get_person_key(row)
        if not key:
            continue
        wqid = safe_str(row.get("person_wikidata_id"))
        desc = safe_str(row.get("person_description"))
        viaf = safe_str(row.get("viaf_id"))
        isiscb = safe_str(row.get("isiscb_id"))
        p = ensure_person(key, name, wqid, desc, viaf, isiscb)
        org = safe_str(row.get("organization"))
        role = safe_str(row.get("role"))
        start = safe_year(row.get("start_year"))
        end = safe_year(row.get("end_year"))
        if org:
            p["memberships"].append({
                "org": org,
                "role": role,
                "start": start,
                "end": end,
            })

    return people


def assign_ids(people):
    """Assign stable string IDs to each person and return a list."""
    result = []
    for key, p in sorted(people.items(), key=lambda x: x[1]["name"]):
        # Use wikidata_id if available, otherwise hash of key
        pid = p["wikidata_id"] if p["wikidata_id"] else key.replace("name:", "n_").replace(" ", "_")
        p["id"] = pid

        # Compute summary stats
        p["role_count"] = len(p["awards"]) + len(p["editorships"]) + len(p["memberships"])

        years = []
        for a in p["awards"]:
            if a.get("year"):
                years.append(a["year"])
        for e in p["editorships"]:
            s = e.get("start")
            if s and s.isdigit():
                years.append(int(s))
            en = e.get("end")
            if en and en.isdigit():
                years.append(int(en))
        for m in p["memberships"]:
            if m.get("start"):
                years.append(m["start"])
            if m.get("end"):
                years.append(m["end"])

        p["earliest_year"] = min(years) if years else None
        p["latest_year"] = max(years) if years else None

        result.append(p)
    return result


def build_graph(people_list):
    """Build a network graph where people are connected by shared affiliations."""
    # Build affiliation -> set of person IDs
    org_members = defaultdict(set)
    journal_editors = defaultdict(set)
    award_recipients = defaultdict(set)

    for p in people_list:
        pid = p["id"]
        for m in p["memberships"]:
            org_members[m["org"]].add(pid)
        for e in p["editorships"]:
            journal_editors[e["journal"]].add(pid)
        for a in p["awards"]:
            award_recipients[a["name"]].add(pid)

    # Build edges
    edge_weights = defaultdict(float)

    def add_edges(group_dict, weight, edge_type):
        for group_name, members in group_dict.items():
            members_list = sorted(members)
            for i in range(len(members_list)):
                for j in range(i + 1, len(members_list)):
                    key = (members_list[i], members_list[j])
                    edge_weights[key] += weight

    add_edges(org_members, 1, "org")
    add_edges(journal_editors, 2, "journal")
    add_edges(award_recipients, 1, "award")

    # Build node list (only people with connections)
    connected_ids = set()
    for (a, b) in edge_weights:
        connected_ids.add(a)
        connected_ids.add(b)

    id_to_person = {p["id"]: p for p in people_list}
    nodes = []
    for pid in sorted(connected_ids):
        p = id_to_person.get(pid)
        if p:
            nodes.append({
                "id": pid,
                "name": p["name"],
                "description": p["description"],
                "role_count": p["role_count"],
            })

    # Only include edges with weight >= 2 to keep file size manageable
    # (weight 1 = single shared large org, weight 2+ = shared journal or multiple shared contexts)
    edges = []
    for (source, target), weight in sorted(edge_weights.items()):
        if weight >= 2:
            edges.append({
                "source": source,
                "target": target,
                "weight": weight,
            })

    # Recompute connected nodes based on filtered edges
    connected_ids = set()
    for e in edges:
        connected_ids.add(e["source"])
        connected_ids.add(e["target"])

    nodes = []
    for pid in sorted(connected_ids):
        p = id_to_person.get(pid)
        if p:
            nodes.append({
                "id": pid,
                "name": p["name"],
                "description": p["description"],
                "role_count": p["role_count"],
            })

    return {"nodes": nodes, "links": edges}


def build_stats(people_list, graph):
    """Compute summary statistics."""
    total_people = len(people_list)

    all_awards = set()
    all_journals = set()
    all_orgs = set()

    decade_counts = defaultdict(int)
    award_decade_counts = defaultdict(lambda: defaultdict(int))
    org_member_counts = defaultdict(int)

    for p in people_list:
        for a in p["awards"]:
            all_awards.add(a["name"])
            if a.get("year"):
                decade = (a["year"] // 10) * 10
                decade_counts[decade] += 1
                award_decade_counts[a["name"]][decade] += 1
        for e in p["editorships"]:
            all_journals.add(e["journal"])
            s = e.get("start")
            if s and s.isdigit():
                decade = (int(s) // 10) * 10
                decade_counts[decade] += 1
        for m in p["memberships"]:
            all_orgs.add(m["org"])
            org_member_counts[m["org"]] += 1

    # Connection counts from graph
    connection_counts = defaultdict(int)
    for link in graph["links"]:
        connection_counts[link["source"]] += 1
        connection_counts[link["target"]] += 1

    id_to_person = {p["id"]: p for p in people_list}
    top_connected = sorted(connection_counts.items(), key=lambda x: -x[1])[:15]
    top_connected_people = []
    for pid, count in top_connected:
        p = id_to_person.get(pid)
        if p:
            top_connected_people.append({"id": pid, "name": p["name"], "connections": count})

    # Org stats
    org_stats = [{"name": org, "count": count}
                 for org, count in sorted(org_member_counts.items(), key=lambda x: -x[1])]

    # Timeline data
    timeline = [{"decade": d, "count": c}
                for d, c in sorted(decade_counts.items())]

    return {
        "total_people": total_people,
        "total_awards": len(all_awards),
        "total_journals": len(all_journals),
        "total_organizations": len(all_orgs),
        "total_connected": len(graph["nodes"]),
        "total_edges": len(graph["links"]),
        "awards_list": sorted(all_awards),
        "journals_list": sorted(all_journals),
        "organizations_list": sorted(all_orgs),
        "timeline": timeline,
        "top_connected": top_connected_people,
        "org_stats": org_stats,
    }


def main():
    print("Reading CSVs...")
    people = build_people()
    print(f"  Found {len(people)} unique people")

    print("Assigning IDs...")
    people_list = assign_ids(people)

    print("Building graph...")
    graph = build_graph(people_list)
    print(f"  {len(graph['nodes'])} connected nodes, {len(graph['links'])} edges")

    print("Computing stats...")
    stats = build_stats(people_list, graph)

    # Write outputs
    out_dir = DATA_DIR
    with open(os.path.join(out_dir, "people.json"), "w", encoding="utf-8") as f:
        json.dump(people_list, f, ensure_ascii=False, indent=1)
    print(f"  Wrote people.json ({len(people_list)} people)")

    with open(os.path.join(out_dir, "graph.json"), "w", encoding="utf-8") as f:
        json.dump(graph, f, ensure_ascii=False, indent=1)
    print(f"  Wrote graph.json")

    with open(os.path.join(out_dir, "stats.json"), "w", encoding="utf-8") as f:
        json.dump(stats, f, ensure_ascii=False, indent=1)
    print(f"  Wrote stats.json")

    print("Done!")


if __name__ == "__main__":
    main()
