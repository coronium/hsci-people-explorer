# HoS People Explorer

An interactive web explorer for scholars in the **history of science** — their awards, journal editorships, and organizational roles.

Part of [IsisCB Projects](https://isiscb.org).

## Features

- **Directory**: Filterable table of 761 scholars with links to Wikipedia, Wikidata, IsisCB, and VIAF
- **Search**: Full-text search with autocomplete across names, descriptions, journals, organizations, and awards
- **Network Graph**: D3.js force-directed graph showing how scholars are connected through shared affiliations
- **Person Detail**: Individual scholar pages with all roles, external links, and a mini network graph
- **Statistics**: Summary charts showing activity by decade, most connected scholars, and organization sizes
- **Narrative**: A short essay on the development of history of science as a professional discipline
- **Downloads**: Source CSV files for reuse

## Data Sources

Data comes from [Wikidata](https://www.wikidata.org) SPARQL queries, supplemented with web-sourced editorial records:

| File | Records | Description |
|------|---------|-------------|
| `wikidata_hos_award_recipients.csv` | 335 | Prize recipients (Sarton Medal, Pfizer Award, Koyré Medal, etc.) |
| `wikidata_hos_journal_editors.csv` | 456 | Editors of 25 major HoS journals |
| `wikidata_hos_org_officers.csv` | 456 | Officers/members of 14 professional societies |

## Development

### Rebuild data

```bash
python3 build_data.py
```

This reads the CSV files in `data/` and generates `people.json`, `graph.json`, and `stats.json`.

### Local development

Serve with any static file server:

```bash
python3 -m http.server 8000
```

Then open http://localhost:8000.

## Deployment

Deployed as a static site on [Render.com](https://render.com). Auto-deploys on push to `main`.

## License

Data is sourced from Wikidata (CC0). Code is available for reuse under the MIT License.
