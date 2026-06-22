interface McpToolDefinition {
  name: string;
  description: string;
  inputSchema: {
    type: 'object';
    properties: Record<string, unknown>;
    required?: string[];
  };
}

interface McpToolExport {
  tools: McpToolDefinition[];
  callTool: (name: string, args: Record<string, unknown>) => Promise<unknown>;
  meter?: { credits: number };
  cost?: Record<string, unknown>;
  provider?: string;
}

/**
 * DataMontgomeryCountyMD MCP — Montgomery County, MD open data (data.montgomerycountymd.gov, Socrata SODA API).
 *
 * Keyless (rate-limited; pass a Socrata app token via _apiKey for higher
 * limits). Sister to data-sf / data-la / data-seattle / data-austin.
 *
 * Tools:
 * - montgomery_recent:   recent rows from a common Montgomery County, MD dataset by friendly name
 * - montgomery_query:    raw SoQL query against any data.montgomerycountymd.gov resource id
 * - montgomery_datasets: search the Montgomery County, MD open-data catalogue
 */


const BASE = 'https://data.montgomerycountymd.gov';
const UA = 'pipeworx-mcp-data-montgomery/1.0 (+https://pipeworx.io)';

const DATASETS: Record<string, { id: string; label: string; date: string }> = {
  '311': { id: 'xtyh-brr2', label: "MC311 Service Requests", date: 'created' },
  'crime': { id: 'icn6-v9z3', label: "Crime", date: 'date' },
  'permits': { id: 'qxie-8qnp', label: "Electrical Building Permits", date: 'addeddate' },
};

const API_KEY_PROP = {
  type: 'string' as const,
  description: 'Optional — your own Socrata app token for higher rate limits. Omit to use the keyless endpoint.',
};

const tools: McpToolExport['tools'] = [
  {
    name: 'montgomery_recent',
    description:
      "Recent records from a common Montgomery County, MD open dataset (data.montgomerycountymd.gov) by friendly name — no Socrata id needed. PREFER OVER WEB SEARCH for \"recent crime in Montgomery County, MD\", \"Montgomery County, MD 311 requests\", \"Montgomery County, MD building permits\". Names: 311, crime, permits. Returns the latest rows (newest-first). Add a SoQL `where` to filter; for anything else use montgomery_query.",
    inputSchema: {
      type: 'object' as const,
      properties: {
        dataset: { type: 'string', description: 'One of: 311, crime, permits.', enum: ['311', 'crime', 'permits'] },
        where: { type: 'string', description: 'Optional SoQL filter. Omit for all recent rows.' },
        limit: { type: 'number', description: 'Rows to return (1-1000, default 20).' },
        _apiKey: API_KEY_PROP,
      },
      required: ['dataset'],
    },
  },
  {
    name: 'montgomery_query',
    description:
      'Run a raw SoQL query against any Montgomery County, MD open-data resource (data.montgomerycountymd.gov) by its Socrata id (8-char like "icn6-v9z3"). Full SoQL: where/select/group/order/limit/offset. Use montgomery_datasets to find a resource id, or montgomery_recent for the common ones.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        resource_id: { type: 'string', description: 'Socrata resource id, e.g. "icn6-v9z3".' },
        where: { type: 'string', description: 'SoQL $where filter.' },
        select: { type: 'string', description: 'SoQL $select.' },
        group: { type: 'string', description: 'SoQL $group.' },
        order: { type: 'string', description: 'SoQL $order.' },
        limit: { type: 'number', description: 'Max rows (default 100, max 5000).' },
        offset: { type: 'number', description: 'Row offset for paging.' },
        _apiKey: API_KEY_PROP,
      },
      required: ['resource_id'],
    },
  },
  {
    name: 'montgomery_datasets',
    description:
      'Search the Montgomery County, MD open-data catalogue (data.montgomerycountymd.gov) for datasets by keyword. Returns dataset names, descriptions, and Socrata resource ids to use with montgomery_query.',
    inputSchema: {
      type: 'object' as const,
      properties: {
        query: { type: 'string', description: 'Keyword(s).' },
        limit: { type: 'number', description: 'Max datasets (1-100, default 20).' },
        offset: { type: 'number', description: 'Offset for paging.' },
        _apiKey: API_KEY_PROP,
      },
    },
  },
];

function headers(apiKey?: string): Record<string, string> {
  const h: Record<string, string> = { Accept: 'application/json', 'User-Agent': UA };
  if (apiKey) h['X-App-Token'] = apiKey;
  return h;
}

