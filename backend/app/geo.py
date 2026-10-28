"""Geospatial utilities and dynamic administrative boundary resolution.

Commercial PostGIS Spatial Architecture:
1. Primary: Sub-millisecond PostGIS spatial queries (ST_Contains, ST_DWithin, <-> KNN)
   against the `administrative_boundaries` spatial tables.
2. Dynamic Fallback: Google Maps / OpenStreetMap Nominatim reverse geocoding
   with automatic PostGIS spatial caching (zero local coordinates hardcoded in code).
3. State & Jurisdiction Validation: Resolved dynamically via PostGIS polygons
   or authoritative reverse-geocoded state hierarchy.
"""

from __future__ import annotations

import json
import logging
from typing import Any

import httpx

from app.config import get_settings

logger = logging.getLogger("drch.geo")


def resolve_district_online(latitude: float, longitude: float) -> tuple[str | None, str | None]:
    """Dynamically resolve administrative district and state from Google Maps or OpenStreetMap.
    
    1. If GOOGLE_MAPS_API_KEY is configured: queries Google Maps Geocoding API.
    2. Fallback: queries OpenStreetMap Nominatim reverse geocoding API (free, open source).
    """
    settings = get_settings()

    # 1. Google Maps Geocoding API if key configured
    if settings.google_maps_api_key:
        try:
            resp = httpx.get(
                "https://maps.googleapis.com/maps/api/geocode/json",
                params={"latlng": f"{latitude},{longitude}", "key": settings.google_maps_api_key},
                headers={"User-Agent": "ResQ-DisasterResponse/1.0"},
                timeout=5,
            )
            resp.raise_for_status()
            data = resp.json()
            for result in data.get("results", []):
                district = None
                state = None
                for comp in result.get("address_components", []):
                    types = comp.get("types", [])
                    if "administrative_area_level_2" in types:
                        district = comp.get("long_name")
                    elif "administrative_area_level_1" in types:
                        state = comp.get("long_name")
                if district:
                    return district.strip(), state or "Gujarat"
        except (httpx.HTTPError, TimeoutError, OSError, json.JSONDecodeError, KeyError) as exc:
            logger.warning("Google Maps Geocoding request failed: %s", exc)

    # 2. OpenStreetMap Nominatim (Free, authoritative reverse geocoding)
    try:
        resp = httpx.get(
            "https://nominatim.openstreetmap.org/reverse",
            params={"lat": latitude, "lon": longitude, "format": "json"},
            headers={"User-Agent": "ResQ-DisasterResponse/1.0 (Emergency Response Center)"},
            timeout=5,
        )
        resp.raise_for_status()
        data = resp.json()
        addr = data.get("address", {})
        district = addr.get("state_district") or addr.get("county") or addr.get("city")
        state = addr.get("state")
        if district:
            clean_district = district.replace(" District", "").strip()
            return clean_district, state or "Gujarat"
    except (httpx.HTTPError, TimeoutError, OSError, json.JSONDecodeError, KeyError) as exc:
        logger.debug("OpenStreetMap Nominatim reverse geocoding failed: %s", exc)

    return None, None


def _cache_district_in_postgis(
    conn: Any, district: str, state: str, latitude: float, longitude: float
) -> None:
    """Dynamically cache an online-resolved coordinate into PostGIS administrative_boundaries."""
    try:
        cache_sql = """
            INSERT INTO administrative_boundaries (
                level, state_name, district_name, boundary_geom, centroid_geom, metadata, updated_at
            )
            VALUES (
                'DISTRICT',
                %(state)s,
                %(district)s,
                ST_Buffer(ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326)::geography, 15000)::geometry,
                ST_SetSRID(ST_MakePoint(%(lon)s, %(lat)s), 4326),
                jsonb_build_object('source', 'dynamic_geocoding', 'cached_at', now()),
                now()
            )
            ON CONFLICT (level, state_name, district_name) DO UPDATE SET
                boundary_geom = ST_Union(administrative_boundaries.boundary_geom, EXCLUDED.boundary_geom),
                updated_at = now();
        """
        conn.execute(
            cache_sql,
            {
                "state": state,
                "district": district,
                "lat": latitude,
                "lon": longitude,
            },
        )
        if hasattr(conn, "commit"):
            conn.commit()
    except Exception as exc:  # noqa: BLE001
        logger.debug("Failed to cache dynamic district in PostGIS: %s", exc)


