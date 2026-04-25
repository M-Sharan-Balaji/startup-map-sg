"use client";

import { useCallback, useEffect, useMemo, useState } from "react";
import Map, {
  Layer,
  type MapLayerMouseEvent,
  NavigationControl,
  Source,
} from "react-map-gl/maplibre";
import type { GeoJSONSource, Map as MapLibreMap } from "maplibre-gl";
import "maplibre-gl/dist/maplibre-gl.css";

import { useTheme } from "@/components/theme-provider";
import {
  absoluteLogoUrlForClient,
  mapIconIdForStartupId,
  resolveLogoUrl,
} from "@/lib/logo";
import type { Startup } from "@/lib/startup";

const MAP_STYLE_LIGHT =
  process.env.NEXT_PUBLIC_MAP_STYLE ||
  "https://basemaps.cartocdn.com/gl/positron-gl-style/style.json";
const MAP_STYLE_DARK = "https://basemaps.cartocdn.com/gl/dark-matter-gl-style/style.json";

const SOURCE_ID = "sg-startups";
const L_CLUSTER = "sg-clusters";
const L_COUNT = "sg-cluster-count";
const L_UNCLUSTERED_HALO = "sg-unclustered-halo";
const L_UNCLUSTERED = "sg-unclustered";

/** MapLibre uses 128px-width images; `icon-size` is scale vs that width. */
const SOURCE_LOGO_PX = 128;

/**
 * White halo radius (px). A square icon’s diagonal must stay inside this circle:
 * max side = R * √2 (corners on the circle). We inset slightly so the logo is never clipped by the disc edge.
 */
const UNCLUSTERED_HALO_RADIUS_PX = 20;
/** Keep the square’s corners ~10% inside the visible circle. */
const LOGO_IN_CIRCLE = 0.9;
const UNCLUSTERED_LOGO_SIZE =
  ((UNCLUSTERED_HALO_RADIUS_PX * Math.SQRT2 * LOGO_IN_CIRCLE) / SOURCE_LOGO_PX) *
  0.98; // 0.98: account for subpixel / stroke so corners never read past the ring

function toGeoJson(startups: Startup[]): GeoJSON.FeatureCollection {
  return {
    type: "FeatureCollection",
    features: startups.map((s) => ({
      type: "Feature" as const,
      id: s.id,
      properties: {
        id: s.id,
        name: s.name,
        website: s.website,
        stage: s.stage,
        description: s.description,
        sectors: s.sectors.join("|"),
        hiring: s.hiring ? "1" : "0",
        linkedin: s.linkedinUrl || "",
        iconId: mapIconIdForStartupId(s.id),
      },
      geometry: { type: "Point" as const, coordinates: [s.lng, s.lat] },
    })),
  };
}

function letterFallbackCanvas(name: string): HTMLCanvasElement {
  const c = document.createElement("canvas");
  const size = 128;
  c.width = size;
  c.height = size;
  const ctx = c.getContext("2d");
  if (ctx) {
    const r = size / 2;
    ctx.beginPath();
    ctx.arc(r, r, r - 2, 0, Math.PI * 2);
    ctx.fillStyle = "#e0f2fe";
    ctx.fill();
    ctx.strokeStyle = "#0c8ce9";
    ctx.lineWidth = 4;
    ctx.stroke();
    ctx.fillStyle = "#0f172a";
    ctx.font = "bold 56px system-ui, sans-serif";
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    const letter = (name.trim().charAt(0) || "?").toUpperCase();
    ctx.fillText(letter, r, r + 2);
  }
  return c;
}

function addLetterFallback(
  map: MapLibreMap,
  iconId: string,
  name: string,
): void {
  if (map.hasImage(iconId)) return;
  const canvas = letterFallbackCanvas(name);
  const ctx = canvas.getContext("2d");
  if (!ctx) return;
  try {
    const imageData = ctx.getImageData(0, 0, canvas.width, canvas.height);
    map.addImage(iconId, imageData, { pixelRatio: 1 });
  } catch {
    // if addImage still fails, leave marker empty until re-style
  }
}

function loadLogosOnMap(map: MapLibreMap, startups: Startup[]): void {
  for (const s of startups) {
    const iconId = mapIconIdForStartupId(s.id);
    if (map.hasImage(iconId)) {
      continue;
    }
    const url = absoluteLogoUrlForClient(resolveLogoUrl(s));
    void map
      .loadImage(url)
      .then((res) => {
        if (!map.hasImage(iconId)) {
          try {
            map.addImage(iconId, res.data, { pixelRatio: 1 });
          } catch {
            addLetterFallback(map, iconId, s.name);
          }
        }
      })
      .catch(() => {
        addLetterFallback(map, iconId, s.name);
      });
  }
}

