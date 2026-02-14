const express = require('express');
const cookieParser = require('cookie-parser');
const path = require('path');
const app = express();
app.use(express.json());
app.use(cookieParser());
app.use(express.static(path.join(__dirname, 'public')));

/* ─── Data ───────────────────────────────────────────────────────── */
const users = {
  'dev-001': { id: 'dev-001', username: 'developer', password: 'dev2024', email: 'dev@devhub.io', role: 'developer', repos: ['frontend-app', 'utils-lib'] },
  'dev-002': { id: 'dev-002', username: 'teamlead', password: 'lead2024', email: 'lead@devhub.io', role: 'teamlead', repos: ['frontend-app', 'utils-lib', 'backend-api'] },
  'dev-003': { id: 'dev-003', username: 'admin', password: 'Adm!n_S3cur3#2024', email: 'admin@devhub.io', role: 'admin', repos: ['frontend-app', 'utils-lib', 'backend-api', 'infra-secrets'] }
};
const repos = {
  'frontend-app': { id: 'frontend-app', name: 'Frontend App', stars: 42, language: 'TypeScript', isPrivate: false },
  'utils-lib': { id: 'utils-lib', name: 'Utils Library', stars: 18, language: 'JavaScript', isPrivate: false },
  'backend-api': { id: 'backend-api', name: 'Backend API', stars: 67, language: 'Python', isPrivate: true },
  'infra-secrets': { id: 'infra-secrets', name: 'Infrastructure Secrets', stars: 3, language: 'YAML', isPrivate: true, flag: 'VBANK{gr4phql_1ntr0_4uth_byp4ss}' }
};

let sessions = {};

/* ─── GraphQL Schema (manual) ───────────────────────────────────── */
const schema = {
  queryType: { name: 'Query' },
  mutationType: { name: 'Mutation' },
  types: [
    {
      kind: 'OBJECT', name: 'Query', fields: [
        { name: 'me', args: [], type: { kind: 'OBJECT', name: 'User' }, description: 'Current authenticated user' },
        { name: 'user', args: [{ name: 'id', type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'String' } } }], type: { kind: 'OBJECT', name: 'User' }, description: 'Fetch user by ID' },
        { name: 'repos', args: [], type: { kind: 'LIST', ofType: { kind: 'OBJECT', name: 'Repo' } }, description: 'List accessible repositories' },
        { name: 'repo', args: [{ name: 'id', type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'String' } } }], type: { kind: 'OBJECT', name: 'Repo' }, description: 'Fetch repository by ID' }
      ]
    },
    {
      kind: 'OBJECT', name: 'Mutation', fields: [
        { name: 'updateProfile', args: [{ name: 'email', type: { kind: 'SCALAR', name: 'String' } }], type: { kind: 'OBJECT', name: 'User' }, description: 'Update own profile' },
        { name: 'promoteUser', args: [{ name: 'userId', type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'String' } } }, { name: 'role', type: { kind: 'NON_NULL', ofType: { kind: 'SCALAR', name: 'String' } } }], type: { kind: 'OBJECT', name: 'User' }, description: 'Promote a user to a new role (admin only)' }
      ]
    },
    {
      kind: 'OBJECT', name: 'User', fields: [
        { name: 'id', args: [], type: { kind: 'SCALAR', name: 'String' } },
        { name: 'username', args: [], type: { kind: 'SCALAR', name: 'String' } },
        { name: 'email', args: [], type: { kind: 'SCALAR', name: 'String' } },
        { name: 'role', args: [], type: { kind: 'SCALAR', name: 'String' } },
        { name: 'repos', args: [], type: { kind: 'LIST', ofType: { kind: 'SCALAR', name: 'String' } } }
      ]
    },
    {
      kind: 'OBJECT', name: 'Repo', fields: [
        { name: 'id', args: [], type: { kind: 'SCALAR', name: 'String' } },
        { name: 'name', args: [], type: { kind: 'SCALAR', name: 'String' } },
        { name: 'stars', args: [], type: { kind: 'SCALAR', name: 'Int' } },
        { name: 'language', args: [], type: { kind: 'SCALAR', name: 'String' } },
        { name: 'isPrivate', args: [], type: { kind: 'SCALAR', name: 'Boolean' } },
        { name: 'flag', args: [], type: { kind: 'SCALAR', name: 'String' }, description: 'Hidden flag field' }
      ]
    },
    { kind: 'SCALAR', name: 'String' },
    { kind: 'SCALAR', name: 'Int' },
    { kind: 'SCALAR', name: 'Boolean' }
  ]
};

