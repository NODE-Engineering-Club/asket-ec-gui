export default function Telemetry({ gps, pose, speed, gatesPassed, totalGates, mode }) {
  const lat = gps  ? gps.latitude.toFixed(6)  : "—";
  const lon = gps  ? gps.longitude.toFixed(6) : "—";
  const spd = speed !== null ? speed.toFixed(2) : "0.00";
  const hdg = pose  ? ((pose.headingDeg + 360) % 360).toFixed(1).padStart(5, "0") : "000.0";

  return (
    <div className="telemetry-section">
      <div className="section-title">Telemetry</div>
      <div className="telemetry-grid">
        <span className="telemetry-label">Latitude</span>
        <span className="telemetry-value">{lat}°</span>
        <span className="telemetry-label">Longitude</span>
        <span className="telemetry-value">{lon}°</span>
        <span className="telemetry-label">Speed</span>
        <span className="telemetry-value">{spd} m/s</span>
        <span className="telemetry-label">Heading</span>
        <span className="telemetry-value">{hdg}°</span>
        <span className="telemetry-label">Gates passed</span>
        <span className="telemetry-value">{gatesPassed} / {totalGates}</span>
        <span className="telemetry-label">Mode</span>
        <span className={`telemetry-value mode-${mode.toLowerCase()}`}>{mode}</span>
      </div>
    </div>
  );
}
