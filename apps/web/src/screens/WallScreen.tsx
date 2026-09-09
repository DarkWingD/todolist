import { useEffect, useState } from 'react';
import { trpc } from '../lib/trpc';

const REFRESH_MS = 30 * 60 * 1000;
const W = 1872;
const H = 1404;

function startOfToday(): Date {
  const d = new Date();
  d.setHours(0, 0, 0, 0);
  return d;
}
const fmtTime = (iso: string) =>
  new Date(iso).toLocaleTimeString([], { hour: 'numeric', minute: '2-digit' }).replace(' ', ' ');
const fmtRange = (a: string | null, b: string | null) => (a ? `${a}${b ? ` – ${b}` : ''}` : '');
const shortDay = (key: string) =>
  new Date(`${key}T00:00:00`).toLocaleDateString([], { weekday: 'short', day: 'numeric' });
const whenLabel = (key: string, dayStart: Date) => {
  const d = new Date(`${key}T00:00:00`);
  const days = Math.round((d.getTime() - dayStart.getTime()) / 86_400_000);
  if (days < 7) return 'this week';
  if (days < 14) return 'next week';
  return `in ${Math.floor(days / 7)} weeks`;
};

const css = `
.wall{width:${W}px;height:${H}px;background:#f7f7f4;color:#111;font-family:Nunito,system-ui,sans-serif;font-weight:600;display:grid;grid-template-columns:600px 1fr 540px;grid-template-rows:112px 1fr;overflow:hidden;transform-origin:top left}
.wall *{box-sizing:border-box}
.wall .top{grid-column:1/-1;display:flex;align-items:flex-end;justify-content:space-between;padding:30px 44px 18px;border-bottom:4px solid #111}
.wall .date{font-family:Quicksand,system-ui,sans-serif;font-size:58px;font-weight:700;letter-spacing:-.01em;line-height:1}
.wall .date small{font-size:28px;color:#7a7a7a;font-weight:600;margin-left:14px}
.wall .tr{text-align:right;font-size:24px;color:#3a3a3a;line-height:1.25}
.wall .col{padding:26px 40px 30px;display:flex;flex-direction:column;gap:22px;min-height:0;overflow:hidden}
.wall .col+.col{border-left:3px solid #b8b8b8}
.wall h2{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:.12em;color:#3a3a3a;padding-bottom:8px;border-bottom:2px solid #b8b8b8;margin:0 0 14px;display:flex;justify-content:space-between}
.wall h2 .n{font-weight:800;color:#7a7a7a;letter-spacing:0;text-transform:none}
.wall .who{display:flex;flex-direction:column;gap:10px}
.wall .who .row{display:flex;align-items:center;gap:16px;font-size:26px}
.wall .av{width:52px;height:52px;border-radius:50%;border:3px solid #111;display:grid;place-items:center;font-size:26px;flex:none;background:#fff}
.wall .av.kid{border-style:dashed}
.wall .who .name{font-weight:900;width:150px;flex:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wall .who .where{color:#3a3a3a;white-space:nowrap;overflow:hidden;text-overflow:ellipsis}
.wall .who .off .where{color:#7a7a7a;font-style:italic}
.wall .who .dose{display:block;font-size:20px;font-weight:900;color:#111;font-style:normal;margin-top:2px}
.wall .who .where{display:flex;flex-direction:column;min-width:0}
.wall .list{display:flex;flex-direction:column;gap:12px}
.wall .item{display:flex;align-items:baseline;gap:16px;font-size:26px;line-height:1.25}
.wall .item .t{width:118px;flex:none;font-weight:900;font-variant-numeric:tabular-nums}
.wall .item .t.dim{color:#7a7a7a;font-weight:700}
.wall .who2{color:#7a7a7a;font-size:21px}
.wall .dinner{border:3px solid #111;border-radius:18px;padding:16px 20px;display:flex;align-items:center;gap:18px}
.wall .dinner .k{font-size:20px;font-weight:900;text-transform:uppercase;letter-spacing:.1em;color:#7a7a7a}
.wall .dinner .v{font-size:30px;font-weight:900}
.wall .dinner .s{font-size:20px;color:#7a7a7a;margin-left:auto}
.wall .todo{display:flex;flex-direction:column;gap:10px}
.wall .todo .row{display:flex;align-items:center;gap:14px;font-size:25px}
.wall .box{width:30px;height:30px;border:3px solid #111;border-radius:7px;flex:none;position:relative;background:#fff}
.wall .box.done{background:#111}
.wall .box.done::after{content:'';position:absolute;left:9px;top:3px;width:8px;height:14px;border:solid #f7f7f4;border-width:0 4px 4px 0;transform:rotate(45deg)}
.wall .row.done{color:#7a7a7a;text-decoration:line-through}
.wall .row.overdue .tag{font-size:15px;font-weight:900;text-transform:uppercase;letter-spacing:.08em;color:#3a3a3a;border:2px solid #3a3a3a;border-radius:6px;padding:1px 6px;margin-left:auto}
.wall .week{display:flex;flex-direction:column;flex:1;min-height:0;border:3px solid #111;border-radius:18px;overflow:hidden}
.wall .day{display:grid;grid-template-columns:150px 1fr;gap:0 18px;padding:12px 18px;border-bottom:2px solid #b8b8b8;flex:1;min-height:0;align-content:start}
.wall .day:last-child{border-bottom:0}
.wall .day.today{background:#e2e2e2}
.wall .day.off{background:repeating-linear-gradient(135deg,transparent 0 10px,#e8e8e8 10px 13px)}
.wall .day.today.off{background:#e2e2e2}
.wall .day .h{font-family:Quicksand,system-ui,sans-serif;font-weight:700;font-size:20px;line-height:1.1;display:flex;flex-direction:column;gap:4px}
.wall .day .h b{font-size:36px}
.wall .day.today .h b{background:#111;color:#f7f7f4;border-radius:999px;padding:4px 12px;align-self:flex-start}
.wall .offtag{font-size:14px;font-weight:900;text-transform:uppercase;letter-spacing:.06em;color:#7a7a7a;margin-top:6px}
.wall .items{display:flex;flex-wrap:wrap;gap:8px 10px;align-content:flex-start}
.wall .ev{font-size:21px;line-height:1.15;padding:8px 12px;border-radius:9px;border:2px solid #111;font-weight:800;background:#fff;max-width:100%}
.wall .ev.kid{border-style:dashed}
.wall .ev .tm{color:#7a7a7a;font-weight:700;font-size:17px;margin-left:8px;white-space:nowrap}
.wall .ev.task{border:0;background:transparent;font-weight:700;color:#3a3a3a;display:inline-flex;gap:8px;align-items:center;padding:8px 4px}
.wall .ev.task::before{content:'';width:18px;height:18px;border:2px solid #3a3a3a;border-radius:5px;flex:none;background:#fff}
.wall .empty{color:#b8b8b8;font-size:20px;padding:8px 0}
.wall .legend{display:flex;gap:22px;font-size:17px;color:#7a7a7a;align-items:center;flex-wrap:wrap}
.wall .sw{display:inline-block;width:26px;height:16px;border:2px solid #111;border-radius:4px;vertical-align:middle;margin-right:6px;background:#fff}
.wall .sw.dash{border-style:dashed}
.wall .sw.hatch{background:repeating-linear-gradient(135deg,transparent 0 5px,#e2e2e2 5px 7px);border-color:#b8b8b8}
.wall .up{display:flex;flex-direction:column;gap:12px}
.wall .up .row{display:grid;grid-template-columns:118px 1fr;gap:14px;font-size:23px;line-height:1.25;align-items:baseline}
.wall .up .d{font-weight:900;font-variant-numeric:tabular-nums;white-space:nowrap}
.wall .up .d small{display:block;font-size:14px;color:#7a7a7a;font-weight:800;text-transform:uppercase;letter-spacing:.06em}
.wall .up .w{color:#3a3a3a}
.wall .up .w b{color:#111;font-weight:900}
.wall .kidhead{display:flex;align-items:center;gap:12px;font-size:24px;font-weight:900;margin-top:4px}
.wall .kidhead .av{width:40px;height:40px;font-size:20px;border-style:dashed}
.wall .chores{display:flex;flex-direction:column;gap:9px;margin-top:10px}
.wall .chores .row{display:flex;align-items:center;gap:14px;font-size:24px}
.wall .foot{margin-top:auto;font-size:16px;color:#7a7a7a;display:flex;justify-content:space-between}
.wall .err{grid-column:1/-1;display:grid;place-items:center;font-size:40px;color:#3a3a3a;text-align:center;padding:80px}
`;