/* ─── Auth ────────────────────────────────────────────────────────── */
app.post('/api/auth/login', (req, res) => {
  const { username, password } = req.body;
  const user = Object.values(users).find(u => u.username === username && u.password === password);
  if (!user) return res.status(401).json({ error: 'Invalid credentials' });
  const sid = 'sess_' + Math.random().toString(36).substring(2);
  sessions[sid] = user.id;
  res.cookie('session', sid, { httpOnly: true });
  res.json({ user: { id: user.id, username: user.username, role: user.role } });
});

app.post('/api/auth/logout', (req, res) => {
  delete sessions[req.cookies.session];
  res.clearCookie('session');
  res.json({ message: 'Logged out' });
});

function getUser(req) {
  const sid = req.cookies.session;
  if (!sid || !sessions[sid]) return null;
  return users[sessions[sid]] || null;
}

/* ─── Simple GraphQL Query Parser ─────────────────────────────── */
function parseQuery(query) {
  query = query.trim();
  // Detect introspection
  if (query.includes('__schema') || query.includes('__type')) return { type: 'introspection', query };

  const mutMatch = query.match(/^mutation\s*(?:\w+)?\s*(?:\(([^)]*)\))?\s*\{([\s\S]*)\}$/);
  if (mutMatch) return { type: 'mutation', body: mutMatch[2].trim(), vars: mutMatch[1] || '' };

  const qMatch = query.match(/^(?:query\s*(?:\w+)?\s*(?:\(([^)]*)\))?\s*)?\{([\s\S]*)\}$/);
  if (qMatch) return { type: 'query', body: qMatch[2].trim(), vars: qMatch[1] || '' };

  return null;
}

function extractFields(body) {
  // Simple: get the top-level names and any nested selections
  const fields = [];
  let depth = 0, current = '', i = 0;
  while (i < body.length) {
    if (body[i] === '{') { depth++; current += body[i]; }
    else if (body[i] === '}') { depth--; current += body[i]; }
    else if ((body[i] === '\n' || body[i] === ',') && depth === 0) {
      if (current.trim()) fields.push(current.trim());
      current = '';
    }
    else { current += body[i]; }
    i++;
  }
  if (current.trim()) fields.push(current.trim());
  return fields;
}

function resolveField(fieldStr, context) {
  // Extract field name and args
  const argMatch = fieldStr.match(/^(\w+)\s*(?:\(([^)]*)\))?\s*(?:\{([\s\S]*)\})?$/);
  if (!argMatch) return null;
  const [, name, argsStr, subFields] = argMatch;
  const args = {};
  if (argsStr) {
    const pairs = argsStr.match(/(\w+)\s*:\s*"([^"]*)"/g);
    if (pairs) pairs.forEach(p => { const m = p.match(/(\w+)\s*:\s*"([^"]*)"/); if(m) args[m[1]] = m[2]; });
  }
  return { name, args, subFields: subFields || null };
}

function selectFields(obj, subFieldsStr) {
  if (!subFieldsStr) return obj;
  const wanted = extractFields(subFieldsStr).map(f => f.replace(/\{.*\}/, '').trim());
  const result = {};
  wanted.forEach(f => { if (f in obj) result[f] = obj[f]; });
  return Object.keys(result).length ? result : obj;
}

