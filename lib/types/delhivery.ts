// Runtime-only types for Delhivery tracking — never persisted in full.

export interface DelhiveryScan {
  time:      string;   // ScanDateTime from Delhivery
  status:    string;   // Scan field — e.g. "In Transit", "Delivered"
  location?: string;   // ScannedLocation
  activity?: string;   // Instructions / remarks
}

export interface DelhiveryTrackingResult {
  waybill:           string;
  current_status:    string; // "no_data" when Delhivery has nothing
  current_location?: string;
  scans:             DelhiveryScan[];
  fetch_time:        string; // ISO timestamp — set by our server
}

// Raw shape returned by the Delhivery Pull API
export interface DelhiveryRawScanDetail {
  ScanDateTime:    string;
  Scan:            string;
  ScannedLocation?: string;
  Instructions?:   string;
  StatusType?:     string;
}

export interface DelhiveryRawStatus {
  Status:          string;
  StatusLocation?: string;
  StatusDateTime?: string;
  Instructions?:   string;
  StatusType?:     string;
}

export interface DelhiveryRawShipment {
  AWB:    string;
  Status: DelhiveryRawStatus;
  Scans?: { ScanDetail: DelhiveryRawScanDetail }[];
}

export interface DelhiveryRawResponse {
  ShipmentData?: { Shipment: DelhiveryRawShipment }[];
}