/**
 * The wall display: a fixed 1872×1404 page in black, white and greys, scaled
 * to whatever window shows it, refreshed every half hour. Reached by
 * /wall?token=… with no sign-in; the token is the household's.
 */
export function WallScreen({ token }: { token: string }) {
  const [tick, setTick] = useState(0);
  const dayStart = startOfToday();
  const { data, error, isLoading } = trpc.wall.snapshot.useQuery(
    { token, dayStart: dayStart.toISOString(), weekStartsOn: 1 },
    { refetchInterval: REFRESH_MS, refetchOnWindowFocus: false },
  );
  // Re-render at midnight so "today" moves without a reload.
  useEffect(() => {
    const t = setInterval(() => setTick((n) => n + 1), 60_000);
    return () => clearInterval(t);
  }, []);
  void tick;

  const [scale, setScale] = useState(1);
  useEffect(() => {
    const fit = () => setScale(Math.min(window.innerWidth / W, window.innerHeight / H));
    fit();
    window.addEventListener('resize', fit);
    return () => window.removeEventListener('resize', fit);
  }, []);

  const today = new Date();
  const dateLine = today.toLocaleDateString([], { weekday: 'long', day: 'numeric', month: 'long' });
  const weekLabel = (() => {
    if (!data) return '';
    const a = data.week[0]!.date;
    const b = data.week[6]!.date;
    const f = (k: string) =>
      new Date(`${k}T00:00:00`).toLocaleDateString([], { day: 'numeric', month: 'short' });
    return `${f(a)} – ${f(b)}`;
  })();

  return (
    <div style={{ background: '#111', minHeight: '100vh', overflow: 'hidden' }}>
      <style>{css}</style>
      <div className="wall" style={{ transform: `scale(${scale})` }}>
        {error ? (
          <div className="err">{error.message}</div>
        ) : isLoading || !data ? (
          <div className="err">Loading…</div>
        ) : (
          <>
            <div className="top">
              <div className="date">
                {dateLine}
                <small>{data.household}</small>
              </div>
              <div className="tr">
                {data.today.dinner ? (
                  <>
                    <b>Dinner:</b> {data.today.dinner.name}
                    {data.today.dinner.leftover ? ' (leftovers)' : ''}
                  </>
                ) : (
                  'No dinner planned yet'
                )}
                <br />
                {data.today.events.length} on today · {data.today.due.filter((d) => !d.done).length}{' '}
                to do
              </div>
            </div>

            <div className="col">
              <div>
                <h2>Where everyone is</h2>
                <div className="who">
                  {data.grownUps.map((a) => (
                    <div key={a.id} className={`row${a.off ? ' off' : ''}`}>
                      <span className="av">{a.avatarEmoji}</span>
                      <span className="name">{a.name.split(' ')[0]}</span>
                      <span className="where">
                        {a.off
                          ? 'Day off'
                          : `${a.place}${a.startTime ? ` · ${fmtRange(a.startTime, a.endTime)}` : ''}`}
                      </span>
                    </div>
                  ))}
                  {data.kids.map((k) => (
                    <div key={k.id} className={`row${k.offReason || !k.place ? ' off' : ''}`}>
                      <span className="av kid">{k.emojiIcon}</span>
                      <span className="name">{k.name.split(' ')[0]}</span>
                      <span className="where">
                        {k.offReason
                          ? k.offReason
                          : k.place
                            ? `${k.place}${k.startTime ? ` · ${fmtRange(k.startTime, k.endTime)}` : ''}`
                            : 'Nothing on today'}
                        {k.doses.map((d) => (
                          <span key={d.medicine} className="dose">
                            💊 {d.medicine} {fmtTime(d.givenAt)}
                            {d.nextFrom
                              ? new Date(d.nextFrom) <= new Date()
                                ? ' · next OK now'
                                : ` · next from ${fmtTime(d.nextFrom)}`
                              : ''}
                          </span>
                        ))}
                      </span>
                    </div>
                  ))}
                  {data.grownUps.length === 0 && data.kids.length === 0 && (
                    <div className="empty">Set work weeks and kids' weeks under Family.</div>
                  )}
                </div>
              </div>
              <div>
                <h2>On today</h2>
                <div className="list">
                  {data.today.birthdays.map((b) => (
                    <div key={b.id} className="item">
                      <span className="t dim">All day</span>
                      <span>
                        🎂 {b.name}
                        {b.age ? ` turns ${b.age}` : ''}
                      </span>
                    </div>
                  ))}
                  {data.today.events.map((e) => (
                    <div key={e.id} className="item">
                      <span className={`t${e.time ? '' : ' dim'}`}>
                        {e.time ? fmtTime(e.time) : 'All day'}
                      </span>
                      <span>
                        {e.title}
                        {e.who ? <span className="who2"> · {e.who}</span> : null}
                      </span>
                    </div>
                  ))}
                  {data.today.events.length === 0 && data.today.birthdays.length === 0 && (
                    <div className="empty">Nothing on. Enjoy it.</div>
                  )}
                </div>
              </div>
              {data.today.dinner && (
                <div className="dinner">
                  <span className="k">Dinner</span>
                  <span className="v">{data.today.dinner.name}</span>
                  <span className="s">
                    {data.today.dinner.leftover
                      ? `Leftovers, night ${data.today.dinner.night}`
                      : 'Cooking tonight'}
                  </span>
                </div>
              )}
              <div>
                <h2>
                  Due today{' '}
                  <span className="n">{data.today.due.filter((d) => !d.done).length}</span>
                </h2>
                <div className="todo">
                  {data.today.due.slice(0, 8).map((t) => (
                    <div
                      key={t.id}
                      className={`row${t.done ? ' done' : ''}${t.overdue ? ' overdue' : ''}`}
                    >
                      <span className={`box${t.done ? ' done' : ''}`} />
                      {t.title}
                      {t.overdue && !t.done && <span className="tag">overdue</span>}
                    </div>
                  ))}
                  {data.today.due.length === 0 && <div className="empty">All clear.</div>}
                </div>
              </div>
            </div>

            <div className="col">
              <h2>
                This week <span className="n">{weekLabel}</span>
              </h2>
              <div className="week">
                {data.week.map((d) => (
                  <div
                    key={d.date}
                    className={`day${d.isToday ? ' today' : ''}${d.off.length ? ' off' : ''}`}
                  >
                    <div className="h">
                      <span>
                        {new Date(`${d.date}T00:00:00`).toLocaleDateString([], {
                          weekday: 'short',
                        })}
                      </span>
                      <b>{new Date(`${d.date}T00:00:00`).getDate()}</b>
                      {d.off.map((a) => (
                        <span key={a.id} className="offtag">
                          {a.avatarEmoji} {a.name} off
                        </span>
                      ))}
                    </div>
                    <div className="items">
                      {d.birthdays.map((b) => (
                        <span key={b.id} className="ev">
                          🎂 {b.name}
                        </span>
                      ))}
                      {d.events.map((e) => (
                        <span key={e.id} className={`ev${e.forKid ? ' kid' : ''}`}>
                          {e.title}
                          {(e.time || e.who) && (
                            <span className="tm">
                              {[e.time ? fmtTime(e.time) : null, e.who].filter(Boolean).join(' · ')}
                            </span>
                          )}
                        </span>
                      ))}
                      {d.tasks.map((t) => (
                        <span key={t.id} className="ev task">
                          {t.title}
                        </span>
                      ))}
                      {d.events.length === 0 &&
                        d.tasks.length === 0 &&
                        d.birthdays.length === 0 && <span className="empty">—</span>}
                    </div>
                  </div>
                ))}
              </div>
              <div className="legend">
                <span>
                  <span className="sw" />
                  Event
                </span>
                <span>
                  <span className="sw dash" />
                  Kids' event
                </span>
                <span>
                  <span className="sw hatch" />
                  Grown-up's day off
                </span>
                <span>☐ Task due</span>
              </div>
            </div>

            <div className="col">
              <div>
                <h2>
                  Coming up for the kids <span className="n">3 weeks</span>
                </h2>
                <div className="up">
                  {data.kidsAhead.map((e) => (
                    <div key={e.id} className="row">
                      <span className="d">
                        {shortDay(e.date)}
                        <small>{whenLabel(e.date, dayStart)}</small>
                      </span>
                      <span className="w">
                        <b>{e.title}</b>
                        {e.who ? ` · ${e.who}` : ''}
                        {e.time ? ` · ${fmtTime(e.time)}` : ''}
                        {e.endDate && e.endDate !== e.date ? ` · until ${shortDay(e.endDate)}` : ''}
                      </span>
                    </div>
                  ))}
                  {data.kidsAhead.length === 0 && <div className="empty">Nothing booked in.</div>}
                </div>
              </div>
              {data.kidJobs.map((k) => (
                <div key={k.id}>
                  <div className="kidhead">
                    <span className="av kid">{k.avatarEmoji}</span>
                    {k.name.split(' ')[0]}'s jobs
                  </div>
                  <div className="chores">
                    {k.jobs.map((j) => (
                      <div key={j.id} className="row">
                        <span className="box" />
                        {j.title}
                      </div>
                    ))}
                    {k.jobs.length === 0 && <div className="empty">Nothing to do. Lucky.</div>}
                  </div>
                </div>
              ))}
              <div className="foot">
                <span>
                  Updated{' '}
                  {new Date(data.generatedAt).toLocaleTimeString([], {
                    hour: 'numeric',
                    minute: '2-digit',
                  })}
                </span>
                <span>Refreshes every 30 min</span>
              </div>
            </div>
          </>
        )}
      </div>
    </div>
  );
}
