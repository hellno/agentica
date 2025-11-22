# Agentica Backend

## Important: Database Connection

**Use SESSION pooler with pgbouncer parameter** - Transaction pooler has Drizzle introspection bug, direct IPv4 not available on free tier.

```bash
# ✅ Correct (Session pooler):
POSTGRES_URL="postgresql://postgres.{project}:{password}@aws-0-{region}.pooler.supabase.com:6543/postgres?pgbouncer=true&connection_limit=1"

# ❌ Causes introspection error (Transaction pooler):
POSTGRES_URL="postgresql://postgres.{project}:{password}@aws-0-{region}.pooler.supabase.com:6543/postgres"

# ❌ IPv6 only, Modal can't connect (Direct connection):
POSTGRES_URL="postgresql://postgres.{project}:{password}@db.{project}.supabase.co:5432/postgres"
```

Get Session pooler URL from: Supabase Dashboard → Database → Connection pooling → **Session mode**
