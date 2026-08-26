-- TradeOS Costbook Schema
-- Optimized for PostgreSQL / Supabase
-- Version: 1.0.0

-- Enable extensions
CREATE EXTENSION IF NOT EXISTS "pg_trgm";
CREATE EXTENSION IF NOT EXISTS "uuid-ossp";

-- ─────────────────────────────────────────────────────────────
-- TABLES
-- ─────────────────────────────────────────────────────────────

-- 1. Cost Items
CREATE TABLE IF NOT EXISTS public.cost_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    unit TEXT NOT NULL,
    labor_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    material_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    equipment_cost NUMERIC(12,2) NOT NULL DEFAULT 0.00,
    notes TEXT,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now(),
    
    -- Invariants
    CONSTRAINT labor_non_negative CHECK (labor_cost >= 0),
    CONSTRAINT material_non_negative CHECK (material_cost >= 0),
    CONSTRAINT equipment_non_negative CHECK (equipment_cost >= 0)
);

-- 2. Assemblies
CREATE TABLE IF NOT EXISTS public.assemblies (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    name TEXT NOT NULL,
    category TEXT NOT NULL,
    created_at TIMESTAMPTZ DEFAULT now(),
    updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Assembly Line Items (Join Table)
CREATE TABLE IF NOT EXISTS public.assembly_line_items (
    id UUID PRIMARY KEY DEFAULT uuid_generate_v4(),
    assembly_id UUID NOT NULL REFERENCES public.assemblies(id) ON DELETE CASCADE,
    cost_item_id UUID NOT NULL REFERENCES public.cost_items(id) ON DELETE CASCADE,
    quantity NUMERIC(12,4) NOT NULL DEFAULT 1.0000,
    created_at TIMESTAMPTZ DEFAULT now(),
    
    CONSTRAINT quantity_positive CHECK (quantity > 0)
);

-- ─────────────────────────────────────────────────────────────
-- INDEXES (postgresql-optimization)
-- ─────────────────────────────────────────────────────────────

-- Trigram index for ultra-fast fuzzy name search
CREATE INDEX IF NOT EXISTS idx_cost_items_name_trgm ON public.cost_items USING gin (name gin_trgm_ops);

-- B-tree indexes for exact lookups and filters
CREATE INDEX IF NOT EXISTS idx_cost_items_category ON public.cost_items (category);
CREATE INDEX IF NOT EXISTS idx_assemblies_category ON public.assemblies (category);

-- Foreign key indexes
CREATE INDEX IF NOT EXISTS idx_ali_assembly_id ON public.assembly_line_items (assembly_id);
CREATE INDEX IF NOT EXISTS idx_ali_cost_item_id ON public.assembly_line_items (cost_item_id);

-- ─────────────────────────────────────────────────────────────
-- TRIGGERS (Auto-updated_at)
-- ─────────────────────────────────────────────────────────────

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
    NEW.updated_at = now();
    RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_cost_items_updated_at BEFORE UPDATE ON public.cost_items FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
CREATE TRIGGER update_assemblies_updated_at BEFORE UPDATE ON public.assemblies FOR EACH ROW EXECUTE PROCEDURE update_updated_at_column();
