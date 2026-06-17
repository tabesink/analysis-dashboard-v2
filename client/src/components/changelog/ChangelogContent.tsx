import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';
import { cn } from '@/lib/utils';

export interface ChangelogContentProps {
  markdown: string;
  className?: string;
}

export function ChangelogContent({ markdown, className }: ChangelogContentProps) {
  return (
    <article
      className={cn(
        'prose prose-sm prose-neutral max-w-none leading-relaxed prose-headings:scroll-mt-24 prose-headings:font-semibold prose-p:leading-relaxed prose-a:text-primary hover:prose-a:opacity-80',
        className,
      )}
    >
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          a: ({ href, children, ...props }) => {
            const isExternal = Boolean(href && /^https?:\/\//.test(href));
            if (!href) {
              return <a {...props}>{children}</a>;
            }

            if (isExternal) {
              return (
                <a href={href} target="_blank" rel="noreferrer" {...props}>
                  {children}
                </a>
              );
            }

            return (
              <a href={href} {...props}>
                {children}
              </a>
            );
          },
        }}
      >
        {markdown}
      </ReactMarkdown>
    </article>
  );
}
