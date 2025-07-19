declare module 'react-leaflet' {
  import React from 'react';
  import { LatLngExpression, PathOptions } from 'leaflet';

  export interface MapContainerProps {
    center: LatLngExpression;
    zoom: number;
    scrollWheelZoom?: boolean;
    style?: React.CSSProperties;
    children?: React.ReactNode;
    [key: string]: any;
  }

  export interface TileLayerProps {
    url: string;
    [key: string]: any;
  }

  export interface PolylineProps {
    positions: LatLngExpression | LatLngExpression[];
    pathOptions?: PathOptions;
    [key: string]: any;
  }

  export const MapContainer: React.FC<MapContainerProps>;
  export const TileLayer: React.FC<TileLayerProps>;
  export const Polyline: React.FC<PolylineProps>;
} 