import { ChangeEvent, CSSProperties, useEffect, useMemo, useRef, useState } from "react";
import {
  ArrowSquareOut,
  Check,
  Copy,
  DownloadSimple,
  FileCsv,
  FileText,
  ImageSquare,
  MagnifyingGlass,
  MapPin,
  Path,
  PencilSimple,
  Plus,
  Question,
  Sparkle,
  Trash,
  UploadSimple,
  X,
} from "@phosphor-icons/react";
import {
  MapContainer,
  Marker,
  Popup,
  TileLayer,
  useMap,
  useMapEvents,
} from "react-leaflet";
import { divIcon, LatLngBounds } from "leaflet";
import type { LatLngExpression, Marker as LeafletMarker } from "leaflet";

type CoordinateSource =
  | "manual_coordinates"
  | "places_api"
  | "geocoding_api"
  | "manual";
type Confidence = "high" | "medium" | "low";

type Candidate = {
  name: string;
  address: string;
  latitude: number;
  longitude: number;
  placeId?: string;
};

type Spot = {
  id: string;
  number: number;
  name: string;
  latitude: number | null;
  longitude: number | null;
  description: string;
  photos: string[];
  source: CoordinateSource;
  confidence: Confidence;
  candidates: Candidate[];
  confirmed: boolean;
};

const STORAGE_KEY = "photo-place-collection-v5";
const NOTE_KEY = "photo-place-note-v3";
const CITY_KEY = "photo-place-city-v1";
const GEOCODE_CACHE_KEY = "photo-place-geocode-cache-v1";
const DEFAULT_SPOTS_URL = `${import.meta.env.BASE_URL}data/london-photo-spots.json`;
const VERIFIED_COORDINATES: Record<string, [number, number]> = {
  "Bridge Arch Photo Spot": [51.5006156, -0.1199038],
  "Westminster Bridge / London Eye": [51.5017547, -0.1238601],
  "K2 Telephone Box Parliament Square": [51.5012133, -0.1272963],
  "Westminster Bridge Big Ben": [51.50075, -0.1218333],
  "The Queen’s Walk": [51.50245, -0.11945],
  "London Bridge / The Shard": [51.50733, -0.08747],
  "Westminster Station": [51.501236, -0.12484],
  "Potters Fields Park": [51.50458, -0.07862],
  "Victoria Tower Gardens": [51.49695, -0.12542],
  "One New Change": [51.51358, -0.09527],
  "Natural History Museum": [51.496715, -0.176367],
};

const sampleSpots: Spot[] = [
  {
    id: "bridge-arch-photo-spot",
    number: 1,
    name: "Bridge Arch Photo Spot",
    latitude: 51.5006156,
    longitude: -0.1199038,
    description: "桥下拱门机位，可以框住大本钟。",
    photos: [],
    source: "manual_coordinates",
    confidence: "low",
    candidates: [],
    confirmed: true,
  },
  {
    id: "westminster-bridge-london-eye",
    number: 2,
    name: "Westminster Bridge / London Eye",
    latitude: 51.5017547,
    longitude: -0.1238601,
    description: "桥头位置，可以拍完整伦敦眼。",
    photos: [],
    source: "manual_coordinates",
    confidence: "medium",
    candidates: [],
    confirmed: true,
  },
  {
    id: "k2-telephone-box",
    number: 3,
    name: "K2 Telephone Box Parliament Square",
    latitude: 51.5012133,
    longitude: -0.1272963,
    description: "红色电话亭和 Big Ben 同框机位。",
    photos: [],
    source: "manual_coordinates",
    confidence: "low",
    candidates: [],
    confirmed: true,
  },
  {
    id: "westminster-bridge-big-ben",
    number: 4,
    name: "Westminster Bridge Big Ben",
    latitude: 51.50075,
    longitude: -0.1218333,
    description: "桥面栏杆做前景，适合拍大本钟。",
    photos: [],
    source: "manual_coordinates",
    confidence: "medium",
    candidates: [],
    confirmed: true,
  },
  {
    id: "queens-walk",
    number: 5,
    name: "The Queen’s Walk",
    latitude: 51.50245,
    longitude: -0.11945,
    description: "伦敦眼东侧河边步道，适合拍长椅前景。",
    photos: [],
    source: "manual_coordinates",
    confidence: "medium",
    candidates: [],
    confirmed: true,
  },
  {
    id: "london-bridge-the-shard",
    number: 6,
    name: "London Bridge / The Shard",
    latitude: 51.50733,
    longitude: -0.08747,
    description: "桥面上拍 The Shard 和蓝调人像。",
    photos: [],
    source: "manual_coordinates",
    confidence: "medium",
    candidates: [],
    confirmed: true,
  },
  {
    id: "westminster-station",
    number: 7,
    name: "Westminster Station",
    latitude: 51.501236,
    longitude: -0.12484,
    description: "地铁站牌和 London Eye 可以同框。",
    photos: [],
    source: "manual_coordinates",
    confidence: "high",
    candidates: [],
    confirmed: true,
  },
  {
    id: "potters-fields-park",
    number: 8,
    name: "Potters Fields Park",
    latitude: 51.50458,
    longitude: -0.07862,
    description: "塔桥南岸草坪，适合拍完整 Tower Bridge。",
    photos: [],
    source: "manual_coordinates",
    confidence: "medium",
    candidates: [],
    confirmed: true,
  },
  {
    id: "victoria-tower-gardens",
    number: 9,
    name: "Victoria Tower Gardens",
    latitude: 51.49695,
    longitude: -0.12542,
    description: "议会大厦旁的公园草坪机位。",
    photos: [],
    source: "manual_coordinates",
    confidence: "medium",
    candidates: [],
    confirmed: true,
  },
  {
    id: "one-new-change",
    number: 10,
    name: "One New Change",
    latitude: 51.51358,
    longitude: -0.09527,
    description: "玻璃通道正对圣保罗大教堂。",
    photos: [],
    source: "manual_coordinates",
    confidence: "high",
    candidates: [],
    confirmed: true,
  },
  {
    id: "natural-history-museum",
    number: 11,
    name: "Natural History Museum",
    latitude: 51.496715,
    longitude: -0.176367,
    description: "中央大厅二层，可以拍蓝鲸骨架。",
    photos: [],
    source: "manual_coordinates",
    confidence: "high",
    candidates: [],
    confirmed: true,
  },
];

