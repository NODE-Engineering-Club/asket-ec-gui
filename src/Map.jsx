import { useRef, useEffect, useCallback } from "react";

const TRAIL_LEN = 200;
const GRID_SPACING = 10; // metres

export default function Map({ pose, buoys, detectedBuoys, gateCenters }) {
  const canvasRef = useRef(null);
  const stateRef = useRef({
    trail: [], scale: 10, offsetX: 0, offsetY: 0,
    dragging: false, dragStart: null, offsetAtDrag: null, autoCenter: true,
  });

  useEffect(() => {
    if (!pose) return;
    const s = stateRef.current;
    s.trail.push({ x: pose.x, y: pose.y });
    if (s.trail.length > TRAIL_LEN) s.trail.shift();
  }, [pose]);

  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    const ctx = canvas.getContext("2d");
    const W = canvas.width, H = canvas.height, s = stateRef.current;

    if (pose && s.autoCenter) {
      s.offsetX = W / 2 - pose.x * s.scale;
      s.offsetY = H / 2 + pose.y * s.scale;
    }
    const wx = (mx) => s.offsetX + mx * s.scale;
    const wy = (my) => s.offsetY - my * s.scale;

    ctx.clearRect(0, 0, W, H);
    ctx.fillStyle = "#fff"; ctx.fillRect(0, 0, W, H);

    // Grid
    ctx.strokeStyle = "#e0e0e0"; ctx.lineWidth = 1;
    const ox = ((s.offsetX % (GRID_SPACING * s.scale)) + GRID_SPACING * s.scale) % (GRID_SPACING * s.scale);
    const oy = ((s.offsetY % (GRID_SPACING * s.scale)) + GRID_SPACING * s.scale) % (GRID_SPACING * s.scale);
    for (let x = ox; x < W; x += GRID_SPACING * s.scale) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = oy; y < H; y += GRID_SPACING * s.scale) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }

    // Gate path
    if (gateCenters && gateCenters.length > 1) {
      ctx.strokeStyle = "#000"; ctx.lineWidth = 1; ctx.setLineDash([4,4]);
      ctx.beginPath();
      gateCenters.forEach((p,i) => i === 0 ? ctx.moveTo(wx(p.x),wy(p.y)) : ctx.lineTo(wx(p.x),wy(p.y)));
      ctx.stroke(); ctx.setLineDash([]);
    }
    // Gate crosses
    if (gateCenters) {
      ctx.strokeStyle = "#000"; ctx.lineWidth = 1.5;
      gateCenters.forEach((p) => {
        const cx=wx(p.x), cy=wy(p.y);
        ctx.beginPath(); ctx.moveTo(cx-6,cy); ctx.lineTo(cx+6,cy); ctx.moveTo(cx,cy-6); ctx.lineTo(cx,cy+6); ctx.stroke();
      });
    }

    // Buoys
    const detectedSet = new Set((detectedBuoys||[]).map((b)=>`${b.x.toFixed(3)},${b.y.toFixed(3)}`));
    (buoys||[]).forEach((b) => {
      const cx=wx(b.x), cy=wy(b.y), key=`${b.x.toFixed(3)},${b.y.toFixed(3)}`;
      ctx.fillStyle = b.color==="green" ? "#00aa00" : "#ff0000";
      ctx.beginPath(); ctx.arc(cx,cy,6,0,Math.PI*2); ctx.fill();
      if (detectedSet.has(key)) { ctx.strokeStyle="#000"; ctx.lineWidth=2; ctx.beginPath(); ctx.arc(cx,cy,10,0,Math.PI*2); ctx.stroke(); }
      ctx.fillStyle="#000"; ctx.font="10px Arial"; ctx.fillText(b.label||"", cx+10, cy+4);
    });

    // Trail
    if (s.trail.length > 1) {
      ctx.strokeStyle="#000"; ctx.lineWidth=1; ctx.beginPath();
      s.trail.forEach((p,i) => i===0 ? ctx.moveTo(wx(p.x),wy(p.y)) : ctx.lineTo(wx(p.x),wy(p.y)));
      ctx.stroke();
    }

    // Boat
    if (pose) {
      ctx.save(); ctx.translate(wx(pose.x), wy(pose.y)); ctx.rotate(-pose.heading + Math.PI/2);
      ctx.fillStyle="#000"; ctx.beginPath();
      ctx.moveTo(0,-12); ctx.lineTo(-7.2,7.2); ctx.lineTo(7.2,7.2); ctx.closePath(); ctx.fill();
      ctx.restore();
    }

    // Scale bar
    const barPx = 10 * s.scale, barX = 16, barY = H - 20;
    ctx.strokeStyle="#000"; ctx.lineWidth=2;
    ctx.beginPath(); ctx.moveTo(barX,barY); ctx.lineTo(barX+barPx,barY);
    ctx.moveTo(barX,barY-4); ctx.lineTo(barX,barY+4);
    ctx.moveTo(barX+barPx,barY-4); ctx.lineTo(barX+barPx,barY+4); ctx.stroke();
    ctx.fillStyle="#000"; ctx.font="11px Arial"; ctx.fillText("10m", barX+barPx+6, barY+4);
  }, [pose, buoys, detectedBuoys, gateCenters]);

  useEffect(() => {
    const canvas = canvasRef.current; if (!canvas) return;
    const ro = new ResizeObserver(() => { canvas.width=canvas.offsetWidth; canvas.height=canvas.offsetHeight; draw(); });
    ro.observe(canvas.parentElement); return () => ro.disconnect();
  }, [draw]);

  useEffect(() => { draw(); }, [draw]);

  const onWheel = useCallback((e) => {
    e.preventDefault();
    const s = stateRef.current, canvas = canvasRef.current, rect = canvas.getBoundingClientRect();
    const mx = e.clientX-rect.left, my = e.clientY-rect.top;
    const worldX=(mx-s.offsetX)/s.scale, worldY=-(my-s.offsetY)/s.scale;
    const factor = e.deltaY < 0 ? 1.1 : 1/1.1;
    s.scale = Math.max(2, Math.min(200, s.scale*factor));
    s.offsetX = mx - worldX*s.scale; s.offsetY = my + worldY*s.scale; s.autoCenter=false; draw();
  }, [draw]);

  const onMouseDown = useCallback((e) => {
    const s=stateRef.current; s.dragging=true; s.dragStart={x:e.clientX,y:e.clientY}; s.offsetAtDrag={x:s.offsetX,y:s.offsetY}; s.autoCenter=false;
  }, []);
  const onMouseMove = useCallback((e) => {
    const s=stateRef.current; if(!s.dragging) return;
    s.offsetX=s.offsetAtDrag.x+(e.clientX-s.dragStart.x); s.offsetY=s.offsetAtDrag.y+(e.clientY-s.dragStart.y); draw();
  }, [draw]);
  const onMouseUp = useCallback(() => { stateRef.current.dragging=false; }, []);
  const recenter  = useCallback(() => { stateRef.current.autoCenter=true; draw(); }, [draw]);

  return (
    <div style={{ position:"relative", flex:1, overflow:"hidden" }}>
      <canvas ref={canvasRef} style={{ display:"block", width:"100%", height:"100%", cursor:"grab" }}
        onWheel={onWheel} onMouseDown={onMouseDown} onMouseMove={onMouseMove} onMouseUp={onMouseUp} onMouseLeave={onMouseUp} />
      <button onClick={recenter} style={{ position:"absolute", top:8, right:8, fontFamily:"Arial,sans-serif", fontSize:11, padding:"3px 8px", background:"#fff", border:"1px solid #000", cursor:"pointer" }}>
        RE-CENTER
      </button>
    </div>
  );
}
