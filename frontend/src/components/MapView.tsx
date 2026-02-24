import { MapContainer, TileLayer, Marker, Popup } from "react-leaflet";
import "leaflet/dist/leaflet.css";

export default function MapView() {
  return (
    <MapContainer center={[28.7041, 77.1025]} zoom={13} style={{ height: "500px" }}>
      <TileLayer
        attribution="&copy; OpenStreetMap"
        url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
      />
      <Marker position={[28.7041, 77.1025]}>
        <Popup>Asset Location</Popup>
      </Marker>
    </MapContainer>
  );
}