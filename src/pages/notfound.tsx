import { Link } from 'react-router-dom';
import { ArrowLeft, Compass } from 'lucide-react';
import { Button } from '../components/ui';

export function NotFoundPage() {
  return (
    <section className="mx-auto flex max-w-2xl flex-col items-start px-5 py-20 sm:py-28">
      <span className="flex h-10 w-10 items-center justify-center rounded-full border border-rule bg-surface text-graphite">
        <Compass size={18} />
      </span>
      <p className="eyebrow mt-5">404</p>
      <h1 className="mt-2 font-display text-[36px] leading-tight text-ink">This page is not here.</h1>
      <p className="mt-3 max-w-[52ch] text-[14px] leading-relaxed text-graphite">
        The link may be old, or the role may have been closed. The careers page and the workspace are both one click away.
      </p>
      <div className="mt-6 flex flex-wrap gap-2">
        <Link to="/"><Button variant="primary" icon={<ArrowLeft size={14} />}>Home</Button></Link>
        <Link to="/careers"><Button>Open roles</Button></Link>
        <Link to="/login"><Button variant="ghost">Sign in</Button></Link>
      </div>
    </section>
  );
}
