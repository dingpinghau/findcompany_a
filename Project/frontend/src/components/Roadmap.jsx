const MS_PER_DAY = 86400000;

function toTime(dateStr) {
  return new Date(`${dateStr}T00:00:00`).getTime();
}

function formatTick(ms) {
  const d = new Date(ms);
  return `${d.getMonth() + 1}/${d.getDate()}`;
}

export default function Roadmap({ projects }) {
  const rows = projects
    .filter((p) => p.kickoff_date)
    .map((p) => {
      const start = toTime(p.kickoff_date);
      const end = p.bid_date ? toTime(p.bid_date) : start;
      return {
        id: p.id,
        name: p.name,
        start: Math.min(start, end),
        end: Math.max(start, end),
        hasBid: Boolean(p.bid_date),
        kickoffLabel: p.kickoff_date,
        bidLabel: p.bid_date,
      };
    })
    .sort((a, b) => a.start - b.start);

  if (rows.length === 0) {
    return <p className="roadmap-empty">目前沒有待公告／公開徵求／進行中的專案可顯示於 roadmap。</p>;
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
          建案會議
        </span>
        <span>
          <span className="swatch bid" />
          投標
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
                  {r.name}
                </div>
                <div className="roadmap-track">
                  {r.hasBid && (
                    <div
                      className="roadmap-bar"
                      style={{ left: `${pct(r.start)}%`, width: `${pct(r.end) - pct(r.start)}%` }}
                    />
                  )}
                  <div
                    className="roadmap-dot kickoff"
                    style={{ left: `${pct(r.start)}%` }}
                    title={`建案會議：${r.kickoffLabel}`}
                  />
                  {r.hasBid && (
                    <div
                      className="roadmap-dot bid"
                      style={{ left: `${pct(r.end)}%` }}
                      title={`投標：${r.bidLabel}`}
                    />
                  )}
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>
    </div>
  );
}
