import { useState } from 'react';
import { Avatar } from '../components/Avatar';
import { TaskRow } from '../components/TaskRow';
import { SAMPLE_TODAY, SAMPLE_USERS } from '../data/sample';

export function TodayScreen() {
  const [tasks, setTasks] = useState(SAMPLE_TODAY);
  const done = tasks.filter((t) => t.completed).length;

  const toggle = (id: string, completed: boolean) =>
    setTasks((prev) => prev.map((t) => (t.id === id ? { ...t, completed } : t)));

  return (
    <>
      <header className="mb-d2 flex items-center justify-between">
        <div>
          <h1
            className="font-head"
            style={{
              fontSize: 'var(--fs-big)',
              fontWeight: 'var(--title-weight)',
              letterSpacing: 'var(--title-tracking)',
            }}
          >
            Today
          </h1>
          <div className="text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
            Wednesday, 3 September
          </div>
        </div>
        <Avatar emoji={SAMPLE_USERS.JD.emoji} color={SAMPLE_USERS.JD.color} size={36} />
      </header>

      <div className="mb-d3 mt-d3 flex items-center gap-2">
        <div className="h-[7px] flex-1 overflow-hidden rounded-full bg-track">
          <div
            className="h-full rounded-full bg-accent transition-all"
            style={{ width: `${Math.round((done / tasks.length) * 100)}%` }}
          />
        </div>
        <span className="font-semibold text-muted" style={{ fontSize: 'var(--fs-sm)' }}>
          {done} of {tasks.length}
        </span>
      </div>

      <h2
        className="mb-d2 mt-d3 font-bold uppercase text-muted"
        style={{ fontSize: 'var(--fs-xs)', letterSpacing: '0.09em' }}
      >
        Focus
      </h2>

      {tasks.map((t) => (
        <TaskRow key={t.id} task={t} onToggle={toggle} />
      ))}
    </>
  );
}
