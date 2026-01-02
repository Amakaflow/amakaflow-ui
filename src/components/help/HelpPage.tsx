import { useEffect, useRef, useState, useCallback } from "react";
import { ArrowLeft, Menu, X, Mail } from "lucide-react";
import { Button } from "../ui/button";
import { Sheet, SheetContent, SheetTrigger } from "../ui/sheet";
import { ScrollArea } from "../ui/scroll-area";
import { helpSections, supportEmail } from "../../data/helpContent";
import { HelpSidebar } from "./HelpSidebar";
import { HelpSection } from "./HelpSection";

interface HelpPageProps {
  onBack: () => void;
}

export function HelpPage({ onBack }: HelpPageProps) {
  const [activeSection, setActiveSection] = useState(helpSections[0].id);
  const [mobileMenuOpen, setMobileMenuOpen] = useState(false);
  const sectionRefs = useRef<Map<string, HTMLElement>>(new Map());
  const observerRef = useRef<IntersectionObserver | null>(null);

  // Set up intersection observer for scroll-spy
  useEffect(() => {
    observerRef.current = new IntersectionObserver(
      (entries) => {
        // Find the first section that is intersecting (visible)
        const visibleEntries = entries.filter((entry) => entry.isIntersecting);
        if (visibleEntries.length > 0) {
          // Sort by top position and take the topmost visible section
          const topmost = visibleEntries.reduce((prev, curr) => {
            return prev.boundingClientRect.top < curr.boundingClientRect.top
              ? prev
              : curr;
          });
          setActiveSection(topmost.target.id);
        }
      },
      {
        root: null,
        rootMargin: "-100px 0px -66% 0px",
        threshold: 0,
      }
    );

    // Observe all sections
    sectionRefs.current.forEach((element) => {
      if (element) {
        observerRef.current?.observe(element);
      }
    });

    return () => {
      observerRef.current?.disconnect();
    };
  }, []);

  // Handle section click - scroll to section
  const handleSectionClick = useCallback((sectionId: string) => {
    const element = sectionRefs.current.get(sectionId);
    if (element) {
      element.scrollIntoView({ behavior: "smooth", block: "start" });
      setActiveSection(sectionId);
      setMobileMenuOpen(false);
    }
  }, []);

  // Register section ref
  const registerSectionRef = useCallback(
    (id: string) => (element: HTMLElement | null) => {
      if (element) {
        sectionRefs.current.set(id, element);
        observerRef.current?.observe(element);
      }
    },
    []
  );

  return (
    <div className="min-h-screen bg-zinc-950">
      {/* Header */}
      <header className="sticky top-0 z-40 border-b border-zinc-800 bg-zinc-950/95 backdrop-blur supports-[backdrop-filter]:bg-zinc-950/80">
        <div className="flex h-14 items-center px-4 lg:px-6">
          {/* Back button */}
          <Button
            variant="ghost"
            size="sm"
            onClick={onBack}
            className="mr-4 text-zinc-400 hover:text-zinc-100"
          >
            <ArrowLeft className="h-4 w-4 mr-2" />
            Back
          </Button>

          {/* Title */}
          <h1 className="text-lg font-semibold text-zinc-100">
            Help & Documentation
          </h1>

          {/* Mobile menu button */}
          <div className="ml-auto lg:hidden">
            <Sheet open={mobileMenuOpen} onOpenChange={setMobileMenuOpen}>
              <SheetTrigger asChild>
                <Button variant="ghost" size="icon" className="text-zinc-400">
                  <Menu className="h-5 w-5" />
                  <span className="sr-only">Open menu</span>
                </Button>
              </SheetTrigger>
              <SheetContent side="left" className="w-72 bg-zinc-900 border-zinc-800 p-0">
                <div className="flex items-center justify-between px-4 py-3 border-b border-zinc-800">
                  <span className="text-sm font-semibold text-zinc-100">
                    Help Topics
                  </span>
                  <Button
                    variant="ghost"
                    size="icon"
                    onClick={() => setMobileMenuOpen(false)}
                    className="text-zinc-400"
                  >
                    <X className="h-4 w-4" />
                  </Button>
                </div>
                <ScrollArea className="h-[calc(100vh-57px)] p-4">
                  <HelpSidebar
                    activeSection={activeSection}
                    onSectionClick={handleSectionClick}
                  />
                </ScrollArea>
              </SheetContent>
            </Sheet>
          </div>
        </div>
      </header>

      <div className="flex">
        {/* Desktop Sidebar */}
        <aside className="hidden lg:block w-64 shrink-0 border-r border-zinc-800">
          <div className="sticky top-14 h-[calc(100vh-3.5rem)] overflow-hidden">
            <ScrollArea className="h-full py-6 px-4">
              <HelpSidebar
                activeSection={activeSection}
                onSectionClick={handleSectionClick}
              />

              {/* Support section */}
              <div className="mt-8 pt-6 border-t border-zinc-800">
                <p className="text-xs text-zinc-500 mb-3">Need more help?</p>
                <a
                  href={`mailto:${supportEmail}`}
                  className="flex items-center gap-2 text-sm text-emerald-400 hover:text-emerald-300"
                >
                  <Mail className="h-4 w-4" />
                  {supportEmail}
                </a>
              </div>
            </ScrollArea>
          </div>
        </aside>

        {/* Main Content */}
        <main className="flex-1 min-w-0">
          <div className="max-w-4xl mx-auto px-4 py-8 lg:px-8 lg:py-12">
            {/* Page intro */}
            <div className="mb-12">
              <h1 className="text-3xl font-bold text-zinc-100 mb-4">
                AmakaFlow Documentation
              </h1>
              <p className="text-zinc-400 text-lg">
                Everything you need to know about importing, managing, and syncing workouts across your devices.
              </p>
            </div>

            {/* Sections */}
            <div className="space-y-16">
              {helpSections.map((section) => (
                <HelpSection
                  key={section.id}
                  ref={registerSectionRef(section.id)}
                  section={section}
                />
              ))}
            </div>

            {/* Footer */}
            <footer className="mt-16 pt-8 border-t border-zinc-800">
              <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-4">
                <p className="text-sm text-zinc-500">
                  Still have questions? Contact us at{" "}
                  <a
                    href={`mailto:${supportEmail}`}
                    className="text-emerald-400 hover:text-emerald-300"
                  >
                    {supportEmail}
                  </a>
                </p>
                <Button
                  variant="outline"
                  onClick={onBack}
                  className="border-zinc-700 text-zinc-300 hover:bg-zinc-800"
                >
                  Back to App
                </Button>
              </div>
            </footer>
          </div>
        </main>
      </div>
    </div>
  );
}