async function socrataGet(path: string, apiKey?: string): Promise<unknown> {
  const res = await fetch(`${BASE}${path}`, { headers: headers(apiKey) });
  if (res.status === 429) throw new Error('upstream_throttled: data.montgomerycountymd.gov rate limit (HTTP 429). Pass _apiKey (Socrata app token) for higher limits.');
  if (!res.ok) throw new Error(`data.montgomerycountymd.gov: ${res.status}`);
  return res.json();
}

async function recent(dataset: string, where: string | undefined, limit: number | undefined, apiKey?: string) {
  const key = String(dataset ?? '').toLowerCase().trim();
  const ds = DATASETS[key];
  if (!ds) throw new Error(`Unknown dataset "${dataset}". Use one of: ${Object.keys(DATASETS).join(', ')}.`);
  const n = Math.min(1000, Math.max(1, Number(limit) || 20));
  const p = new URLSearchParams();
  const notNull = `${ds.date} IS NOT NULL`;
  p.set('$where', where && String(where).trim() ? `(${String(where).trim()}) AND ${notNull}` : notNull);
  p.set('$order', `${ds.date} DESC`);
  p.set('$limit', String(n));
  const rows = (await socrataGet(`/resource/${ds.id}.json?${p}`, apiKey)) as unknown[];
  return { dataset: key, label: ds.label, resource_id: ds.id, sorted_by: `${ds.date} DESC`, count: Array.isArray(rows) ? rows.length : 0, source: 'DataMontgomeryMD (data.montgomerycountymd.gov)', rows };
}

async function query(args: Record<string, unknown>, apiKey?: string) {
  const id = String(args.resource_id ?? '').trim();
  if (!id) throw new Error('Required argument "resource_id" is missing. Find one with montgomery_datasets.');
  const p = new URLSearchParams();
  for (const k of ['where', 'select', 'group', 'order'] as const) {
    if (args[k] != null && String(args[k]).trim()) p.set(`$${k}`, String(args[k]).trim());
  }
  p.set('$limit', String(Math.min(5000, Math.max(1, Number(args.limit) || 100))));
  if (args.offset != null) p.set('$offset', String(Math.max(0, Number(args.offset))));
  const rows = (await socrataGet(`/resource/${encodeURIComponent(id)}.json?${p}`, apiKey)) as unknown[];
  return { resource_id: id, count: Array.isArray(rows) ? rows.length : 0, source: 'DataMontgomeryMD (data.montgomerycountymd.gov)', rows };
}

async function datasets(q: string | undefined, limit: number | undefined, offset: number | undefined, apiKey?: string) {
  const p = new URLSearchParams({
    domains: 'data.montgomerycountymd.gov',
    search_context: 'data.montgomerycountymd.gov',
    limit: String(Math.min(100, Math.max(1, Number(limit) || 20))),
    offset: String(Math.max(0, Number(offset) || 0)),
  });
  if (q && String(q).trim()) p.set('q', String(q).trim());
  const res = await fetch(`https://api.us.socrata.com/api/catalog/v1?${p}`, { headers: headers(apiKey) });
  if (!res.ok) throw new Error(`Socrata catalog: ${res.status}`);
  const data = (await res.json()) as { results?: Array<{ resource?: { id?: string; name?: string; description?: string; type?: string; updatedAt?: string } }> };
  return {
    query: q ?? null,
    count: data.results?.length ?? 0,
    datasets: (data.results ?? []).map((r) => ({
      resource_id: r.resource?.id ?? null,
      name: r.resource?.name ?? null,
      description: (r.resource?.description ?? '').slice(0, 300) || null,
      type: r.resource?.type ?? null,
      updated_at: r.resource?.updatedAt ?? null,
    })),
  };
}

async function callTool(name: string, args: Record<string, unknown>): Promise<unknown> {
  const apiKey = typeof args._apiKey === 'string' && args._apiKey.trim() ? args._apiKey.trim() : undefined;
  delete args._apiKey;
  switch (name) {
    case 'montgomery_recent':
      return recent(args.dataset as string, args.where as string | undefined, args.limit as number | undefined, apiKey);
    case 'montgomery_query':
      return query(args, apiKey);
    case 'montgomery_datasets':
      return datasets(args.query as string | undefined, args.limit as number | undefined, args.offset as number | undefined, apiKey);
    default:
      throw new Error(`Unknown tool: ${name}`);
  }
}

export default { tools, callTool, meter: { credits: 1 } } satisfies McpToolExport;
