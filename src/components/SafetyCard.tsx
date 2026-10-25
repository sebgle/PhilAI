// Shown when an entry's risk flag is set. Calm, not alarming; the entry stays
// private and sharing is turned off for it.
export function SafetyCard() {
  return (
    <aside className="rounded border border-sky-300/60 bg-sky-50 p-5 text-sky-950 dark:border-sky-400/30 dark:bg-sky-950/40 dark:text-sky-100">
      <h2 className="font-semibold">You don&apos;t have to hold this alone</h2>
      <p className="mt-2 text-sm leading-relaxed">
        It sounds like things might be really heavy right now. If you&apos;re thinking about
        hurting yourself or feel unsafe, you can reach the 988 Suicide &amp; Crisis Lifeline
        any time, 24/7 in the US.
      </p>
      <ul className="mt-3 flex flex-col gap-1 text-sm">
        <li><a href="tel:988" className="underline">Call 988</a></li>
        <li><a href="sms:988" className="underline">Text 988</a></li>
        <li>
          <a href="https://988lifeline.org/chat/" target="_blank" rel="noreferrer" className="underline">
            Chat online at 988lifeline.org
          </a>
        </li>
      </ul>
      <p className="mt-3 text-xs text-muted">
        This entry stays private, and sharing is turned off for it. PhilAI is a reflection
        space, not therapy or emergency help.
      </p>
    </aside>
  );
}
