import { useState, useMemo } from "react";
import ReactMarkdown from "react-markdown";
import remarkGfm from "remark-gfm";
import { Search } from "lucide-react";
import { cn } from "@/lib/utils";
import { helpTopics } from "@/help/topics";
import type { Components } from "react-markdown";

const markdownComponents: Components = {
  h1: ({ children }) => (
    <h1 className="text-2xl font-bold mb-4 text-foreground">{children}</h1>
  ),
  h2: ({ children }) => (
    <h2 className="text-lg font-semibold mt-8 mb-3 text-foreground border-b pb-2">{children}</h2>
  ),
  h3: ({ children }) => (
    <h3 className="text-base font-medium mt-5 mb-2 text-foreground">{children}</h3>
  ),
  p: ({ children }) => (
    <p className="text-sm text-muted-foreground mb-3 leading-relaxed">{children}</p>
  ),
  ul: ({ children }) => (
    <ul className="text-sm list-disc pl-5 mb-3 space-y-1 text-muted-foreground">{children}</ul>
  ),
  ol: ({ children }) => (
    <ol className="text-sm list-decimal pl-5 mb-3 space-y-1 text-muted-foreground">{children}</ol>
  ),
  li: ({ children }) => <li className="leading-relaxed">{children}</li>,
  strong: ({ children }) => (
    <strong className="font-semibold text-foreground">{children}</strong>
  ),
  code: ({ children, className }) => {
    // Block code (has language class) vs inline code
    if (className) {
      return (
        <code className="block bg-muted p-3 rounded-md text-xs font-mono mb-3 overflow-x-auto">
          {children}
        </code>
      );
    }
    return (
      <code className="bg-muted px-1.5 py-0.5 rounded text-xs font-mono">{children}</code>
    );
  },
  pre: ({ children }) => <pre className="mb-3">{children}</pre>,
  blockquote: ({ children }) => (
    <blockquote className="border-l-4 border-primary/30 bg-primary/5 pl-4 pr-3 py-2 mb-3 rounded-r-md text-sm">
      {children}
    </blockquote>
  ),
  table: ({ children }) => (
    <div className="overflow-x-auto mb-4">
      <table className="w-full text-sm border-collapse">{children}</table>
    </div>
  ),
  thead: ({ children }) => (
    <thead className="bg-muted/50">{children}</thead>
  ),
  th: ({ children }) => (
    <th className="border px-3 py-2 text-left font-semibold text-foreground">{children}</th>
  ),
  td: ({ children }) => (
    <td className="border px-3 py-2 text-muted-foreground">{children}</td>
  ),
  hr: () => <hr className="my-6 border-border" />,
  a: ({ children, href }) => (
    <a href={href} className="text-primary underline hover:text-primary/80">{children}</a>
  ),
};

export function HelpPage() {
  const [selectedTopicId, setSelectedTopicId] = useState(helpTopics[0].id);
  const [searchQuery, setSearchQuery] = useState("");

  const filteredTopics = useMemo(() => {
    if (!searchQuery.trim()) return helpTopics;
    const q = searchQuery.toLowerCase();
    return helpTopics.filter(
      (t) =>
        t.label.toLowerCase().includes(q) ||
        t.content.toLowerCase().includes(q)
    );
  }, [searchQuery]);

  const selectedTopic = helpTopics.find((t) => t.id === selectedTopicId) ?? helpTopics[0];

  return (
    <div className="flex h-[calc(100vh-4rem)] overflow-hidden">
      {/* Sidebar */}
      <div className="w-56 shrink-0 border-r bg-muted/30 flex flex-col">
        {/* Search */}
        <div className="p-3 border-b">
          <div className="relative">
            <Search className="absolute left-2.5 top-2.5 h-4 w-4 text-muted-foreground" />
            <input
              type="text"
              placeholder="Search help..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="w-full rounded-md border bg-background pl-9 pr-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-ring"
            />
          </div>
        </div>

        {/* Topic List */}
        <nav className="flex-1 overflow-y-auto p-2 space-y-0.5">
          {filteredTopics.map((topic) => {
            const Icon = topic.icon;
            const isActive = topic.id === selectedTopicId;
            return (
              <button
                key={topic.id}
                onClick={() => setSelectedTopicId(topic.id)}
                className={cn(
                  "w-full flex items-center gap-2.5 rounded-md px-3 py-2 text-sm text-left transition-colors",
                  isActive
                    ? "bg-primary text-primary-foreground font-medium"
                    : "text-muted-foreground hover:bg-muted hover:text-foreground"
                )}
              >
                <Icon className="h-4 w-4 shrink-0" />
                <span className="truncate">{topic.label}</span>
              </button>
            );
          })}
          {filteredTopics.length === 0 && (
            <p className="px-3 py-4 text-sm text-muted-foreground text-center">
              No matching topics
            </p>
          )}
        </nav>
      </div>

      {/* Content */}
      <div className="flex-1 overflow-y-auto">
        <div className="max-w-3xl mx-auto px-8 py-6">
          <ReactMarkdown
            remarkPlugins={[remarkGfm]}
            components={markdownComponents}
          >
            {selectedTopic.content}
          </ReactMarkdown>
        </div>
      </div>
    </div>
  );
}
