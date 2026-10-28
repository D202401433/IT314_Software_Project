-- =====================================================================
-- DRCH - Migration 04: PostGIS Dynamic Spatial Boundaries Architecture
--
-- Enables commercial spatial boundary resolution:
--   1. administrative_boundaries table (Stores State & District geometries)
--   2. PostGIS spatial indexes (GiST) on boundary_geom and centroid_geom
--   3. Spatial helper function: get_district_for_coords(lat, lon) -> VARCHAR
--   4. Spatial helper function: is_coords_in_state(lat, lon, state) -> BOOLEAN
--   5. boundary_sync_state table for automated monthly ETag & Last-Modified GIS sync
-- =====================================================================

BEGIN;

-- 1. Administrative Boundaries Table
CREATE TABLE IF NOT EXISTS administrative_boundaries (
    boundary_id     SERIAL PRIMARY KEY,
    level           VARCHAR(20) NOT NULL, -- 'STATE', 'DISTRICT'
    state_name      VARCHAR(100) NOT NULL DEFAULT 'Gujarat',
    district_name   VARCHAR(100),         -- NULL for state level
    boundary_geom   GEOMETRY(Geometry, 4326) NOT NULL,
    centroid_geom   GEOMETRY(Point, 4326) NOT NULL,
    metadata        JSONB DEFAULT '{}'::jsonb,
    created_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    updated_at      TIMESTAMPTZ NOT NULL DEFAULT now(),
    CONSTRAINT uq_admin_boundaries UNIQUE (level, state_name, district_name)
);

CREATE INDEX IF NOT EXISTS idx_admin_boundaries_geom 
    ON administrative_boundaries USING GIST (boundary_geom);

CREATE INDEX IF NOT EXISTS idx_admin_boundaries_centroid 
    ON administrative_boundaries USING GIST (centroid_geom);

CREATE INDEX IF NOT EXISTS idx_admin_boundaries_lookup 
    ON administrative_boundaries(level, state_name, district_name);

-- 2. Fast PostGIS spatial function to resolve coordinate to district
CREATE OR REPLACE FUNCTION get_district_for_coords(p_lat DOUBLE PRECISION, p_lon DOUBLE PRECISION)
RETURNS VARCHAR AS $$
DECLARE
    v_district VARCHAR;
    v_point GEOMETRY;
BEGIN
    v_point := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);

    -- Exact polygon containment lookup (sub-millisecond GiST spatial index)
    SELECT district_name INTO v_district
    FROM administrative_boundaries
    WHERE level = 'DISTRICT'
      AND ST_Contains(boundary_geom, v_point)
    LIMIT 1;

    -- If point is on boundary or slightly coastal/offshore, use KNN nearest neighbor
    IF v_district IS NULL THEN
        SELECT district_name INTO v_district
        FROM administrative_boundaries
        WHERE level = 'DISTRICT'
          AND ST_DWithin(centroid_geom, v_point, 1.5)
        ORDER BY boundary_geom <-> v_point
        LIMIT 1;
    END IF;

    RETURN v_district;
END;
$$ LANGUAGE plpgsql STABLE;

-- 3. Fast PostGIS spatial function to check if coordinate is within state bounds
CREATE OR REPLACE FUNCTION is_coords_in_state(p_lat DOUBLE PRECISION, p_lon DOUBLE PRECISION, p_state VARCHAR DEFAULT 'Gujarat')
RETURNS BOOLEAN AS $$
DECLARE
    v_inside BOOLEAN;
    v_point GEOMETRY;
BEGIN
    v_point := ST_SetSRID(ST_MakePoint(p_lon, p_lat), 4326);

    SELECT ST_Contains(boundary_geom, v_point) INTO v_inside
    FROM administrative_boundaries
    WHERE level = 'STATE'
      AND state_name = p_state
    LIMIT 1;

    RETURN COALESCE(v_inside, FALSE);
END;
$$ LANGUAGE plpgsql STABLE;

-- 4. Boundary Synchronization State table for monthly automated GIS sync
CREATE TABLE IF NOT EXISTS boundary_sync_state (
    source_key       VARCHAR(100) PRIMARY KEY,
    source_url       TEXT NOT NULL,
    etag             VARCHAR(255),
    last_modified    VARCHAR(255),
    last_checked_at  TIMESTAMPTZ NOT NULL DEFAULT now(),
    last_synced_at   TIMESTAMPTZ,
    feature_count    INT NOT NULL DEFAULT 0,
    status           VARCHAR(50) NOT NULL DEFAULT 'INITIALIZED',
    metadata         JSONB DEFAULT '{}'::jsonb
);

CREATE INDEX IF NOT EXISTS idx_boundary_sync_state_checked 
    ON boundary_sync_state(last_checked_at);

COMMIT;
