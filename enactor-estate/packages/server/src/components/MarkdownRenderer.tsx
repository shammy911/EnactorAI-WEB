"use client";

import React, { useState } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Prism as SyntaxHighlighter } from "react-syntax-highlighter";
import { vscDarkPlus } from "react-syntax-highlighter/dist/esm/styles/prism";
import { Download, Copy, Check } from "lucide-react";

interface MarkdownRendererProps {
  content: string;
}

function CodeBlock({ match, codeString, isXml, props }: any) {
  const [copied, setCopied] = useState(false);

  const handleCopy = () => {
    navigator.clipboard.writeText(codeString);
    setCopied(true);
    setTimeout(() => setCopied(false), 2000);
  };

  const handleDownload = (codeContent: string) => {
    const matchFilename = codeContent.match(
      /<!--\s*filename:\s*([a-zA-Z0-9_.-]+)\s*-->/i,
    );
    const fileName = matchFilename ? matchFilename[1] : "estate_config.xml";

    const blob = new Blob([codeContent], { type: "application/xml" });
    const url = URL.createObjectURL(blob);
    const a = document.createElement("a");
    a.href = url;
    a.download = fileName;
    a.click();
    URL.revokeObjectURL(url);
  };

  return (
    <div className="relative group my-4 rounded-md overflow-hidden bg-[#1E1E1E] border border-border">
      <div className="flex items-center justify-between px-4 py-1.5 bg-[#2D2D2D] text-xs text-muted-foreground border-b border-border">
        <span className="uppercase font-semibold tracking-wider">
          {match[1]}
        </span>

        <div className="flex items-center gap-2">
          <button
            onClick={handleCopy}
            className="flex items-center gap-1.5 text-muted-foreground hover:text-foreground transition-colors py-1 px-2 rounded-md hover:bg-white/10"
            title="Copy code"
          >
            {copied ? (
              <Check size={14} className="text-emerald-400" />
            ) : (
              <Copy size={14} />
            )}
            <span>{copied ? "Copied!" : "Copy"}</span>
          </button>

          {isXml && (
            <button
              onClick={() => handleDownload(codeString)}
              className="flex items-center gap-1.5 text-emerald-400 hover:text-emerald-300 transition-colors py-1 px-2 rounded-md hover:bg-emerald-400/10"
              title="Download XML Configuration"
            >
              <Download size={14} />
              <span>Download</span>
            </button>
          )}
        </div>
      </div>
      <div className="max-h-96 overflow-y-auto overflow-x-auto">
        <SyntaxHighlighter
          style={vscDarkPlus as any}
          language={match[1]}
          PreTag="div"
          wrapLongLines={false}
          customStyle={{
            margin: 0,
            background: "transparent",
            whiteSpace: "pre",
            wordBreak: "normal",
            overflowWrap: "normal",
          }}
          {...props}
        >
          {codeString}
        </SyntaxHighlighter>
      </div>
    </div>
  );
}

export function MarkdownRenderer({ content }: MarkdownRendererProps) {
  return (
    <div className="max-w-none break-words text-sm leading-relaxed space-y-4">
      <ReactMarkdown
        remarkPlugins={[remarkGfm]}
        components={{
          code({ node, inline, className, children, ...props }: any) {
            const match = /language-(\w+)/.exec(className || "");
            const codeString = String(children).replace(/\n$/, "");
            const isXml = match && match[1].toLowerCase() === "xml";

            if (!inline && match) {
              return (
                <CodeBlock
                  match={match}
                  codeString={codeString}
                  isXml={isXml}
                  props={props}
                />
              );
            }

            return (
              <code
                className="bg-muted text-foreground rounded px-1.5 py-0.5 font-mono text-[0.85em]"
                {...props}
              >
                {children}
              </code>
            );
          },
          a: ({ node, ...props }) => (
            <a className="text-brand hover:underline font-medium" {...props} />
          ),
          p: ({ node, ...props }) => <p className="last:mb-0" {...props} />,
          ul: ({ node, ...props }) => (
            <ul className="list-disc pl-5 space-y-1" {...props} />
          ),
          ol: ({ node, ...props }) => (
            <ol className="list-decimal pl-5 space-y-1" {...props} />
          ),
          h1: ({ node, ...props }) => (
            <h1 className="text-xl font-bold mt-6 mb-3" {...props} />
          ),
          h2: ({ node, ...props }) => (
            <h2 className="text-lg font-bold mt-5 mb-2" {...props} />
          ),
          h3: ({ node, ...props }) => (
            <h3 className="text-base font-bold mt-4 mb-2" {...props} />
          ),
          table: ({ node, ...props }) => (
            <div className="overflow-x-auto my-4 rounded-md border border-border">
              <table
                className="w-full text-left border-collapse text-sm"
                {...props}
              />
            </div>
          ),
          thead: ({ node, ...props }) => (
            <thead className="bg-muted/50 text-muted-foreground" {...props} />
          ),
          th: ({ node, ...props }) => (
            <th
              className="px-4 py-2 font-semibold border-b border-border"
              {...props}
            />
          ),
          td: ({ node, ...props }) => (
            <td
              className="px-4 py-2 border-b border-border"
              {...props}
            />
          ),
          tr: ({ node, ...props }) => (
            <tr className="hover:bg-muted/50 transition-colors" {...props} />
          ),
        }}
      >
        {content}
      </ReactMarkdown>
    </div>
  );
}
