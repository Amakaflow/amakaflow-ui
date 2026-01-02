import { forwardRef, useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import type { HelpSection as HelpSectionType } from "../../data/helpContent";
import { ScreenshotPlaceholder } from "./ScreenshotPlaceholder";

interface HelpSectionProps {
  section: HelpSectionType;
}

export const HelpSection = forwardRef<HTMLElement, HelpSectionProps>(
  ({ section }, ref) => {
    return (
      <section
        ref={ref}
        id={section.id}
        className="scroll-mt-24"
      >
        {/* Section Header */}
        <div className="flex items-center gap-3 mb-6">
          <div className="flex h-10 w-10 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-500">
            <section.icon className="h-5 w-5" />
          </div>
          <h2 className="text-2xl font-semibold text-zinc-100">
            {section.title}
          </h2>
        </div>

        {/* Markdown Content */}
        <div className="prose prose-invert prose-zinc max-w-none">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={{
              // Headings
              h2: ({ children }) => (
                <h3 className="text-xl font-semibold text-zinc-100 mt-8 mb-4 first:mt-0">
                  {children}
                </h3>
              ),
              h3: ({ children }) => (
                <h4 className="text-lg font-medium text-zinc-200 mt-6 mb-3">
                  {children}
                </h4>
              ),
              h4: ({ children }) => (
                <h5 className="text-base font-medium text-zinc-300 mt-4 mb-2">
                  {children}
                </h5>
              ),
              // Paragraphs
              p: ({ children }) => (
                <p className="text-zinc-300 leading-relaxed mb-4">
                  {children}
                </p>
              ),
              // Lists
              ul: ({ children }) => (
                <ul className="list-disc list-inside space-y-2 text-zinc-300 mb-4 ml-2">
                  {children}
                </ul>
              ),
              ol: ({ children }) => (
                <ol className="list-decimal list-inside space-y-2 text-zinc-300 mb-4 ml-2">
                  {children}
                </ol>
              ),
              li: ({ children }) => (
                <li className="text-zinc-300">
                  {children}
                </li>
              ),
              // Code
              code: ({ children, className }) => {
                const isBlock = className?.includes("language-");
                if (isBlock) {
                  return (
                    <code className="block bg-zinc-900 rounded-lg p-4 text-sm font-mono text-zinc-300 overflow-x-auto">
                      {children}
                    </code>
                  );
                }
                return (
                  <code className="bg-zinc-800 rounded px-1.5 py-0.5 text-sm font-mono text-emerald-400">
                    {children}
                  </code>
                );
              },
              pre: ({ children }) => (
                <pre className="bg-zinc-900 rounded-lg p-4 mb-4 overflow-x-auto">
                  {children}
                </pre>
              ),
              // Tables
              table: ({ children }) => (
                <div className="overflow-x-auto mb-4">
                  <table className="min-w-full divide-y divide-zinc-700">
                    {children}
                  </table>
                </div>
              ),
              thead: ({ children }) => (
                <thead className="bg-zinc-800/50">
                  {children}
                </thead>
              ),
              th: ({ children }) => (
                <th className="px-4 py-3 text-left text-sm font-semibold text-zinc-200">
                  {children}
                </th>
              ),
              td: ({ children }) => (
                <td className="px-4 py-3 text-sm text-zinc-300 border-b border-zinc-800">
                  {children}
                </td>
              ),
              // Blockquotes
              blockquote: ({ children }) => (
                <blockquote className="border-l-4 border-emerald-500 pl-4 my-4 text-zinc-400 italic">
                  {children}
                </blockquote>
              ),
              // Links
              a: ({ href, children }) => (
                <a
                  href={href}
                  className="text-emerald-400 hover:text-emerald-300 underline underline-offset-2"
                >
                  {children}
                </a>
              ),
              // Inline Images
              img: ({ src, alt }) => (
                <InlineScreenshot src={src || ""} alt={alt || ""} />
              ),
              // Strong/Bold
              strong: ({ children }) => (
                <strong className="font-semibold text-zinc-100">
                  {children}
                </strong>
              ),
              // Horizontal Rule
              hr: () => (
                <hr className="my-8 border-zinc-800" />
              ),
            }}
          >
            {section.content}
          </ReactMarkdown>
        </div>

      </section>
    );
  }
);

HelpSection.displayName = "HelpSection";

// Screenshot image component with fallback (for grid display)
function ScreenshotImage({ filename }: { filename: string }) {
  const [error, setError] = useState(false);
  const imagePath = `/help/${filename}`;

  if (error) {
    return <ScreenshotPlaceholder filename={filename} />;
  }

  return (
    <div className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900">
      <img
        src={imagePath}
        alt={filename.replace(/\.[^/.]+$/, "").replace(/-/g, " ")}
        className="w-full h-auto"
        onError={() => setError(true)}
      />
    </div>
  );
}

// Inline screenshot component for markdown images
function InlineScreenshot({ src, alt }: { src: string; alt: string }) {
  const [error, setError] = useState(false);
  const filename = src.split("/").pop() || src;

  // Detect iPhone/mobile screenshots for smaller sizing
  const isMobileScreenshot =
    filename.startsWith("ios-") ||
    filename.startsWith("testflight-") ||
    filename.startsWith("remote-") ||
    filename.startsWith("watch-");

  if (error) {
    return (
      <div className="my-6">
        <ScreenshotPlaceholder filename={filename} />
      </div>
    );
  }

  return (
    <figure className="my-6">
      <div
        className="rounded-lg overflow-hidden border border-zinc-800 bg-zinc-900"
        style={{ width: isMobileScreenshot ? '180px' : undefined, maxWidth: isMobileScreenshot ? '180px' : '672px' }}
      >
        <img
          src={src}
          alt={alt}
          className="w-full h-auto"
          onError={() => setError(true)}
        />
      </div>
      {alt && (
        <figcaption className="mt-2 text-sm text-zinc-500 italic" style={{ maxWidth: isMobileScreenshot ? '180px' : '672px' }}>
          {alt}
        </figcaption>
      )}
    </figure>
  );
}
