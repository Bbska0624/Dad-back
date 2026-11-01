-- Чатботын мэдлэгийн сан (RAG). Prisma удирддаггүй: vector төрөл болон функцтэй.
-- Энэ файл Supabase дээрх одоогийн бүтцийн хуулбар. prisma migrate автоматаар ажиллуулахгүй.
-- Шинэ Supabase project дээр SQL Editor-оор нэг удаа гараар ажиллуулна.

CREATE EXTENSION IF NOT EXISTS vector;

CREATE TABLE kb_sources (
  id           bigserial PRIMARY KEY,
  source_path  text NOT NULL UNIQUE,
  title        text NOT NULL,
  business     text NOT NULL DEFAULT 'general' CHECK (business = ANY (ARRAY['course','web','merch','general'])),
  doc_type     text NOT NULL CHECK (doc_type = ANY (ARRAY['pdf','docx','json','txt','md'])),
  content_hash text NOT NULL,
  is_active    boolean NOT NULL DEFAULT true,
  metadata     jsonb NOT NULL DEFAULT '{}'::jsonb,
  created_at   timestamptz NOT NULL DEFAULT now(),
  updated_at   timestamptz NOT NULL DEFAULT now()
);
CREATE INDEX kb_sources_business_idx ON kb_sources (business) WHERE is_active;

CREATE TABLE kb_chunks (
  id          bigserial PRIMARY KEY,
  source_id   bigint NOT NULL REFERENCES kb_sources(id) ON DELETE CASCADE,
  chunk_index integer NOT NULL,
  content     text NOT NULL,
  page        integer,
  metadata    jsonb NOT NULL DEFAULT '{}'::jsonb,
  embedding   vector(1536) NOT NULL,
  created_at  timestamptz NOT NULL DEFAULT now(),
  UNIQUE (source_id, chunk_index)
);
CREATE INDEX kb_chunks_source_id_idx ON kb_chunks (source_id);
CREATE INDEX kb_chunks_embedding_idx ON kb_chunks USING hnsw (embedding vector_cosine_ops);

CREATE TABLE kb_rate_limits (
  bucket       text NOT NULL,
  window_start timestamptz NOT NULL,
  hits         integer NOT NULL DEFAULT 0,
  PRIMARY KEY (bucket, window_start)
);

ALTER TABLE kb_sources ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_chunks ENABLE ROW LEVEL SECURITY;
ALTER TABLE kb_rate_limits ENABLE ROW LEVEL SECURITY;

CREATE OR REPLACE FUNCTION public.kb_match_chunks(query_embedding vector, match_count integer DEFAULT 5, min_similarity double precision DEFAULT 0.0, filter_business text DEFAULT NULL::text)
 RETURNS TABLE(chunk_id bigint, source_id bigint, content text, page integer, chunk_meta jsonb, title text, source_path text, business text, doc_type text, similarity double precision)
 LANGUAGE sql
 STABLE
AS $function$
  select *
  from (
    select
      c.id          as chunk_id,
      c.source_id,
      c.content,
      c.page,
      c.metadata    as chunk_meta,
      s.title,
      s.source_path,
      s.business,
      s.doc_type,
      1 - (c.embedding <=> query_embedding) as similarity
    from kb_chunks c
    join kb_sources s on s.id = c.source_id
    where s.is_active
      and (filter_business is null
           or s.business = filter_business
           or s.business = 'general')
    order by c.embedding <=> query_embedding
    limit match_count
  ) ranked
  where similarity >= min_similarity;
$function$;

CREATE OR REPLACE FUNCTION public.kb_rate_limit_hit(p_bucket text, p_window_seconds integer, p_limit integer)
 RETURNS boolean
 LANGUAGE plpgsql
AS $function$
declare
  w timestamptz;
  h int;
begin
  w := to_timestamp(floor(extract(epoch from now()) / p_window_seconds) * p_window_seconds);

  insert into kb_rate_limits as r (bucket, window_start, hits)
  values (p_bucket, w, 1)
  on conflict (bucket, window_start) do update set hits = r.hits + 1
  returning r.hits into h;

  -- хуучин мөрүүдийг хааяа цэвэрлэнэ
  if random() < 0.02 then
    delete from kb_rate_limits where window_start < now() - interval '2 days';
  end if;

  return h <= p_limit;
end;
$function$;