const sampleNote = `1️⃣ Bridge Arch Photo Spot
坐标：51.5008, -0.1217
桥下拱门机位，可以框住大本钟。

2️⃣ Westminster Bridge / London Eye
桥头位置，可以拍完整伦敦眼。

3. Natural History Museum Hintze Hall
中央大厅二层走廊，可以拍蓝鲸骨架和古典建筑空间感。

4. Potters Fields Park / Tower Bridge
塔桥南岸草坪，可以用树叶做前景拍完整 Tower Bridge。`;

const coordinatePattern =
  /(?:GPS\s*)?坐标\s*[：:]\s*([+-]?\d{1,2}(?:\.\d+)?)\s*[,，]\s*([+-]?\d{1,3}(?:\.\d+)?)/i;
const numberedTitlePattern =
  /^\s*(?:(\d+)\s*[.、．)]|([0-9️⃣🔟]+)|📍)\s*(.+?)\s*$/u;
const bulletPattern = /^\s*[-*•]\s+(.+?)\s*$/;
const vaguePattern =
  /(viewpoint|photo\s*spot|bench|telephone\s*box|phone\s*box|arch|stairs?|corner|机位|长椅|电话亭|桥洞|楼梯|转角)/i;
const mediumPattern =
  /(bridge|road|street|walk|park|garden|square|district|area|桥|街|路|公园|花园|广场|区域)/i;

function confidenceForName(name: string): Confidence {
  if (vaguePattern.test(name)) return "low";
  if (mediumPattern.test(name)) return "medium";
  return "high";
}

function emptySpot(name: string, description = ""): Spot {
  return {
    id: newId(),
    number: 0,
    name,
    latitude: null,
    longitude: null,
    description,
    photos: [],
    source: "manual",
    confidence: confidenceForName(name),
    candidates: [],
    confirmed: false,
  };
}

function newId() {
  return globalThis.crypto?.randomUUID?.() ?? `${Date.now()}-${Math.random()}`;
}

function normalizeSpots(input: Spot[]) {
  return input.map((spot, index) => ({
    ...spot,
    id: spot.id || newId(),
    number: index + 1,
    latitude:
      spot.latitude !== null && spot.latitude !== undefined && Number.isFinite(Number(spot.latitude))
        ? Number(spot.latitude)
        : null,
    longitude:
      spot.longitude !== null && spot.longitude !== undefined && Number.isFinite(Number(spot.longitude))
        ? Number(spot.longitude)
        : null,
    photos: Array.isArray(spot.photos) ? spot.photos : [],
    source: spot.source || (spot.latitude !== null ? "manual_coordinates" : "manual"),
    confidence: spot.confidence || confidenceForName(spot.name),
    candidates: Array.isArray(spot.candidates) ? spot.candidates : [],
    confirmed: Boolean(spot.confirmed),
    ...(VERIFIED_COORDINATES[spot.name]
      ? {
          latitude: VERIFIED_COORDINATES[spot.name][0],
          longitude: VERIFIED_COORDINATES[spot.name][1],
          source: "manual_coordinates" as CoordinateSource,
          confirmed: true,
        }
      : {}),
  }));
}

function isLocated(spot: Spot) {
  return spot.latitude !== null && spot.longitude !== null;
}

function photoUrl(photo: string) {
  if (/^(?:data:|https?:|blob:)/i.test(photo)) return photo;
  return `${import.meta.env.BASE_URL}${photo.replace(/^\/+/, "")}`;
}

