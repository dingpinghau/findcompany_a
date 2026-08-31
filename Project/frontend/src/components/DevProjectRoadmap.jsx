const MS_PER_DAY = 86400000;

function toTime(dateStr) {
  return new Date(`${dateStr}T00:00:00`).getTime();
}

function formatTick(ms) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

function projectSpan(project) {
  if (!project.timeline_start) return null;
  const start = toTime(project.timeline_start);
  const end = project.timeline_end ? toTime(project.timeline_end) : start;
  return { start: Math.min(start, end), end: Math.max(start, end), hasEnd: Boolean(project.timeline_end) };
}

export default function DevProjectRoadmap({ projects }) {
  const rows = projects
    .map((p) => {
      const span = projectSpan(p);
      if (!span) return null;
      return {
        id: p.id,
        name: p.name,
        status: p.status,
        ...span,
      };
    })
    .filter(Boolean)
    .sort((a, b) => a.start - b.start);

  if (rows.length === 0) {
    return <p className="roadmap-empty">目前沒有已排定時程的專案可顯示於 roadmap。</p>;
  }

  const rawMin = Math.min(...rows.map((r) => r.start));
  const rawMax = Math.max(...rows.map((r) => r.end));
  const padding = Math.max((rawMax - rawMin) * 0.05, 3 * MS_PER_DAY);
  const min = rawMin - padding;
  const max = rawMax + padding;
  const span = max - min;

  const pct = (t) => ((t - min) / span) * 100;

  const spanDays = span / MS_PER_DAY;
  const tickStepDays = spanDays > 180 ? 30 : spanDays > 60 ? 14 : 7;
  const ticks = [];
  for (let t = min; t <= max; t += tickStepDays * MS_PER_DAY) {
    ticks.push(t);
  }

  return (
    <div>
      <div className="roadmap-legend">
        <span>
          <span className="swatch kickoff" />
          開始
        </span>
        <span>
          <span className="swatch bid" />
          預估上線
        </span>
      </div>
      <div className="roadmap-scroll">
        <div className="roadmap-inner">
          <div className="roadmap-axis">
            <div className="roadmap-label"></div>
            <div className="roadmap-track">
              {ticks.map((t) => (
                <div key={t} className="roadmap-tick" style={{ left: `${pct(t)}%` }}>
                  {formatTick(t)}
                </div>
              ))}
            </div>
          </div>
          <div className="roadmap">
            {rows.map((r) => (
              <div className="roadmap-row" key={r.id}>
                <div className="roadmap-label" title={r.name}>
                  <span className="roadmap-label-text">{r.name}</span>
                </div>
                <div className="roadmap-track">
                  {r.hasEnd && (
                    <div
                      className="roadmap-bar"
                      style={{ left: `${pct(r.start)}%`, width: `${pct(r.end) - pct(r.start)}%` }}
                    />
                  )}
                  <div className="roadmap-dot kickoff" style={{ left: `${pct(r.start)}%` }} title={`開始：${r.status}`} />
                  {r.hasEnd && <div className="roadmap-dot bid" style={{ left: `${pct(r.end)}%` }} title="預估上線" />}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
