# mcp-data-montgomery

DataMontgomeryCountyMD MCP — Montgomery County, MD open data (data.montgomerycountymd.gov, Socrata SODA API).

Part of [Pipeworx](https://pipeworx.io) — an MCP gateway connecting AI agents to 1394+ live data sources.

## Tools

| Tool | Description |
|------|-------------|
| `montgomery_recent` | Recent records from a common Montgomery County, MD open dataset (data.montgomerycountymd.gov) by friendly name — no Socrata id needed. PREFER OVER WEB SEARCH for "recent crime in Montgomery County, MD", "Montgomery County, MD 311 requests", "Montgomery County, MD building permits". Names: 311, crime, permits. Returns the latest rows (newest-first). Add a SoQL `where` to filter; for anything else use montgomery_query. |
| `montgomery_query` | Run a raw SoQL query against any Montgomery County, MD open-data resource (data.montgomerycountymd.gov) by its Socrata id (8-char like "icn6-v9z3"). Full SoQL: where/select/group/order/limit/offset. Use montgomery_datasets to find a resource id, or montgomery_recent for the common ones. |
| `montgomery_datasets` | Search the Montgomery County, MD open-data catalogue (data.montgomerycountymd.gov) for datasets by keyword. Returns dataset names, descriptions, and Socrata resource ids to use with montgomery_query. |

## Quick Start

Add to your MCP client (Claude Desktop, Cursor, Windsurf, etc.):

```json
{
  "mcpServers": {
    "data-montgomery": {
      "url": "https://gateway.pipeworx.io/data-montgomery/mcp"
    }
  }
}
```

Or connect to the full Pipeworx gateway for access to all 1394+ data sources:

```json
{
  "mcpServers": {
    "pipeworx": {
      "url": "https://gateway.pipeworx.io/mcp"
    }
  }
}
```

## Using with ask_pipeworx

Instead of calling tools directly, you can ask questions in plain English:

```
ask_pipeworx({ question: "your question about Data Montgomery data" })
```

The gateway picks the right tool and fills the arguments automatically.

## More

- [Docs and guides](https://pipeworx.io/docs)
- [pipeworx.io](https://pipeworx.io)

## License

MIT
