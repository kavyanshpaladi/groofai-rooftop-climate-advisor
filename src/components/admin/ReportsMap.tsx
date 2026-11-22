import L from "leaflet";
import { MapContainer, Marker, Popup, TileLayer } from "react-leaflet";
import "leaflet/dist/leaflet.css";
import { optionLabel, type ReportRow } from "./stats";

const pin = L.divIcon({ className: "", html: '<div style="width:14px;height:14px;border-radius:9999px;background:var(--primary);border:2px solid var(--card);box-shadow:0 1px 4px rgb(0 0 0/.35)"></div>', iconSize: [14, 14], iconAnchor: [7, 7] });

export default function ReportsMap({ rows }: { rows: ReportRow[] }) {
  const pts = rows.filter((r) => r.latitude != null && r.longitude != null);
  const center: [number, number] = pts[0] ? [Number(pts[0].latitude), Number(pts[0].longitude)] : [17.385, 78.4867];
  return (
    <MapContainer center={center} zoom={11} className="h-80 w-full rounded-xl" scrollWheelZoom={false}>
      <TileLayer url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png" attribution="&copy; OpenStreetMap" />
      {pts.map((r) => (
        <Marker key={r.id} position={[Number(r.latitude), Number(r.longitude)]} icon={pin}>
          <Popup>
            <strong>{optionLabel(r.best_option)}</strong><br />
            Area: {Math.round(Number(r.roof_area ?? 0))} m²<br />
            {new Date(r.created_at).toLocaleDateString()}
          </Popup>
        </Marker>
      ))}
    </MapContainer>
  );
}
