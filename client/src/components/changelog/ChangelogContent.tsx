import ReactMarkdown from 'react-markdown';
import remarkGfm from 'remark-gfm';

export interface ChangelogContentProps {
  markdown: string;
}

export function ChangelogContent({ markdown }: ChangelogContentProps) {
  return (
    <article className="prose prose-neutral max-w-none prose-headings:scroll-mt-24 prose-a:text-primary hover:prose-a:opacity-80">
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
