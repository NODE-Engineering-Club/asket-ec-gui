import { useRef, useCallback, useEffect } from "react";

const REPEAT_MS = 100;
const COMMANDS = {
  forward:  { linear: { x: 1.5,  y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0    } },
  backward: { linear: { x: -1.0, y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0    } },
  left:     { linear: { x: 0.3,  y: 0, z: 0 }, angular: { x: 0, y: 0, z: 1.0  } },
  right:    { linear: { x: 0.3,  y: 0, z: 0 }, angular: { x: 0, y: 0, z: -1.0 } },
  stop:     { linear: { x: 0,    y: 0, z: 0 }, angular: { x: 0, y: 0, z: 0    } },
};

export default function Control({ mode, onModeToggle, publishCmdVel }) {
  const intervalRef = useRef(null);
  const clearRepeat = useCallback(() => { if (intervalRef.current) { clearInterval(intervalRef.current); intervalRef.current = null; } }, []);
  const startRepeat = useCallback((key) => { clearRepeat(); publishCmdVel(COMMANDS[key]); intervalRef.current = setInterval(() => publishCmdVel(COMMANDS[key]), REPEAT_MS); }, [publishCmdVel, clearRepeat]);
  useEffect(() => () => clearRepeat(), [clearRepeat]);

  const isManual = mode === "MANUAL";
  const btn = (key, label) => (
    <button className={`joy-btn joy-${key}`}
      onMouseDown={() => startRepeat(key)} onMouseUp={clearRepeat} onMouseLeave={clearRepeat}
      onTouchStart={(e) => { e.preventDefault(); startRepeat(key); }} onTouchEnd={clearRepeat}>
      {label}
    </button>
  );

  return (
    <div className="control-section">
      <div className="section-title">Control</div>
      <div className="control-inner">
        <div>
          <div className="sub-section-title">Mode switch</div>
          <button className="mode-button" onClick={onModeToggle}>
            {isManual ? "SWITCH TO AUTO" : "SWITCH TO MANUAL"}
          </button>
        </div>
        <div>
          <div className="sub-section-title">Manual control</div>
          <div className={`joystick-wrap${isManual ? "" : " disabled"}`}>
            <div className="joystick">
              {btn("up", "↑")} {btn("left", "←")} {btn("stop", "■")} {btn("right", "→")} {btn("down", "↓")}
            </div>
          </div>
        </div>
        <button className="estop-button" onClick={() => publishCmdVel(COMMANDS.stop)}>
          EMERGENCY STOP
        </button>
      </div>
    </div>
  );
}