def _query_postgis_district(conn: Any, latitude: float, longitude: float) -> str | None:
    """Execute PostGIS spatial function get_district_for_coords(lat, lon)."""
    try:
        row = conn.execute(
            "SELECT get_district_for_coords(%s, %s) AS district",
            (latitude, longitude),
        ).fetchone()
        if row:
            val = row["district"] if isinstance(row, dict) else row[0]
            if val:
                return str(val)
    except Exception as exc:  # noqa: BLE001
        logger.debug("Query district failed: %s", exc)
    return None


def _query_postgis_in_state(
    conn: Any, latitude: float, longitude: float, state: str = "Gujarat"
) -> bool | None:
    """Execute PostGIS spatial function is_coords_in_state(lat, lon, state)."""
    try:
        row = conn.execute(
            "SELECT is_coords_in_state(%s, %s, %s) AS inside",
            (latitude, longitude, state),
        ).fetchone()
        if row:
            val = row["inside"] if isinstance(row, dict) else row[0]
            if val is not None:
                return bool(val)
    except Exception as exc:  # noqa: BLE001
        logger.debug("Query in state failed: %s", exc)
    return None


def is_in_state(
    latitude: float, longitude: float, state: str = "Gujarat", conn: Any = None
) -> bool:
    """Check if coordinates fall within state boundaries via PostGIS or dynamic geocoder."""
    if conn is not None:
        db_result = _query_postgis_in_state(conn, latitude, longitude, state=state)
        if db_result is True:
            return True

    # Dynamic fallback via live geocoder
    _, online_state = resolve_district_online(latitude, longitude)
    if online_state:
        return online_state.strip().lower() == state.strip().lower()

    return False


def is_in_gujarat(latitude: float, longitude: float, conn: Any = None) -> bool:
    """Check if coordinate falls within Gujarat state boundaries."""
    return is_in_state(latitude, longitude, state="Gujarat", conn=conn)


def district_for(
    latitude: float,
    longitude: float,
    conn: Any = None,
    state_filter: str | None = "Gujarat",
) -> str | None:
    """Find administrative district dynamically for given coordinates.
    
    1. Local PostGIS: Executes spatial query get_district_for_coords(lat, lon).
    2. Dynamic Live Lookup: Google Maps / OSM Nominatim API with automatic PostGIS caching.
    
    If state_filter is specified (default 'Gujarat'), coordinates outside state return None.
    Set state_filter=None for nationwide/global resolution.
    """
    if conn is not None:
        db_district = _query_postgis_district(conn, latitude, longitude)
        if db_district:
            return db_district

    # Dynamic live lookup via Google / OSM
    online_district, online_state = resolve_district_online(latitude, longitude)
    if online_district:
        if state_filter and online_state and online_state.lower() != state_filter.lower():
            return None
        if conn is not None:
            _cache_district_in_postgis(
                conn, online_district, online_state or "Gujarat", latitude, longitude
            )
        return online_district

    return None


def get_known_districts(conn: Any = None, state: str = "Gujarat") -> list[str]:
    """Retrieve all dynamically registered districts from PostGIS."""
    if conn is not None:
        try:
            rows = conn.execute(
                "SELECT DISTINCT district_name FROM administrative_boundaries "
                "WHERE level = 'DISTRICT' AND state_name = %s AND district_name IS NOT NULL "
                "ORDER BY district_name",
                (state,),
            ).fetchall()
            return [r["district_name"] if isinstance(r, dict) else r[0] for r in rows]
        except Exception as exc:  # noqa: BLE001
            logger.debug("Failed to query known districts: %s", exc)
    return []
