import CoachButton from "../components/CoachButton";
import { useApp } from "../context/AppContext";
export default function DisciplineReport() {
  const { state } = useApp();
  const done = state.tasks.filter((t) => t.done).length;
  const percent = Math.round((done / state.tasks.length) * 100);
  const missed = state.tasks.filter((t) => !t.done && t.due === "Today");
  return (
    <div>
      <section className="report-hero">
        <div>
          <p className="eyebrow">YOUR WEEK IN REVIEW</p>
          <h2>Progress is a pattern, not a verdict.</h2>
          <p>
            You showed up for {done} of {state.tasks.length} planned tasks. The
            aim is honesty, then a kinder adjustment.
          </p>
          <CoachButton />
        </div>
        <div className="report-score">
          <strong>{percent}%</strong>
          <span>
            completion
            <br />
            rhythm
          </span>
        </div>
      </section>
      <div className="report-grid">
        <section className="chart-card">
          <div className="section-heading">
            <div>
              <p className="eyebrow">CONSISTENCY</p>
              <h3>Your focus over seven days</h3>
            </div>
            <span className="chart-key">Completed</span>
          </div>
          <div className="bar-chart">
            {[42, 68, 55, 83, 60, 35, 72].map((v, i) => (
              <div key={i}>
                <span style={{ height: `${v}%` }}></span>
                <small>{["M", "T", "W", "T", "F", "S", "S"][i]}</small>
              </div>
            ))}
          </div>
        </section>
        <section className="coach-panel">
          <p className="eyebrow">COACH MESSAGE</p>
          <h3>“You lost momentum on Thursday, not your ability to finish.”</h3>
          <p>
            The pattern suggests your plan becomes too tight after busy days.
            Next week, leave one evening intentionally empty.
          </p>
          <div className="audio-line">
            <span className="play-dot">▶</span>
            <i></i>
            <i></i>
            <i></i>
            <i></i>
            <i></i>
            <span>00:26</span>
          </div>
          <CoachButton compact />
        </section>
        <section className="missed-card">
          <p className="eyebrow">NEEDS A NEW PLACE</p>
          <h3>
            {missed.length
              ? `${missed.length} task${missed.length > 1 ? "s" : ""} were not completed today.`
              : "Nothing overdue today."}
          </h3>
          {missed.map((t) => (
            <div className="missed-task" key={t.id}>
              <span>○</span>
              <div>
                <strong>{t.title}</strong>
                <small>Move it, reduce it, or let it go.</small>
              </div>
            </div>
          ))}
          <button className="secondary">Review tomorrow</button>
        </section>
      </div>
    </div>
  );
}
