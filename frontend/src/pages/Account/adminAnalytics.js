const normalize = (value) => String(value ?? '').normalize('NFKC').trim().toLocaleLowerCase();

// Calendar-day boundaries keep today's records in the selected period in any timezone.
export function enrollmentAnalytics(records, courses, days, now = new Date()) {
  const start = new Date(now);
  start.setHours(0, 0, 0, 0);
  start.setDate(start.getDate() - days + 1);
  const end = new Date(now);
  const selected = records.filter((record) => {
    const timestamp = new Date(record.createdAt).getTime();
    return record.type === 'course' && timestamp >= start.getTime() && timestamp <= end.getTime();
  });
  const step = Math.ceil(days / 7);
  const timeline = [];
  for (let offset = 0; offset < days; offset += step) {
    const from = new Date(start);
    from.setDate(from.getDate() + offset);
    const until = new Date(start);
    until.setDate(until.getDate() + Math.min(offset + step, days));
    const last = new Date(until);
    last.setDate(last.getDate() - 1);
    timeline.push({ from, last, count: selected.filter((record) => {
      const timestamp = new Date(record.createdAt).getTime();
      return timestamp >= from.getTime() && timestamp < until.getTime();
    }).length });
  }
  const courseCounts = courses.map((course) => {
    const aliases = new Set([course.id, course.title?.mn, course.title?.en].filter(Boolean).map(normalize));
    return { ...course, count: selected.filter((record) => record.items.some((item) => aliases.has(normalize(item)))).length };
  });
  return {
    selected,
    timeline,
    courseCounts,
    learners: new Set(selected.map((record) => record.userId).filter(Boolean)).size,
    pending: selected.filter((record) => record.status === 'new').length,
    completed: selected.filter((record) => record.status === 'done').length,
  };
}
