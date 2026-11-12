"use client";

import Link from "next/link";
import { usePathname, useRouter, useSearchParams } from "next/navigation";
import { useEffect, useMemo, useRef, useState, type KeyboardEvent as ReactKeyboardEvent, type ReactNode } from "react";
import { adminLocaleOptions, type AdminLocale } from "./admin-i18n";
import { useAdminWorkspace } from "./admin-workspace";
import { adminSidebarSections, sidebarItemIsActive } from "./admin-sidebar-sections";
import { AdminSubnavIcon, adminSubnavIconPaths } from "./admin-subnav-icons";

type NavItem = { href: string; label: string };
type Glyph = "dashboard" | "academic" | "accounts" | "staff" | "families" | "registrations" | "attendance" | "learning" | "communication" | "pilot" | "profile" | "search" | "menu" | "chevron" | "arrow" | "bell" | "logout" | "school" | "check" | "close";

const navIcons: Record<string, Glyph> = {
  "/admin/dashboard": "dashboard", "/admin/academics": "academic", "/admin/accounts": "accounts",
  "/admin/staff-work": "staff", "/admin/families": "families", "/admin/registrations": "registrations",
  "/admin/attendance": "attendance", "/admin/learning": "learning", "/admin/communication": "communication",
  "/admin/pilot": "pilot", "/admin/profile": "profile"
};

const iconPaths: Record<Glyph, string> = {
  dashboard: "M3 10.2 12 3l9 7.2V21h-6v-6H9v6H3V10.2z",
  academic: "m2 9 10-6 10 6-10 6L2 9zm4 4v5c3.5 3 8.5 3 12 0v-5M22 9v6",
  accounts: "M16 20v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2h14zM9 11a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm11 9v-2a4 4 0 0 0-3-3.9M16 3.1a4 4 0 0 1 0 7.8",
  staff: "M3 21h18M5 21V6l7-3 7 3v15M9 9h.01M15 9h.01M9 13h.01M15 13h.01M10 21v-4h4v4",
  families: "M16 19.5v-1.6a3.5 3.5 0 0 0-3.5-3.5H5.5A3.5 3.5 0 0 0 2 17.9v1.6M9 11.5a4 4 0 1 0 0-8 4 4 0 0 0 0 8zm13 8v-1.6a3.5 3.5 0 0 0-2.7-3.4M16 3.6a4 4 0 0 1 0 7.7",
  registrations: "M5 3h14v18H5zM8 8h8M8 12h6M8 16h4m3 0 2 2 3-4",
  attendance: "M8 2v4M16 2v4M3 10h18M5 4h14a2 2 0 0 1 2 2v14a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2V6a2 2 0 0 1 2-2zm4 12 2 2 4-5",
  learning: "M4 19.5C4 18 5 17 6.5 17H20M6.5 2H20v20H6.5A2.5 2.5 0 0 1 4 19.5v-15A2.5 2.5 0 0 1 6.5 2zM9 7h7M9 11h5",
  communication: "M20 11.5a8.5 8.5 0 0 1-8.5 8.5 9 9 0 0 1-4-.9L3 21l1.9-5.5a9 9 0 0 1-.9-4 8.5 8.5 0 0 1 8.5-8.5c4.7 0 8.5 3.8 8.5 8.5zM8 10.5h8M8 14h6",
  pilot: "M9.5 15.5 8 22l-4-4 6.5-1.5M14.5 9.5 21 8l-4-4-1.5 6.5M12 16l-4-4 4.5-6.5C15 2.5 18 2 22 2c0 4-.5 7-3.5 9.5L12 16zm-4 0-2 2",
  profile: "M12 13a5 5 0 1 0 0-10 5 5 0 0 0 0 10zM3 21a9 9 0 0 1 18 0H3z",
  search: "M11 19a8 8 0 1 0 0-16 8 8 0 0 0 0 16zm6-2 5 5",
  menu: "M4 7h16M4 12h16M4 17h16",
  chevron: "m7 10 5 5 5-5",
  arrow: "M5 12h14M13 6l6 6-6 6",
  bell: "M18 8a6 6 0 0 0-12 0c0 7-3 8-3 9h18c0-1-3-2-3-9M10 21h4",
  logout: "M9 4H5a2 2 0 0 0-2 2v12a2 2 0 0 0 2 2h4M16 16l4-4-4-4M9 12h11",
  school: "M3 20h18M5 20V8l7-4 7 4v12M9 11h.01M15 11h.01M9 15h.01M15 15h.01M10 20v-3h4v3",
  check: "m5 12 4 4 10-10",
  close: "M5 5l14 14M19 5 5 19"
};

