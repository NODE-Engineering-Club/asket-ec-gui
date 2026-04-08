import { useState } from "react";

export default function Mission({ onSendMission, onClearMission }) {
  const [lat, setLat] = useState("");
  const [lon, setLon] = useState("");
  const [waypoints, setWaypoints] = useState([]);

  const add = () => {
    const la = parseFloat(lat), lo = parseFloat(lon);
    if (isNaN(la) || isNaN(lo)) return;
    setWaypoints((p) => [...p, { lat: la, lon: lo }]);
    setLat(""); setLon("");
  };

  return (
    <div className="mission-section">
      <div className="section-title">Mission Planning</div>
      <div className="mission-inner">
        <div className="waypoint-form">
          <label>Lat</label>
          <input type="number" step="0.000001" placeholder="41.385100" value={lat} onChange={(e)=>setLat(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&add()} />
          <label>Lon</label>
          <input type="number" step="0.000001" placeholder="2.173400"  value={lon} onChange={(e)=>setLon(e.target.value)} onKeyDown={(e)=>e.key==="Enter"&&add()} />
          <button className="btn" onClick={add}>ADD WAYPOINT</button>
        </div>
        <div className="waypoint-list">
          {waypoints.length === 0
            ? <div className="waypoint-list-empty">No waypoints added.</div>
            : waypoints.map((wp, i) => (
                <div className="waypoint-row" key={i}>
                  <span className="waypoint-index">#{i+1}</span>
                  <span className="waypoint-coords">{wp.lat.toFixed(6)}, {wp.lon.toFixed(6)}</span>
                  <button className="btn btn-remove" onClick={()=>setWaypoints((p)=>p.filter((_,idx)=>idx!==i))}>REMOVE</button>
                </div>
              ))
          }
        </div>
        <div className="mission-actions">
          <button className="btn btn-wide" onClick={()=>onSendMission(waypoints)}>SEND MISSION</button>
          <button className="btn btn-wide" onClick={()=>{ setWaypoints([]); onClearMission(); }}>CLEAR MISSION</button>
        </div>
      </div>
    </div>
  );
}
