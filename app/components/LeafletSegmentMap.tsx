"use client";
import React from "react";
import "leaflet/dist/leaflet.css";
import "./leaflet-style.css";
import { MapContainer, TileLayer, Polyline } from "react-leaflet";
import { decode } from "@mapbox/polyline";

interface LeafletSegmentMapProps {
  polyline: string;
}

function getLatLngs(polyline: string): [number, number][] {
  return decode(polyline);
}

export default function LeafletSegmentMap({ polyline }: LeafletSegmentMapProps) {
  const latlngs = getLatLngs(polyline);
  if (!latlngs.length) return null;

  // Center the map on the middle point
  const center = latlngs[Math.floor(latlngs.length / 2)];

  return (
    <div className="w-full h-64 rounded overflow-hidden border shadow mb-4">
      <MapContainer
        center={center as [number, number]}
        zoom={13}
        scrollWheelZoom={false}
        style={{ width: "100%", height: "100%" }}
      >
        <TileLayer
          url="https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png"
        />
        <Polyline positions={latlngs as [number, number][]} pathOptions={{ color: "#f87171", weight: 5, opacity: 0.9 }} />
      </MapContainer>
    </div>
  );
}
