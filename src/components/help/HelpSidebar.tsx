import { helpSections } from "../../data/helpContent";
import { cn } from "../ui/utils";

interface HelpSidebarProps {
  activeSection: string;
  onSectionClick: (sectionId: string) => void;
}

export function HelpSidebar({ activeSection, onSectionClick }: HelpSidebarProps) {
  return (
    <nav className="space-y-1">
      <p className="text-xs font-semibold text-zinc-500 uppercase tracking-wider px-3 mb-3">
        Help Topics
      </p>
      {helpSections.map((section) => {
        const isActive = activeSection === section.id;
        const Icon = section.icon;

        return (
          <button
            key={section.id}
            onClick={() => onSectionClick(section.id)}
            className={cn(
              "flex items-center gap-3 w-full px-3 py-2 rounded-lg text-left text-sm transition-colors",
              isActive
                ? "bg-emerald-500/10 text-emerald-400"
                : "text-zinc-400 hover:text-zinc-200 hover:bg-zinc-800/50"
            )}
          >
            <Icon className={cn(
              "h-4 w-4 shrink-0",
              isActive ? "text-emerald-500" : "text-zinc-500"
            )} />
            <span className="truncate">{section.title}</span>
          </button>
        );
      })}
    </nav>
  );
}