type Props = {
  startups: Startup[];
  onSelect: (s: Startup | null) => void;
};

export function StartupMap({ startups, onSelect }: Props) {
  const { theme } = useTheme();
  const data = useMemo(() => toGeoJson(startups), [startups]);
  const [cursor, setCursor] = useState<string>("grab");
  const [map, setMap] = useState<MapLibreMap | null>(null);
  const mapStyle = theme === "dark" ? MAP_STYLE_DARK : MAP_STYLE_LIGHT;
  const clusterTextColor = theme === "dark" ? "#f4f4f5" : "#0a0a0a";

  const onMapLoad = useCallback((e: { target: MapLibreMap }) => {
    setMap(e.target);
  }, []);

  useEffect(() => {
    if (!map || startups.length === 0) {
      return;
    }
    loadLogosOnMap(map, startups);
  }, [map, startups]);

  const onClick = useCallback(
    async (e: MapLayerMouseEvent) => {
      const m = e.target as MapLibreMap;
      const feats = e.features;
      if (!feats || feats.length === 0) {
        onSelect(null);
        return;
      }
      const f = feats[0];
      const layerId = f.layer.id;
      const p = f.properties as Record<string, unknown>;

      if (layerId === L_CLUSTER) {
        const clusterId = p?.cluster_id;
        if (typeof clusterId !== "number") return;
        const src = m.getSource(SOURCE_ID) as GeoJSONSource | null;
        if (!src) return;
        try {
          const z = await src.getClusterExpansionZoom(clusterId);
          if (f.geometry && f.geometry.type === "Point") {
            const coords = f.geometry.coordinates as [number, number];
            m.easeTo({ center: coords, zoom: z });
          }
        } catch {
          // ignore expansion errors
        }
        return;
      }

      if (layerId === L_UNCLUSTERED || layerId === L_UNCLUSTERED_HALO) {
        const id = p?.id;
        if (typeof id === "string") {
          const full = startups.find((st) => st.id === id);
          if (full) onSelect(full);
        }
      }
    },
    [onSelect, startups],
  );

  const onMouseMove = useCallback((e: MapLayerMouseEvent) => {
    const m = e.target as MapLibreMap;
    const feats = m.queryRenderedFeatures(e.point, {
      layers: [L_CLUSTER, L_UNCLUSTERED_HALO, L_UNCLUSTERED],
    });
    setCursor(feats.length > 0 ? "pointer" : "grab");
  }, []);

  return (
    <Map
      mapStyle={mapStyle}
      initialViewState={{
        longitude: 103.86,
        latitude: 1.32,
        zoom: 10.4,
      }}
      style={{ width: "100%", height: "100%" }}
      interactiveLayerIds={[L_CLUSTER, L_UNCLUSTERED_HALO, L_UNCLUSTERED]}
      onLoad={onMapLoad}
      onClick={onClick}
      onMouseMove={onMouseMove}
      cursor={cursor}
    >
      <NavigationControl position="top-left" showCompass={false} />
      <Source
        id={SOURCE_ID}
        type="geojson"
        data={data}
        cluster
        clusterMaxZoom={15}
        clusterRadius={50}
      >
        <Layer
          id={L_CLUSTER}
          type="circle"
          filter={["has", "point_count"]}
          paint={{
            "circle-color": [
              "step",
              ["get", "point_count"],
              "#0c8ce9",
              8,
              "#8b5cf6",
              16,
              "#f59e0b",
            ],
            "circle-radius": [
              "step",
              ["get", "point_count"],
              18,
              8,
              24,
              16,
              32,
            ],
            "circle-stroke-color": "rgba(255,255,255,0.45)",
            "circle-stroke-width": 2,
          }}
        />
        <Layer
          id={L_COUNT}
          type="symbol"
          filter={["has", "point_count"]}
          layout={{
            "text-field": "{point_count_abbreviated}",
            "text-size": 12,
          }}
          paint={{ "text-color": clusterTextColor }}
        />
        <Layer
          id={L_UNCLUSTERED_HALO}
          type="circle"
          filter={["!", ["has", "point_count"]]}
          paint={{
            "circle-color": "#ffffff",
            "circle-radius": UNCLUSTERED_HALO_RADIUS_PX,
            "circle-stroke-color": "rgba(15, 23, 42, 0.2)",
            "circle-stroke-width": 1.5,
          }}
        />
        <Layer
          id={L_UNCLUSTERED}
          type="symbol"
          filter={["!", ["has", "point_count"]]}
          layout={{
            "icon-image": ["get", "iconId"],
            "icon-size": UNCLUSTERED_LOGO_SIZE,
            "icon-allow-overlap": true,
            "icon-ignore-placement": true,
          }}
        />
      </Source>
    </Map>
  );
}