/* ─── GraphQL Endpoint ────────────────────────────────────────── */
app.post('/api/graphql', (req, res) => {
  const { query, variables } = req.body;
  if (!query) return res.status(400).json({ errors: [{ message: 'Query required' }] });

  const parsed = parseQuery(query.trim());
  if (!parsed) return res.status(400).json({ errors: [{ message: 'Could not parse query' }] });

  const user = getUser(req);

  /* Introspection — deliberately enabled (vulnerability!) */
  if (parsed.type === 'introspection') {
    return res.json({ data: { __schema: schema } });
  }

  /* Queries */
  if (parsed.type === 'query') {
    const fields = extractFields(parsed.body);
    const data = {};
    for (const f of fields) {
      const field = resolveField(f, { user });
      if (!field) continue;

      if (field.name === 'me') {
        if (!user) { data.me = null; continue; }
        const u = { id: user.id, username: user.username, email: user.email, role: user.role, repos: user.repos };
        data.me = selectFields(u, field.subFields);
      }
      else if (field.name === 'user') {
        if (!user) return res.status(401).json({ errors: [{ message: 'Authentication required' }] });
        const target = users[field.args.id];
        if (!target) { data.user = null; continue; }
        const u = { id: target.id, username: target.username, email: target.email, role: target.role, repos: target.repos };
        data.user = selectFields(u, field.subFields);
      }
      else if (field.name === 'repos') {
        if (!user) return res.status(401).json({ errors: [{ message: 'Authentication required' }] });
        const accessible = user.repos.map(rid => {
          const r = repos[rid];
          return r ? { id: r.id, name: r.name, stars: r.stars, language: r.language, isPrivate: r.isPrivate, flag: r.flag || null } : null;
        }).filter(Boolean);
        data.repos = accessible.map(r => selectFields(r, field.subFields));
      }
      else if (field.name === 'repo') {
        if (!user) return res.status(401).json({ errors: [{ message: 'Authentication required' }] });
        const r = repos[field.args.id];
        /* BUG: No authorization check — any authenticated user can read any repo */
        if (!r) { data.repo = null; continue; }
        data.repo = selectFields({ id: r.id, name: r.name, stars: r.stars, language: r.language, isPrivate: r.isPrivate, flag: r.flag || null }, field.subFields);
      }
    }
    return res.json({ data });
  }

  /* Mutations */
  if (parsed.type === 'mutation') {
    const fields = extractFields(parsed.body);
    const data = {};
    for (const f of fields) {
      const field = resolveField(f, { user });
      if (!field) continue;

      if (field.name === 'updateProfile') {
        if (!user) return res.status(401).json({ errors: [{ message: 'Authentication required' }] });
        if (field.args.email) user.email = field.args.email;
        data.updateProfile = { id: user.id, username: user.username, email: user.email, role: user.role };
      }
      else if (field.name === 'promoteUser') {
        if (!user) return res.status(401).json({ errors: [{ message: 'Authentication required' }] });
        /* VULNERABILITY: Checks the REQUESTED role arg, not the current user's role */
        /* Developer should check context.user.role === 'admin' but instead checks args.role */
        if (field.args.role !== 'admin' && user.role !== 'admin') {
          /* This condition is effectively: if user is not requesting admin AND user is not admin, deny.
             BUT: if someone requests role:"admin" for themselves, the first condition is FALSE, so it passes! */
        }
        const target = users[field.args.userId];
        if (!target) return res.json({ errors: [{ message: 'User not found' }] });
        target.role = field.args.role;
        /* If promoted to admin, give access to all repos */
        if (field.args.role === 'admin') {
          target.repos = Object.keys(repos);
        }
        data.promoteUser = selectFields({ id: target.id, username: target.username, email: target.email, role: target.role, repos: target.repos }, field.subFields);
      }
    }
    return res.json({ data });
  }

  res.status(400).json({ errors: [{ message: 'Unsupported operation' }] });
});

/* ─── REST Endpoints ──────────────────────────────────────────── */
app.get('/api/profile', (req, res) => {
  const user = getUser(req);
  if (!user) return res.status(401).json({ error: 'Not authenticated' });
  res.json({ user: { id: user.id, username: user.username, email: user.email, role: user.role, repos: user.repos } });
});

app.listen(9009, '0.0.0.0', () => console.log('[Lab-09 DevHub] Port 9009'));
