/** Home section heading: a numbered mono eyebrow, a large title and an optional one-line lede. */
export function SectionHeading({
  index,
  eyebrow,
  title,
  lede,
  id,
}: {
  index: string;
  eyebrow: string;
  title: string;
  lede?: string;
  id?: string;
}) {
  return (
    <div className="max-w-3xl">
      <p className="flex items-center gap-3 font-mono text-xs uppercase tracking-[0.25em] text-accent-bright">
        <span>{index}</span>
        <span aria-hidden="true" className="h-px w-10 bg-accent-bright/60" />
        <span>{eyebrow}</span>
      </p>
      <h2 id={id} className="mt-4 text-3xl font-semibold tracking-tight text-text md:text-5xl">
        {title}
      </h2>
      {lede ? <p className="mt-4 text-lg text-muted">{lede}</p> : null}
    </div>
  );
}