function Icon({ name, size = 20 }: { name: Glyph; size?: number }) {
  return <svg width={size} height={size} viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="1.8"
    strokeLinecap="round" strokeLinejoin="round" aria-hidden="true"><path d={iconPaths[name]} /></svg>;
}

function activeRoute(pathname: string, href: string) {
  return pathname === href || pathname.startsWith(href + "/");
}

function UserAvatar({ name, url }: { name: string; url: string | null }) {
  const [failed, setFailed] = useState(false);
  useEffect(() => setFailed(false), [url]);
  return url && !failed
    ? <img className="ml-admin-user-avatar" src={url} alt="" onError={() => setFailed(true)} />
    : <span className="ml-admin-user-avatar ml-admin-user-avatar-fallback" aria-hidden="true">
        {name.trim().charAt(0).toUpperCase() || "A"}
      </span>;
}

export function AdminDashboardFrame({
  children, pathname, title, description, yearScoped, navItems
}: {
  children: ReactNode;
  pathname: string;
  title: string;
  description: string;
  yearScoped: boolean;
  navItems: readonly NavItem[];
}) {
  const router = useRouter();
  const currentPath = usePathname();
  const searchParams = useSearchParams();
  const searchTab = searchParams.get("tab");
  const { stored, locale, t, setLocale, signOut, adminProfile, academicYears,
    selectedAcademicYearId, setSelectedAcademicYearId } = useAdminWorkspace();
  const [compact, setCompact] = useState(false);
  const [mobileOpen, setMobileOpen] = useState(false);
  const sidebarRef = useRef<HTMLElement>(null);
  const menuButtonRef = useRef<HTMLButtonElement>(null);
  const [isMobileLayout, setIsMobileLayout] = useState(false);
  const [expandedGroup, setExpandedGroup] = useState<string | null>(
    () => Object.keys(adminSidebarSections).find((group) =>
      pathname === group || pathname.startsWith(group + "/")) ?? null
  );
  const [fragment, setFragment] = useState("");
  const [search, setSearch] = useState("");
  const [showResults, setShowResults] = useState(false);
  const [highlightedSearchIndex, setHighlightedSearchIndex] = useState(-1);
  const searchRef = useRef<HTMLInputElement>(null);
  const searchBoxRef = useRef<HTMLFormElement>(null);
  const userName = adminProfile.fullName || stored.session.user.username;

  const searchOptions = useMemo(() => {
    const items = [...navItems,
      ...Object.entries(adminSidebarSections).flatMap(([group, children]) =>
        children.map((child) => ({ ...child, label: navItems.find((item) =>
          item.href === group)?.label + " · " + child.label }))
      )];
    const q = search.trim().toLocaleLowerCase();
    if (!q) return items.slice(0, 7);
    return items.filter((item) =>
      item.label.toLocaleLowerCase().includes(q) ||
      t(item.label).toLocaleLowerCase().includes(q)
    ).slice(0, 9);
  }, [navItems, search, t]);

  useEffect(() => {
    setMobileOpen(false);
    setShowResults(false);
    const group = Object.keys(adminSidebarSections).find((item) =>
      pathname === item || pathname.startsWith(item + "/"));
    if (group) setExpandedGroup(group);
    setFragment(window.location.hash);
    const handleHash = () => setFragment(window.location.hash);
    window.addEventListener("hashchange", handleHash);
    return () => window.removeEventListener("hashchange", handleHash);
  }, [pathname]);

  // Restore the desktop icon-rail preference without changing mobile drawer state.
  useEffect(() => {
    try { setCompact(window.localStorage.getItem("maktablink.admin.sidebar.compact") === "true"); }
    catch { /* Storage can be disabled by a browser policy. */ }
  }, []);

  useEffect(() => {
    try { window.localStorage.setItem("maktablink.admin.sidebar.compact", String(compact)); }
    catch { /* The navigation remains usable without persistence. */ }
  }, [compact]);

  useEffect(() => {
    if (!isMobileLayout || !mobileOpen) return;
    const previousOverflow = document.body.style.overflow;
    document.body.style.overflow = "hidden";
    const first = sidebarRef.current?.querySelector<HTMLElement>(
      'a[href], button:not([disabled]), select'
    );
    first?.focus();
    return () => { document.body.style.overflow = previousOverflow; };
  }, [isMobileLayout, mobileOpen]);

  useEffect(() => {
    const mobileQuery = window.matchMedia("(max-width: 900px)");
    const syncLayout = () => {
      setIsMobileLayout(mobileQuery.matches);
      if (!mobileQuery.matches) setMobileOpen(false);
    };
    syncLayout();
    mobileQuery.addEventListener("change", syncLayout);
    return () => mobileQuery.removeEventListener("change", syncLayout);
  }, []);

  useEffect(() => {
    function onKeyDown(event: KeyboardEvent) {
      const target = event.target;
      const editable = target instanceof HTMLElement &&
        (["INPUT", "TEXTAREA", "SELECT"].includes(target.tagName) || target.isContentEditable);
      if ((event.ctrlKey || event.metaKey) && event.key.toLowerCase() === "k") {
        event.preventDefault();
        searchRef.current?.focus();
        setShowResults(true);
      } else if (event.key === "/" && !editable && !event.ctrlKey && !event.metaKey) {
        event.preventDefault();
        searchRef.current?.focus();
        setShowResults(true);
      } else if (event.key === "Escape") {
        setShowResults(false);
        setHighlightedSearchIndex(-1);
        if (mobileOpen) closeMobileSidebar(true);
        if (document.activeElement === searchRef.current) searchRef.current?.blur();
      }
    }
    function onPointerDown(event: PointerEvent) {
      if (event.target instanceof Node && !searchBoxRef.current?.contains(event.target)) {
        setShowResults(false);
      }
    }
    document.addEventListener("keydown", onKeyDown);
    document.addEventListener("pointerdown", onPointerDown);
    return () => {
      document.removeEventListener("keydown", onKeyDown);
      document.removeEventListener("pointerdown", onPointerDown);
    };
  }, [mobileOpen]);

  function closeMobileSidebar(restoreFocus = false) {
    setMobileOpen(false);
    if (restoreFocus) window.requestAnimationFrame(() => menuButtonRef.current?.focus());
  }

  function handleSidebarKeyDown(event: ReactKeyboardEvent<HTMLElement>) {
    if (!isMobileLayout || !mobileOpen || event.key !== "Tab") return;
    const focusable = Array.from(sidebarRef.current?.querySelectorAll<HTMLElement>(
      'a[href], button:not([disabled]), select, [tabindex]:not([tabindex="-1"])'
    ) ?? []).filter((element) => element.getClientRects().length > 0);
    if (!focusable.length) return;
    const first = focusable[0]!;
    const last = focusable[focusable.length - 1]!;
    if (event.shiftKey && document.activeElement === first) {
      event.preventDefault();
      last.focus();
    } else if (!event.shiftKey && document.activeElement === last) {
      event.preventDefault();
      first.focus();
    }
  }

  function handleSearchKeyDown(event: ReactKeyboardEvent<HTMLInputElement>) {
    if (event.key === "ArrowDown" || event.key === "ArrowUp") {
      event.preventDefault();
      setShowResults(true);
      if (!searchOptions.length) return;
      setHighlightedSearchIndex((current) => event.key === "ArrowDown"
        ? Math.min(searchOptions.length - 1, current + 1)
        : current <= 0 ? searchOptions.length - 1 : current - 1);
    } else if (event.key === "Home" && showResults) {
      event.preventDefault();
      setHighlightedSearchIndex(searchOptions.length ? 0 : -1);
    } else if (event.key === "End" && showResults) {
      event.preventDefault();
      setHighlightedSearchIndex(searchOptions.length - 1);
    } else if (event.key === "Enter" && showResults && highlightedSearchIndex >= 0) {
      const option = searchOptions[highlightedSearchIndex];
      if (option) {
        event.preventDefault();
        navigate(option.href);
      }
    } else if (event.key === "Escape") {
      setShowResults(false);
      setHighlightedSearchIndex(-1);
      event.stopPropagation();
    }
  }

  function navigate(href: string) {
    setShowResults(false);
    setHighlightedSearchIndex(-1);
    setSearch("");
    setMobileOpen(false);
    router.push(href);
  }

  function toggleSidebar() {
    if (window.matchMedia("(max-width: 900px)").matches) setMobileOpen((current) => !current);
    else setCompact((current) => !current);
  }

  return (
    <main className={"admin-shell admin-shell-premium admin-workspace ml-admin-dashboard-shell" +
      (compact ? " ml-admin-compact" : "") + (mobileOpen ? " ml-admin-mobile-open" : "")}
      lang={locale} dir={locale === "en" ? "ltr" : "rtl"}>
      <a className="ml-admin-skip" href="#admin-workspace-content">{t("Skip to content")}</a>
      {mobileOpen ? <button className="ml-admin-sidebar-backdrop" type="button"
        aria-label={t("Close sidebar")} onClick={() => closeMobileSidebar(true)} /> : null}

      <aside id="ml-admin-sidebar" ref={sidebarRef} className="ml-admin-sidebar"
        aria-label={t("School Administration")}
        role={isMobileLayout ? "dialog" : "complementary"}
        aria-modal={isMobileLayout && mobileOpen ? true : undefined}
        aria-hidden={isMobileLayout && !mobileOpen ? true : undefined}
        inert={isMobileLayout && !mobileOpen}
        onKeyDown={handleSidebarKeyDown}>
        <button className="ml-admin-sidebar-close" type="button"
          aria-label={t("Close sidebar")} title={t("Close sidebar")}
          onClick={() => closeMobileSidebar(true)}>
          <Icon name="close" size={20} />
        </button>
        <Link className="ml-admin-sidebar-brand" href="/admin/dashboard" title="MaktabLink" aria-label="MaktabLink" onClick={() => setMobileOpen(false)}>
          <span className="ml-admin-brand-icon"><Icon name="academic" size={27} /></span>
          <span className="ml-admin-sidebar-brand-text"><strong>MaktabLink</strong><small>{t("School Administration")}</small></span>
        </Link>

        <div className="ml-admin-school-chip" title={stored.school.name}>
          <span className="ml-admin-school-chip-icon"><Icon name="school" size={19} /></span>
          <span className="ml-admin-school-chip-text"><strong>{stored.school.name}</strong><small>{t("School workspace")}</small></span>
          <Icon name="check" size={15} />
        </div>

        <nav className="admin-route-nav ml-admin-side-nav" aria-label={t("Administration sections")}>
          {navItems.map((item) => {
            const active = activeRoute(currentPath, item.href);
            const submenu = adminSidebarSections[item.href];
            const expandable = Boolean(submenu?.length);
            const open = expandedGroup === item.href;
            const groupId = item.href.replaceAll("/", "-").slice(1);
            return (
              <div className="ml-admin-nav-group" key={item.href}>
                <div className={"ml-admin-nav-row" +
                  (expandable ? " ml-admin-nav-row-academic ml-admin-nav-row-expandable" : "") +
                  (active ? " ml-admin-nav-row-active" : "")}>
                  <Link href={item.href} title={t(item.label)}
                    className={"admin-route-nav-link ml-admin-side-link" +
                      (active ? " admin-route-nav-link-active ml-admin-side-link-active" : "")}
                    aria-current={currentPath === item.href && !searchTab && !fragment ? "page" : undefined}
                    onClick={() => {
                      setMobileOpen(false);
                      setFragment("");
                      if (expandable) setExpandedGroup(item.href);
                    }}>
                    <Icon name={navIcons[item.href] ?? "dashboard"} size={19} />
                    <span className="ml-admin-nav-label">{t(item.label)}</span>
                  </Link>
                  {expandable ? (
                    <button className={"ml-admin-subnav-toggle" +
                      (open ? " ml-admin-subnav-toggle-open" : "")}
                      type="button" title={t(open ? "Collapse subsections" : "Expand subsections") + ": " + t(item.label)}
                      aria-label={t(open ? "Collapse subsections" : "Expand subsections") + ": " + t(item.label)}
                      aria-expanded={open} aria-controls={groupId + "-subnav"}
                      data-admin-no-loading="true"
                      onClick={() => setExpandedGroup((current) =>
                        current === item.href ? null : item.href)}>
                      <Icon name="chevron" size={16} />
                    </button>
                  ) : null}
                </div>
                {expandable && open ? (
                  <div className="ml-admin-subnav" id={groupId + "-subnav"}>
                    {submenu!.map((entry) => {
                      const selected = sidebarItemIsActive(entry.href, currentPath, searchTab, fragment);
                      const hasIcon = Boolean(adminSubnavIconPaths[entry.href]);
                      return (
                        <Link href={entry.href} key={entry.href} title={t(entry.label)}
                          className={selected ? "ml-admin-subnav-link ml-admin-subnav-link-active" : "ml-admin-subnav-link"}
                          aria-current={selected ? "page" : undefined}
                          onClick={() => {
                            setMobileOpen(false);
                            setFragment(new URL(entry.href, window.location.origin).hash);
                          }}>
                          {hasIcon ? (
                            <span className="ml-admin-subnav-icon" aria-hidden="true">
                              <AdminSubnavIcon href={entry.href} size={16} />
                            </span>
                          ) : <span className="ml-admin-subnav-dot" aria-hidden="true" />}
                          {t(entry.label)}
                        </Link>
                      );
                    })}
                  </div>
                ) : null}
              </div>
            );
          })}
        </nav>

        <div className="ml-admin-sidebar-footer">
          <Link className="ml-admin-sidebar-profile" href="/admin/profile" title={t("Administrator profile")} aria-label={t("Administrator profile")} onClick={() => setMobileOpen(false)}>
            <span className="ml-admin-sidebar-profile-icon" aria-hidden="true"><Icon name="profile" size={20} /></span>
            <span className="ml-admin-sidebar-profile-name"><strong>{userName}</strong><small>{t("School Administration")}</small></span>
          </Link>
          <button className="ml-admin-sign-out" type="button" title={t("Sign out")}
            onClick={() => void signOut()}>
            <Icon name="logout" size={19} /><span className="ml-admin-nav-label">{t("Sign out")}</span>
          </button>
        </div>
      </aside>

      <div className="ml-admin-main-column" inert={isMobileLayout && mobileOpen}>
        <header className="ml-admin-topbar">
          <button ref={menuButtonRef} className="ml-admin-menu-button" type="button"
            aria-label={t(isMobileLayout
              ? (mobileOpen ? "Close sidebar" : "Open sidebar")
              : (compact ? "Expand sidebar" : "Collapse sidebar"))}
            title={t(isMobileLayout
              ? (mobileOpen ? "Close sidebar" : "Open sidebar")
              : (compact ? "Expand sidebar" : "Collapse sidebar"))}
            aria-controls="ml-admin-sidebar"
            aria-expanded={isMobileLayout ? mobileOpen : !compact}
            data-admin-no-loading="true" onClick={toggleSidebar}>
            <Icon name="menu" size={21} />
          </button>

          <form className="ml-admin-search" ref={searchBoxRef} role="search"
            onSubmit={(event) => {
              event.preventDefault();
              const option = highlightedSearchIndex < 0 ? searchOptions[0] : searchOptions[highlightedSearchIndex];
              if (option) navigate(option.href);
            }}>
            <Icon name="search" size={19} />
            <input ref={searchRef} type="search" value={search}
              onChange={(event) => {
                setSearch(event.target.value);
                setHighlightedSearchIndex(-1);
                setShowResults(true);
              }}
              onFocus={() => setShowResults(true)}
              onKeyDown={handleSearchKeyDown}
              placeholder={t("Search sections and pages…")}
              aria-label={t("Search sections and pages…")}
              role="combobox" aria-autocomplete="list"
              aria-expanded={showResults}
              aria-controls={showResults ? "admin-page-search-results" : undefined}
              aria-activedescendant={showResults && highlightedSearchIndex >= 0
                ? "admin-page-search-option-" + highlightedSearchIndex : undefined}
              autoComplete="off" />
            <kbd>Ctrl K</kbd>
            {showResults ? (
              <div className="ml-admin-search-results" id="admin-page-search-results" role="listbox"
                aria-label={t("Search results")}>
                {searchOptions.length ? searchOptions.map((item, index) => (
                  <button type="button" key={item.href} id={"admin-page-search-option-" + index}
                    role="option" tabIndex={-1}
                    aria-selected={highlightedSearchIndex === index}
                    onMouseEnter={() => setHighlightedSearchIndex(index)}
                    onClick={() => navigate(item.href)}>
                    <Icon name={navIcons[item.href] ?? "academic"} size={17} />
                    <span>{t(item.label)}</span><Icon name="arrow" size={15} />
                  </button>
                )) : <span className="ml-admin-search-empty">{t("No matching pages")}</span>}
              </div>
            ) : null}
          </form>

          <div className="ml-admin-topbar-actions">
            <div className="ml-admin-topbar-school" title={stored.school.name}>
              <Icon name="school" size={18} /><span>{stored.school.name}</span>
            </div>
            <Link href="/admin/communication" title={t("Communication & fees")}
              aria-label={t("Communication & fees")} className="ml-admin-topbar-icon">
              <Icon name="bell" size={20} />
            </Link>
            <label className="ml-admin-topbar-language">
              <span className="ml-admin-screen-reader-only">{t("Language")}</span>
              <select value={locale} aria-label={t("Language")}
                onChange={(event) => setLocale(event.target.value as AdminLocale)}>
                {adminLocaleOptions.map((option) => <option key={option.value}
                  value={option.value}>{option.label}</option>)}
              </select>
            </label>
            <Link href="/admin/profile" className="ml-admin-topbar-user"
              title={t("Administrator profile")} aria-label={t("Administrator profile")}>
              <UserAvatar name={userName} url={adminProfile.imageUrl} />
            </Link>
          </div>
        </header>

        <div className="ml-admin-content-area" id="admin-workspace-content" tabIndex={-1}>
          <section className="admin-route-heading ml-admin-page-heading">
            <div className="ml-admin-page-heading-intro">
              <span className="ml-admin-page-heading-symbol" aria-hidden="true">
                <Icon name={pathname.startsWith("/admin/academics") ? "academic" : navIcons[navItems.find((item) => activeRoute(pathname, item.href))?.href ?? ""] ?? "dashboard"} size={27} />
              </span>
              <div className="ml-admin-page-heading-text">
              <span className="ml-admin-page-eyebrow">{t("School Administration")} <span> / </span>{t(title)}</span>
              <h1>{t(title)}</h1>
              <p>{t(description)}</p>
              </div>
            </div>
            {yearScoped && academicYears.length > 0 ? (
              <label className="admin-language-control admin-year-context-control ml-admin-year-picker">
                <span>{t("Academic year context")}</span>
                <select value={selectedAcademicYearId}
                  onChange={(event) => setSelectedAcademicYearId(event.target.value)}>
                  {academicYears.map((year) => <option key={year.id} value={year.id}>
                    {year.name} · {t(year.status)}
                  </option>)}
                </select>
              </label>
            ) : null}
          </section>
          <section className="admin-route-content ml-admin-route-content">{children}</section>
        </div>
      </div>
    </main>
  );
}