function parseNote(text: string): Spot[] {
  const lines = text.replace(/\r\n/g, "\n").split("\n");
  const titleIndexes: number[] = [];
  lines.forEach((line, index) => {
    if (numberedTitlePattern.test(line.trim()) || bulletPattern.test(line.trim())) {
      titleIndexes.push(index);
    }
  });

  if (!titleIndexes.length) {
    const coordinateSpots: Spot[] = [];
    lines.forEach((line, index) => {
      const match = line.match(coordinatePattern);
      if (!match) return;
      let titleIndex = index - 1;
      while (titleIndex >= 0 && !lines[titleIndex].trim()) titleIndex -= 1;
      const spot = emptySpot(
        lines[titleIndex]?.trim() || `点位 ${coordinateSpots.length + 1}`,
        lines[index + 1]?.trim() || "",
      );
      coordinateSpots.push({
        ...spot,
        number: coordinateSpots.length + 1,
        latitude: Number(match[1]),
        longitude: Number(match[2]),
        source: "manual_coordinates",
        confirmed: true,
      });
    });
    if (coordinateSpots.length) return coordinateSpots;

    const simpleNames = lines
      .map((line) => line.trim())
      .filter(
        (line) =>
          line.length >= 2 &&
          line.length <= 90 &&
          !/^#/.test(line) &&
          !/[。！？!?]$/.test(line),
      );
    return simpleNames.map((name, index) => ({
      ...emptySpot(name),
      number: index + 1,
    }));
  }

  return titleIndexes.map((titleIndex, position) => {
    const endIndex = titleIndexes[position + 1] ?? lines.length;
    const block = lines.slice(titleIndex, endIndex);
    const titleMatch = block[0].trim().match(numberedTitlePattern);
    const bulletMatch = block[0].trim().match(bulletPattern);
    const name = titleMatch?.[3]?.trim() || bulletMatch?.[1]?.trim() || `地点 ${position + 1}`;
    const coordinateLine = block.find((line) => coordinatePattern.test(line));
    const coordinateMatch = coordinateLine?.match(coordinatePattern);
    const description = block
      .slice(1)
      .map((line) => line.trim())
      .filter((line) => line && !coordinatePattern.test(line) && !/^#/.test(line))
      .join("\n");

    return {
      ...emptySpot(name, description),
      number: position + 1,
      latitude: coordinateMatch ? Number(coordinateMatch[1]) : null,
      longitude: coordinateMatch ? Number(coordinateMatch[2]) : null,
      source: coordinateMatch ? "manual_coordinates" : "manual",
      confirmed: Boolean(coordinateMatch),
    };
  });
}

function formatCoordinate(value: number | null) {
  return value === null ? "待定位" : value.toFixed(7);
}

function mapLink(spot: Spot) {
  if (!isLocated(spot)) return "";
  return `https://www.google.com/maps/search/?api=1&query=${spot.latitude},${spot.longitude}`;
}

function routeLink(spots: Spot[]) {
  const located = spots.filter(isLocated);
  if (!located.length) return "";
  if (located.length === 1) return mapLink(located[0]);
  const first = located[0];
  const last = located[located.length - 1];
  const params = new URLSearchParams({
    api: "1",
    origin: `${first.latitude},${first.longitude}`,
    destination: `${last.latitude},${last.longitude}`,
    travelmode: "walking",
  });
  if (located.length > 2) {
    params.set(
      "waypoints",
      located.slice(1, -1).map((spot) => `${spot.latitude},${spot.longitude}`).join("|"),
    );
  }
  return `https://www.google.com/maps/dir/?${params.toString()}`;
}

function csvEscape(value: string | number) {
  const text = String(value);
  return /[",\n\r]/.test(text) ? `"${text.replace(/"/g, '""')}"` : text;
}

function xmlEscape(value: string) {
  return value.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");
}

function downloadFile(filename: string, content: string, type: string) {
  const blob = new Blob(["\ufeff", content], { type });
  const url = URL.createObjectURL(blob);
  const anchor = document.createElement("a");
  anchor.href = url;
  anchor.download = filename;
  anchor.click();
  URL.revokeObjectURL(url);
}

function csvContent(spots: Spot[]) {
  const rows = spots.filter(isLocated).map((spot) => [
    spot.number,
    spot.name,
    spot.latitude!.toFixed(7),
    spot.longitude!.toFixed(7),
    spot.description,
    spot.source,
    spot.confidence,
    spot.confirmed,
  ]);
  return [[
    "Number",
    "Name",
    "Latitude",
    "Longitude",
    "Description",
    "Source",
    "Confidence",
    "Confirmed",
  ], ...rows]
    .map((row) => row.map(csvEscape).join(","))
    .join("\r\n");
}

function kmlContent(spots: Spot[]) {
  const placemarks = spots
    .filter(isLocated)
    .map(
      (spot) => `    <Placemark>
      <name>${xmlEscape(`${spot.number}. ${spot.name}`)}</name>
      <description>${xmlEscape(`坐标：${spot.latitude}, ${spot.longitude}\n${spot.description}\n来源：${spot.source}\n可信度：${spot.confidence}`)}</description>
      <Point><coordinates>${spot.longitude!.toFixed(7)},${spot.latitude!.toFixed(7)},0</coordinates></Point>
    </Placemark>`,
    )
    .join("\n");
  return `<?xml version="1.0" encoding="UTF-8"?>
<kml xmlns="http://www.opengis.net/kml/2.2"><Document><name>Photo Spots</name>
${placemarks}
</Document></kml>`;
}

async function compressImage(file: File) {
  const source = await new Promise<string>((resolve, reject) => {
    const reader = new FileReader();
    reader.onload = () => resolve(String(reader.result));
    reader.onerror = reject;
    reader.readAsDataURL(file);
  });
  const image = await new Promise<HTMLImageElement>((resolve, reject) => {
    const element = new Image();
    element.onload = () => resolve(element);
    element.onerror = reject;
    element.src = source;
  });
  const max = 1200;
  const scale = Math.min(1, max / Math.max(image.width, image.height));
  const canvas = document.createElement("canvas");
  canvas.width = Math.round(image.width * scale);
  canvas.height = Math.round(image.height * scale);
  canvas.getContext("2d")!.drawImage(image, 0, 0, canvas.width, canvas.height);
  return canvas.toDataURL("image/jpeg", 0.76);
}

function MapClickHandler({ onPick }: { onPick: (lat: number, lng: number) => void }) {
  useMapEvents({ click: (event) => onPick(event.latlng.lat, event.latlng.lng) });
  return null;
}

function MapFocus({ spot }: { spot?: Spot }) {
  const map = useMap();
  useEffect(() => {
    if (spot && isLocated(spot)) map.flyTo([spot.latitude!, spot.longitude!], 15);
  }, [map, spot]);
  return null;
}

function FitAllSpots({ spots }: { spots: Spot[] }) {
  const map = useMap();
  const signature = spots.map((spot) => `${spot.latitude},${spot.longitude}`).join("|");
  useEffect(() => {
    if (!spots.length) return;
    if (spots.length === 1) {
      map.setView([spots[0].latitude!, spots[0].longitude!], 14);
      return;
    }
    map.fitBounds(
      new LatLngBounds(spots.map((spot) => [spot.latitude!, spot.longitude!])),
      { padding: [55, 55], maxZoom: 15 },
    );
  }, [map, signature]);
  return null;
}

const markerIcon = (active: boolean, confidence: Confidence) =>
  divIcon({
    className: "custom-marker-shell",
    html: `<span class="custom-marker ${active ? "active" : ""} ${confidence}"></span>`,
    iconSize: [24, 32],
    iconAnchor: [12, 31],
    popupAnchor: [0, -28],
  });

export function App() {
  const hasStoredSpots = useRef(localStorage.getItem(STORAGE_KEY) !== null);
  const [spots, setSpots] = useState<Spot[]>(() => {
    try {
      const saved = localStorage.getItem(STORAGE_KEY);
      return saved ? normalizeSpots(JSON.parse(saved)) : [];
    } catch {
      return [];
    }
  });
  const [initialDataReady, setInitialDataReady] = useState(hasStoredSpots.current);
  const [selectedId, setSelectedId] = useState<string | null>(spots[0]?.id ?? null);
  const [noteText, setNoteText] = useState(() => localStorage.getItem(NOTE_KEY) ?? "");
  const [city, setCity] = useState(() => localStorage.getItem(CITY_KEY) ?? "London");
  const [parserOpen, setParserOpen] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [candidateOpen, setCandidateOpen] = useState(false);
  const [query, setQuery] = useState("");
  const [results, setResults] = useState<Candidate[]>([]);
  const [searching, setSearching] = useState(false);
  const [batchSearching, setBatchSearching] = useState(false);
  const [aiExtracting, setAiExtracting] = useState(false);
  const [toast, setToast] = useState("");
  const [dragActive, setDragActive] = useState(false);
  const fileRef = useRef<HTMLInputElement>(null);
  const jsonRef = useRef<HTMLInputElement>(null);

  const selected = spots.find((spot) => spot.id === selectedId) ?? spots[0];
  const locatedSpots = spots.filter(isLocated);
  const center: LatLngExpression = locatedSpots.length
    ? [
        locatedSpots.reduce((sum, spot) => sum + spot.latitude!, 0) / locatedSpots.length,
        locatedSpots.reduce((sum, spot) => sum + spot.longitude!, 0) / locatedSpots.length,
      ]
    : [51.5074, -0.1278];
  const route = useMemo(() => routeLink(spots), [spots]);

  useEffect(() => {
    if (hasStoredSpots.current) return;

    let cancelled = false;
    fetch(DEFAULT_SPOTS_URL)
      .then((response) => {
        if (!response.ok) throw new Error("默认地图数据加载失败");
        return response.text();
      })
      .then((text) => JSON.parse(text.replace(/^\uFEFF/, "")) as Spot[])
      .then((data) => {
        if (cancelled) return;
        const next = normalizeSpots(data);
        setSpots(next);
        setSelectedId(next[0]?.id ?? null);
      })
      .catch(() => {
        if (cancelled) return;
        const next = normalizeSpots(sampleSpots);
        setSpots(next);
        setSelectedId(next[0]?.id ?? null);
      })
      .finally(() => {
        if (!cancelled) setInitialDataReady(true);
      });

    return () => {
      cancelled = true;
    };
  }, []);

  useEffect(() => {
    if (!initialDataReady) return;
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(spots));
    } catch {
      notify("浏览器存储空间不足，图片仍可浏览，但新修改可能无法保存");
    }
  }, [initialDataReady, spots]);
  useEffect(() => localStorage.setItem(NOTE_KEY, noteText), [noteText]);
  useEffect(() => localStorage.setItem(CITY_KEY, city), [city]);

  function notify(message: string) {
    setToast(message);
    window.setTimeout(() => setToast(""), 2200);
  }

  function updateSpot(id: string, patch: Partial<Spot>) {
    setSpots((current) => current.map((spot) => (spot.id === id ? { ...spot, ...patch } : spot)));
  }

  function deleteSpot(id: string) {
    const next = normalizeSpots(spots.filter((spot) => spot.id !== id));
    setSpots(next);
    setSelectedId(next[0]?.id ?? null);
  }

  function extractNote() {
    if (/^https?:\/\/\S+$/i.test(noteText.trim())) {
      notify("仅有链接时浏览器无法读取小红书正文，请复制笔记文字");
      return;
    }
    const parsed = parseNote(noteText);
    if (!parsed.length) {
      notify("没有识别到地点，请保留序号和地点名称");
      return;
    }
    setSpots(parsed);
    setSelectedId(parsed[0].id);
    setQuery(parsed[0].name);
    setParserOpen(false);
    notify(`识别到 ${parsed.length} 个地点，其中 ${parsed.filter(isLocated).length} 个已有坐标`);
  }

  function cacheKey(name: string) {
    return `${name.trim().toLowerCase()}|${city.trim().toLowerCase()}`;
  }

  function readCache() {
    try {
      return JSON.parse(localStorage.getItem(GEOCODE_CACHE_KEY) || "{}") as Record<
        string,
        { query: string; city: string; candidates: Candidate[]; selected?: Candidate; queriedAt: string }
      >;
    } catch {
      return {};
    }
  }

  function writeCache(
    key: string,
    queryName: string,
    candidates: Candidate[],
    selectedCandidate?: Candidate,
  ) {
    const cache = readCache();
    cache[key] = {
      query: queryName,
      city,
      candidates,
      selected: selectedCandidate,
      queriedAt: new Date().toISOString(),
    };
    localStorage.setItem(GEOCODE_CACHE_KEY, JSON.stringify(cache));
  }

  async function requestCandidates(names: string[]) {
    const response = await fetch("/api/geocode", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ city, queries: names.map((name) => ({ name })) }),
    });
    const data = await response.json();
    if (!response.ok) throw new Error(data.error || "地点查询失败");
    return data.results as Array<{ name: string; candidates: Candidate[] }>;
  }

  async function searchLocation(searchQuery = query) {
    if (!searchQuery.trim()) return;
    setSearching(true);
    try {
      const cached = readCache()[cacheKey(searchQuery)];
      const candidates = cached?.candidates ?? (await requestCandidates([searchQuery]))[0]?.candidates ?? [];
      if (!cached) writeCache(cacheKey(searchQuery), searchQuery, candidates);
      setResults(candidates);
      if (selected) updateSpot(selected.id, { candidates });
      if (!candidates.length) notify("没有找到候选地点，可直接点击地图设置坐标");
    } catch (error) {
      notify(error instanceof Error ? error.message : "地点查询失败");
    } finally {
      setSearching(false);
    }
  }

  async function queryMissingCoordinates() {
    if (batchSearching) return;
    const missing = spots.filter((spot) => !isLocated(spot));
    if (!missing.length) {
      notify("所有地点都已有坐标");
      return;
    }
    if (missing.length > 20) {
      notify(`有 ${missing.length} 个缺失坐标，请分批处理，每次最多 20 个`);
      return;
    }
    setBatchSearching(true);
    try {
      const cache = readCache();
      const uncached = missing.filter((spot) => !cache[cacheKey(spot.name)]);
      let apiResults: Array<{ name: string; candidates: Candidate[] }> = [];
      if (uncached.length) apiResults = await requestCandidates(uncached.map((spot) => spot.name));
      const apiMap = new Map(apiResults.map((item) => [item.name, item.candidates]));
      const next = spots.map((spot) => {
        if (isLocated(spot)) return spot;
        const key = cacheKey(spot.name);
        const candidates = cache[key]?.candidates ?? apiMap.get(spot.name) ?? [];
        if (!cache[key]) writeCache(key, spot.name, candidates);
        const first = candidates[0];
        if (!first) return { ...spot, candidates };
        return {
          ...spot,
          latitude: first.latitude,
          longitude: first.longitude,
          source: "places_api" as CoordinateSource,
          confidence: confidenceForName(spot.name),
          candidates,
          confirmed: false,
        };
      });
      setSpots(next);
      notify(`已定位 ${next.filter(isLocated).length}/${spots.length} 个地点，请检查候选结果`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "批量查询失败");
    } finally {
      setBatchSearching(false);
    }
  }

  async function aiExtract() {
    if (aiExtracting || !noteText.trim()) return;
    setAiExtracting(true);
    try {
      const response = await fetch("/api/ai-extract", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ text: noteText }),
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error || "AI 识别失败");
      const extracted = normalizeSpots(
        data.spots.map((item: Partial<Spot>) => ({
          ...emptySpot(String(item.name || "未命名地点"), String(item.description || "")),
          latitude: item.latitude ?? null,
          longitude: item.longitude ?? null,
          source:
            item.latitude !== null && item.latitude !== undefined
              ? "manual_coordinates"
              : "manual",
          confirmed: item.latitude !== null && item.latitude !== undefined,
        })),
      );
      setSpots(extracted);
      setSelectedId(extracted[0]?.id ?? null);
      setParserOpen(false);
      notify(`AI 识别到 ${extracted.length} 个地点，未编造坐标`);
    } catch (error) {
      notify(error instanceof Error ? error.message : "AI 识别失败");
    } finally {
      setAiExtracting(false);
    }
  }

  function chooseCandidate(spot: Spot, candidate: Candidate) {
    updateSpot(spot.id, {
      latitude: candidate.latitude,
      longitude: candidate.longitude,
      source: "places_api",
      confirmed: true,
    });
    writeCache(cacheKey(spot.name), spot.name, spot.candidates, candidate);
    setCandidateOpen(false);
    notify("候选地点已确认");
  }

  function exportLocated(kind: "kml" | "csv" | "json") {
    const missing = spots.filter((spot) => !isLocated(spot)).length;
    if (missing && !window.confirm(`还有 ${missing} 个点位没有坐标，是否只导出已定位点位？`)) return;
    const located = spots.filter(isLocated);
    if (kind === "kml") downloadFile("photo-spots.kml", kmlContent(located), "application/vnd.google-earth.kml+xml");
    if (kind === "csv") downloadFile("photo-spots.csv", csvContent(located), "text/csv");
    if (kind === "json") downloadFile("photo-spots.json", JSON.stringify(located, null, 2), "application/json");
  }

  async function addPhotos(files: FileList | File[]) {
    if (!selected) return;
    const images = Array.from(files).filter((file) => file.type.startsWith("image/")).slice(0, 6);
    if (!images.length) return;
    try {
      const compressed = await Promise.all(images.map(compressImage));
      updateSpot(selected.id, { photos: [...selected.photos, ...compressed].slice(0, 8) });
      notify(`已添加 ${compressed.length} 张参考照片`);
    } catch {
      notify("图片处理失败，请换一张图片");
    }
  }

  async function copy(text: string, message: string) {
    await navigator.clipboard.writeText(text);
    notify(message);
  }

  function importJson(event: ChangeEvent<HTMLInputElement>) {
    const file = event.target.files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      try {
        const next = normalizeSpots(JSON.parse(String(reader.result)));
        setSpots(next);
        setSelectedId(next[0]?.id ?? null);
        notify("备份已导入");
      } catch {
        notify("JSON 文件格式不正确");
      }
    };
    reader.readAsText(file);
    event.target.value = "";
  }

  return (
    <div className="collection-app">
      <section className="collection-pane">
        <header className="collection-header">
          <div className="wordmark"><span /> PHOTO.PLACES</div>
          <button className="minimal-icon" title="添加地点" onClick={() => {
            const spot: Spot = { ...emptySpot("新地点"), number: spots.length + 1 };
            setSpots([...spots, spot]);
            setSelectedId(spot.id);
            setEditOpen(true);
          }}><Plus size={20} /></button>
        </header>

        <div className="collection-intro">
          <span className="kicker">TRAVEL PHOTO COLLECTION</span>
          <h1>把一篇旅行笔记<br />变成可视化地图</h1>
          <p>自动定位适合快速生成大概地图，具体拍摄机位建议在地图上手动微调。</p>
          <button className="round-add" onClick={() => setParserOpen(true)} title="粘贴笔记"><Plus size={22} /></button>
        </div>

        <div className="place-strip">
          {spots.map((spot) => (
            <article
              className={`place-card ${selected?.id === spot.id ? "active" : ""}`}
              key={spot.id}
              onClick={() => {
                setSelectedId(spot.id);
                setQuery(spot.name);
                setResults([]);
              }}
            >
              <div className="photo-stack">
                {spot.photos.length ? (
                  spot.photos.slice(0, 3).map((photo, index) => (
                    <img key={`${photo.slice(0, 30)}-${index}`} src={photoUrl(photo)} alt="" style={{ "--photo-index": index } as CSSProperties} />
                  ))
                ) : (
                  <span className="empty-photo"><ImageSquare size={23} /></span>
                )}
                {!isLocated(spot) && <span className="unresolved-badge">待定位</span>}
              </div>
              <span className="card-title">{spot.name}</span>
              <span className="card-meta">
                <i className={`confidence-dot ${spot.confidence}`} />
                {spot.confidence === "high" ? "高可信" : spot.confidence === "medium" ? "中可信" : "低可信"}
                {" · "}
                {spot.confirmed ? "已确认" : isLocated(spot) ? "待确认" : "待定位"}
              </span>
              <span className="card-source">{spot.source}</span>
              <div className="place-card-actions">
                {isLocated(spot) && (
                  <>
                    <a href={mapLink(spot)} target="_blank" rel="noreferrer" onClick={(event) => event.stopPropagation()} title="打开 Google Maps"><ArrowSquareOut size={15} /></a>
                    <button onClick={(event) => { event.stopPropagation(); copy(mapLink(spot), "Google Maps 链接已复制"); }} title="复制 Google Maps 链接"><Copy size={15} /></button>
                  </>
                )}
                {spot.candidates.length > 1 && (
                  <button onClick={(event) => { event.stopPropagation(); setSelectedId(spot.id); setCandidateOpen(true); }} title="查看候选结果"><Question size={15} /></button>
                )}
                <button onClick={(event) => { event.stopPropagation(); deleteSpot(spot.id); }} title="删除"><Trash size={15} /></button>
              </div>
            </article>
          ))}
        </div>

        {selected && (
          <div
            className={`drop-zone ${dragActive ? "dragging" : ""}`}
            onDragEnter={(event) => { event.preventDefault(); setDragActive(true); }}
            onDragOver={(event) => event.preventDefault()}
            onDragLeave={() => setDragActive(false)}
            onDrop={(event) => {
              event.preventDefault();
              setDragActive(false);
              addPhotos(event.dataTransfer.files);
            }}
          >
            <div>
              <strong>{selected.name}</strong>
              <span>{selected.description || "为这个地点添加拍摄说明和参考照片"}</span>
            </div>
            <div className="drop-actions">
              {selected.candidates.length > 0 && (
                <button onClick={() => setCandidateOpen(true)}><Question size={16} /> 候选结果</button>
              )}
              <button onClick={() => fileRef.current?.click()}><UploadSimple size={16} /> 添加照片</button>
              <button onClick={() => setEditOpen(true)}><PencilSimple size={16} /> 编辑</button>
            </div>
          </div>
        )}

        <footer className="collection-footer">
          <span>{spots.length} 个地点 · {locatedSpots.length} 个已定位</span>
          <div>
            <button title="下载 KML" onClick={() => exportLocated("kml")}><DownloadSimple size={17} /></button>
            <button title="下载 CSV" onClick={() => exportLocated("csv")}><FileCsv size={17} /></button>
            <button title="导出 JSON" onClick={() => exportLocated("json")}><FileText size={17} /></button>
            <button title="导入 JSON" onClick={() => jsonRef.current?.click()}><UploadSimple size={17} /></button>
          </div>
        </footer>
      </section>

      <section className="map-pane">
        <div className="city-context">
          <span>城市 / 地区</span>
          <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="例如 London / Paris / Tokyo" />
          <button onClick={queryMissingCoordinates} disabled={batchSearching}>
            {batchSearching ? "查询中…" : "查询缺失坐标"}
          </button>
        </div>
        <div className="map-search">
          <MagnifyingGlass size={20} />
          <input
            value={query}
            onChange={(event) => setQuery(event.target.value)}
            onKeyDown={(event) => event.key === "Enter" && searchLocation()}
            placeholder="搜索地点，或选择一个待定位的地点"
          />
          <button onClick={() => searchLocation()} disabled={searching}>
            {searching ? "搜索中" : "搜索"}
          </button>
        </div>

        <MapContainer center={center} zoom={12} scrollWheelZoom className="collection-map">
          <TileLayer
            attribution='&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a>'
            url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
          />
          <MapClickHandler onPick={(latitude, longitude) => {
            if (!selected) return;
            updateSpot(selected.id, {
              latitude,
              longitude,
              source: "manual",
              confidence: "high",
              confirmed: true,
            });
            notify(`已为 ${selected.name} 设置坐标`);
          }} />
          <MapFocus spot={selected} />
          <FitAllSpots spots={locatedSpots} />
          {locatedSpots.map((spot) => (
            <Marker
              key={spot.id}
              position={[spot.latitude!, spot.longitude!]}
              icon={markerIcon(selected?.id === spot.id, spot.confidence)}
              draggable
              eventHandlers={{
                click: () => setSelectedId(spot.id),
                dragend: (event) => {
                  const marker = event.target as LeafletMarker;
                  const location = marker.getLatLng();
                  updateSpot(spot.id, {
                    latitude: location.lat,
                    longitude: location.lng,
                    source: "manual",
                    confidence: "high",
                    confirmed: true,
                  });
                  notify(`${spot.name} 已手动微调`);
                },
              }}
            >
              <Popup>
                <div className="marker-popup">
                  {spot.photos[0] && (
                    <img className="marker-popup-photo" src={photoUrl(spot.photos[0])} alt={`${spot.name} 拍摄参考`} />
                  )}
                  <strong>{spot.name}</strong>
                  <span>{spot.description}</span>
                  <em>{spot.confidence} · {spot.confirmed ? "已确认" : "待确认"}</em>
                  <a href={mapLink(spot)} target="_blank" rel="noreferrer">打开 Google Maps</a>
                  <button onClick={() => copy(mapLink(spot), "Google Maps 链接已复制")}>复制链接</button>
                </div>
              </Popup>
            </Marker>
          ))}
        </MapContainer>

        {results.length > 0 && (
          <div className="search-results">
            <div className="results-heading">
              <strong>选择准确位置</strong>
              <button onClick={() => setResults([])}><X size={16} /></button>
            </div>
            {results.map((result) => (
              <button key={`${result.latitude}-${result.longitude}`} onClick={() => {
                if (!selected) return;
                const candidates = results;
                updateSpot(selected.id, {
                  latitude: result.latitude,
                  longitude: result.longitude,
                  source: "places_api",
                  candidates,
                  confirmed: true,
                });
                writeCache(cacheKey(selected.name), selected.name, candidates, result);
                setResults([]);
                notify("准确坐标已保存");
              }}>
                <MapPin size={18} />
                <span><strong>{result.name}</strong><small>{result.address}</small></span>
              </button>
            ))}
          </div>
        )}

        <div className="map-status">
          <div className="map-status-place">
            <span className={`status-dot ${selected && isLocated(selected) ? "located" : ""}`} />
            <div>
              <strong>{selected?.name || "选择地点"}</strong>
              <span>{selected && isLocated(selected)
                ? `${formatCoordinate(selected.latitude)}, ${formatCoordinate(selected.longitude)}`
                : "搜索地点或点击地图设置准确坐标"}</span>
            </div>
          </div>
          {selected?.photos[0] && (
            <img className="map-status-photo" src={photoUrl(selected.photos[0])} alt={`${selected.name} 拍摄参考`} />
          )}
          <div className="map-actions">
            {selected && isLocated(selected) && (
              <a href={mapLink(selected)} target="_blank" rel="noreferrer"><ArrowSquareOut size={17} /> Google Maps</a>
            )}
            {selected && isLocated(selected) && (
              <button onClick={() => copy(mapLink(selected), "Google Maps 链接已复制")}><Copy size={17} /> 复制点位</button>
            )}
              <button disabled={!route} onClick={() => window.open(route, "_blank")}><Path size={17} /> 打开路线</button>
            <button disabled={!route} onClick={() => copy(route, "路线链接已复制")}><Copy size={17} /></button>
          </div>
        </div>
      </section>

      {parserOpen && (
        <div className="overlay" onMouseDown={() => setParserOpen(false)}>
          <div className="note-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header><div><span>IMPORT NOTE</span><h2>粘贴旅行笔记</h2></div><button onClick={() => setParserOpen(false)}><X size={21} /></button></header>
            <p>有坐标会直接落图；只有地点名也会保留，之后可搜索或点击地图校准。</p>
            <label className="city-field">
              城市或地区上下文
              <input value={city} onChange={(event) => setCity(event.target.value)} placeholder="例如 London / Paris / Tokyo" />
            </label>
            <textarea value={noteText} onChange={(event) => setNoteText(event.target.value)} placeholder={sampleNote} autoFocus />
            <footer>
              <button className="text-button" onClick={() => setNoteText(sampleNote)}>填入示例</button>
              <button className="text-button" disabled={aiExtracting} onClick={aiExtract}>
                <Sparkle size={17} /> {aiExtracting ? "AI 识别中…" : "AI 智能识别地点"}
              </button>
              <button className="primary-action" onClick={extractNote}><MapPin size={17} /> 提取地点</button>
            </footer>
          </div>
        </div>
      )}

      {editOpen && selected && (
        <div className="overlay" onMouseDown={() => setEditOpen(false)}>
          <div className="edit-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header><h2>编辑地点</h2><button onClick={() => setEditOpen(false)}><X size={20} /></button></header>
            <label>地点名称<input value={selected.name} onChange={(event) => updateSpot(selected.id, { name: event.target.value })} /></label>
            <label>拍摄说明<textarea value={selected.description} onChange={(event) => updateSpot(selected.id, { description: event.target.value })} /></label>
            <div className="coordinate-row">
              <label>纬度<input type="number" step="0.0000001" value={selected.latitude ?? ""} onChange={(event) => updateSpot(selected.id, { latitude: event.target.value ? Number(event.target.value) : null, source: "manual", confidence: "high", confirmed: Boolean(event.target.value && selected.longitude !== null) })} /></label>
              <label>经度<input type="number" step="0.0000001" value={selected.longitude ?? ""} onChange={(event) => updateSpot(selected.id, { longitude: event.target.value ? Number(event.target.value) : null, source: "manual", confidence: "high", confirmed: Boolean(event.target.value && selected.latitude !== null) })} /></label>
            </div>
            <div className="spot-metadata">
              <span>来源：{selected.source}</span>
              <span>可信度：{selected.confidence}</span>
              <span>{selected.confirmed ? "已确认" : "尚未确认"}</span>
            </div>
            {selected.confidence === "low" && (
              <p className="low-confidence-note">这是模糊机位，建议在地图上手动确认具体位置。</p>
            )}
            <footer>
              <button className="delete-action" onClick={() => { deleteSpot(selected.id); setEditOpen(false); }}><Trash size={17} /> 删除地点</button>
              <button className="primary-action" onClick={() => setEditOpen(false)}><Check size={17} /> 完成</button>
            </footer>
          </div>
        </div>
      )}

      {candidateOpen && selected && (
        <div className="overlay" onMouseDown={() => setCandidateOpen(false)}>
          <div className="candidate-modal" onMouseDown={(event) => event.stopPropagation()}>
            <header>
              <div><span>CANDIDATES</span><h2>{selected.name}</h2></div>
              <button onClick={() => setCandidateOpen(false)}><X size={20} /></button>
            </header>
            <p>自动查询可能返回同名地点，请选择最符合笔记语境的结果。</p>
            <div className="candidate-list">
              {selected.candidates.map((candidate) => (
                <article key={`${candidate.latitude}-${candidate.longitude}`}>
                  <MapPin size={20} />
                  <div>
                    <strong>{candidate.name}</strong>
                    <span>{candidate.address}</span>
                    <small>{candidate.latitude.toFixed(7)}, {candidate.longitude.toFixed(7)}</small>
                  </div>
                  <button onClick={() => chooseCandidate(selected, candidate)}>选择此结果</button>
                </article>
              ))}
            </div>
          </div>
        </div>
      )}

      <input ref={fileRef} hidden type="file" accept="image/*" multiple onChange={(event) => {
        if (event.target.files) addPhotos(event.target.files);
        event.target.value = "";
      }} />
      <input ref={jsonRef} hidden type="file" accept=".json,application/json" onChange={importJson} />
      {toast && <div className="collection-toast"><Check size={16} /> {toast}</div>}
    </div>
  );
}
