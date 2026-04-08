import { useState, useEffect, useRef, useCallback } from "react";
import "./index.css";
import Map from "./Map";
import Telemetry from "./Telemetry";
import Control from "./Control";
import Mission from "./Mission";

const WS_URL = "ws://localhost:9090";
const RECONNECT_MS = 3000;
const DISPLAY_HZ = 10;
const DISPLAY_MS = 1000 / DISPLAY_HZ;

function haversine(lat1, lon1, lat2, lon2) {
  const R = 6371000;
  const dLat = ((lat2 - lat1) * Math.PI) / 180;
  const dLon = ((lon2 - lon1) * Math.PI) / 180;
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos((lat1 * Math.PI) / 180) *
      Math.cos((lat2 * Math.PI) / 180) *
      Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

function quatToYaw(q) {
  return Math.atan2(
    2 * (q.w * q.z + q.x * q.y),
    1 - 2 * (q.y * q.y + q.z * q.z)
  );
}

function markersToButoys(markerArray) {
  if (!markerArray || !markerArray.markers) return [];
  return markerArray.markers.map((m) => {
    const r = m.color ? m.color.r : 1;
    const g = m.color ? m.color.g : 0;
    const isGreen = g > r;
    return {
      x: m.pose.position.x,
      y: m.pose.position.y,
      color: isGreen ? "green" : "red",
      label: m.ns || m.id?.toString() || "",
    };
  });
}

function pathToPoints(path) {
  if (!path || !path.poses) return [];
  return path.poses.map((p) => ({
    x: p.pose.position.x,
    y: p.pose.position.y,
  }));
}

export default function App() {
  const rosRef = useRef(null);
  const [connected, setConnected] = useState(false);

  const rawRef = useRef({
    pose: null, gps: null, buoys: [], detectedBuoys: [],
    gateCenters: [], gatesPassed: 0, totalGates: 0,
  });

  const [displayPose, setDisplayPose]               = useState(null);
  const [displayGps, setDisplayGps]                 = useState(null);
  const [displaySpeed, setDisplaySpeed]             = useState(0);
  const [displayBuoys, setDisplayBuoys]             = useState([]);
  const [displayDetected, setDisplayDetected]       = useState([]);
  const [displayGateCenters, setDisplayGateCenters] = useState([]);
  const [gatesPassed, setGatesPassed]               = useState(0);
  const [totalGates, setTotalGates]                 = useState(0);
  const [mode, setMode]                             = useState("AUTO");

  const prevGpsRef     = useRef(null);
  const prevGpsTimeRef = useRef(null);
  const speedRef       = useRef(0);
  const cmdVelPubRef   = useRef(null);
  const manualModePubRef = useRef(null);
  const missionPubRef  = useRef(null);

  useEffect(() => {
    const id = setInterval(() => {
      const r = rawRef.current;
      setDisplayPose(r.pose ? { ...r.pose } : null);
      setDisplayGps(r.gps ? { ...r.gps } : null);
      setDisplaySpeed(speedRef.current);
      setDisplayBuoys([...r.buoys]);
      setDisplayDetected([...r.detectedBuoys]);
      setDisplayGateCenters([...r.gateCenters]);
      setGatesPassed(r.gatesPassed);
      setTotalGates(r.totalGates);
    }, DISPLAY_MS);
    return () => clearInterval(id);
  }, []);

  const connect = useCallback(() => {
    if (rosRef.current) { try { rosRef.current.close(); } catch (_) {} rosRef.current = null; }
    const ROSLIB = window.ROSLIB;
    if (!ROSLIB) { console.error("roslibjs not loaded"); return; }
    const ros = new ROSLIB.Ros({ url: WS_URL });
    rosRef.current = ros;
    ros.on("connection", () => { setConnected(true); setupTopics(ros); });
    ros.on("error",      () => setConnected(false));
    ros.on("close",      () => setConnected(false));
  }, []); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => {
    connect();
    const id = setInterval(() => {
      if (!rosRef.current || !rosRef.current.isConnected) connect();
    }, RECONNECT_MS);
    return () => { clearInterval(id); if (rosRef.current) try { rosRef.current.close(); } catch (_) {} };
  }, [connect]);

  function setupTopics(ros) {
    const ROSLIB = window.ROSLIB;
    const sub = (name, type, cb) => { const t = new ROSLIB.Topic({ ros, name, messageType: type }); t.subscribe(cb); };

    sub("/sim2d/pose", "geometry_msgs/PoseStamped", (msg) => {
      const yaw = quatToYaw(msg.pose.orientation);
      rawRef.current.pose = { x: msg.pose.position.x, y: msg.pose.position.y, heading: yaw, headingDeg: (yaw * 180) / Math.PI };
    });
    sub("/sim2d/navsat", "sensor_msgs/NavSatFix", (msg) => {
      const now = Date.now(), prev = prevGpsRef.current, prevT = prevGpsTimeRef.current;
      if (prev && prevT) { const dt = (now - prevT) / 1000; if (dt > 0) speedRef.current = haversine(prev.latitude, prev.longitude, msg.latitude, msg.longitude) / dt; }
      prevGpsRef.current = { latitude: msg.latitude, longitude: msg.longitude };
      prevGpsTimeRef.current = now;
      rawRef.current.gps = { latitude: msg.latitude, longitude: msg.longitude };
    });
    sub("/buoys/all",      "visualization_msgs/MarkerArray", (msg) => { rawRef.current.buoys = markersToButoys(msg); });
    sub("/buoys/detected", "visualization_msgs/MarkerArray", (msg) => { rawRef.current.detectedBuoys = markersToButoys(msg); });
    sub("/gates/centers",  "nav_msgs/Path", (msg) => {
      const pts = pathToPoints(msg); rawRef.current.gateCenters = pts; rawRef.current.totalGates = pts.length;
    });

    cmdVelPubRef.current    = new ROSLIB.Topic({ ros, name: "/cmd_vel",            messageType: "geometry_msgs/Twist" });
    manualModePubRef.current = new ROSLIB.Topic({ ros, name: "/manual_mode",        messageType: "std_msgs/Bool" });
    missionPubRef.current   = new ROSLIB.Topic({ ros, name: "/mission/waypoints",  messageType: "nav_msgs/Path" });
  }

  const publishCmdVel = useCallback((cmd) => {
    if (!cmdVelPubRef.current) return;
    cmdVelPubRef.current.publish(new window.ROSLIB.Message(cmd));
  }, []);

  const toggleMode = useCallback(() => {
    setMode((prev) => {
      const next = prev === "AUTO" ? "MANUAL" : "AUTO";
      if (manualModePubRef.current) manualModePubRef.current.publish(new window.ROSLIB.Message({ data: next === "MANUAL" }));
      return next;
    });
  }, []);

  const sendMission = useCallback((waypoints) => {
    if (!missionPubRef.current) return;
    const now = Math.floor(Date.now() / 1000);
    missionPubRef.current.publish(new window.ROSLIB.Message({
      header: { seq: 0, stamp: { secs: now, nsecs: 0 }, frame_id: "map" },
      poses: waypoints.map((wp) => ({
        header: { seq: 0, stamp: { secs: now, nsecs: 0 }, frame_id: "map" },
        pose: { position: { x: wp.lon, y: wp.lat, z: 0 }, orientation: { x: 0, y: 0, z: 0, w: 1 } },
      })),
    }));
  }, []);

  const clearMission = useCallback(() => {
    if (!missionPubRef.current) return;
    const now = Math.floor(Date.now() / 1000);
    missionPubRef.current.publish(new window.ROSLIB.Message({ header: { seq: 0, stamp: { secs: now, nsecs: 0 }, frame_id: "map" }, poses: [] }));
  }, []);

  return (
    <div className="dashboard">
      <header className="header">
        <h1>ASKET EC — BOAT DASHBOARD</h1>
        <span className={`connection-status ${connected ? "connected" : "disconnected"}`}>
          {connected ? "● CONNECTED" : "○ DISCONNECTED"}
        </span>
        <span style={{ fontSize: 12, color: "#666" }}>{WS_URL}</span>
      </header>
      <section className="map-section">
        <div className="section-title">2D Map</div>
        <Map pose={displayPose} buoys={displayBuoys} detectedBuoys={displayDetected} gateCenters={displayGateCenters} />
      </section>
      <div className="right-panel">
        <Telemetry gps={displayGps} pose={displayPose} speed={displaySpeed} gatesPassed={gatesPassed} totalGates={totalGates} mode={mode} />
        <Control mode={mode} onModeToggle={toggleMode} publishCmdVel={publishCmdVel} />
        <Mission onSendMission={sendMission} onClearMission={clearMission} />
      </div>
    </div>
  );
}
