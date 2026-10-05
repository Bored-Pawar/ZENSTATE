import { Link } from "react-router-dom";
import { useApp } from "../context/AppContext";
import CoachButton from "../components/CoachButton";
import StatCard from "../components/StatCard";
import TaskRow from "../components/TaskRow";
export default function Today() {
  const { state } = useApp();
  const today = state.tasks.filter((t) => t.due === "Today");
  const completed = state.tasks.filter((t) => t.done).length;
  return (
    <div className="page-grid today-page">
      <section className="hero-card">
        <div>
          <p className="eyebrow">MONDAY, 5 OCTOBER</p>
          <h2>Good evening, {state.user.name}.</h2>
          <p>
            Your plan has room for 2 focused tasks. Start with one that makes
            tomorrow easier.
          </p>
          <CoachButton />
        </div>
        <div className="focus-orb">
          <span>01</span>
          <small>
            next
            <br />
            step
          </small>
        </div>
      </section>
      <section className="today-content">
        <div className="section-heading">
          <div>
            <p className="eyebrow">YOUR DAY</p>
            <h2>Today’s focus</h2>
          </div>
          <Link className="text-link" to="/tasks">
            See all tasks
          </Link>
        </div>
        <div className="task-list">
          {today.map((t) => (
            <TaskRow task={t} key={t.id} />
          ))}
        </div>
      </section>
      <aside className="right-rail">
        <StatCard
          label="FOCUS TIME"
          value="2h 15m"
          detail="planned for today"
        />
        <StatCard
          label="WEEKLY RHYTHM"
          value={`${completed}/5`}
          detail="tasks completed"
          tone="yellow"
        />
        <article className="small-card">
          <p className="eyebrow">A GENTLE NUDGE</p>
          <h3>You do not need a perfect day.</h3>
          <p>
            Start the research task for ten minutes. The next step will become
            clearer after that.
          </p>
        </article>
      </aside>
    </div>
  );
}
