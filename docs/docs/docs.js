/* ============================================================
   The Chair's Desk — Documentation Engine
   Client-side markdown renderer with routing, search, and nav
   ============================================================ */

const pages = [
  // Welcome
  { slug: "getting-started", title: "Getting Started", group: "welcome", path: "content/getting-started.md" },

  // Tutorials
  { slug: "tutorial-first-term", title: "Setting Up Your First Term", group: "tutorials", path: "tutorials/setting-up-first-term.md", time: "10 min", difficulty: "Beginner" },
  { slug: "tutorial-import", title: "Importing Schedule Data", group: "tutorials", path: "tutorials/importing-schedule-data.md", time: "15 min", difficulty: "Beginner" },
  { slug: "tutorial-build-schedule", title: "Building a Schedule", group: "tutorials", path: "tutorials/building-a-schedule.md", time: "20 min", difficulty: "Intermediate" },
  { slug: "tutorial-workload", title: "Managing Instructor Workload", group: "tutorials", path: "tutorials/managing-instructor-workload.md", time: "10 min", difficulty: "Beginner" },
  { slug: "tutorial-conflicts", title: "Resolving Conflicts", group: "tutorials", path: "tutorials/resolving-conflicts.md", time: "10 min", difficulty: "Intermediate" },
  { slug: "tutorial-export", title: "Exporting & Sharing", group: "tutorials", path: "tutorials/exporting-and-sharing.md", time: "10 min", difficulty: "Beginner" },
  { slug: "tutorial-rotation", title: "Planning Course Rotation", group: "tutorials", path: "tutorials/planning-course-rotation.md", time: "15 min", difficulty: "Intermediate" },
  { slug: "tutorial-copy-term", title: "Copying a Term", group: "tutorials", path: "tutorials/copying-a-term.md", time: "5 min", difficulty: "Beginner" },

  // Reference
  { slug: "dashboard", title: "Dashboard", group: "reference", path: "content/dashboard.md" },
  { slug: "schedule-grid", title: "Schedule Grid", group: "reference", path: "content/schedule-grid.md" },
  { slug: "courses", title: "Courses", group: "reference", path: "content/courses.md" },
  { slug: "instructors", title: "Instructors", group: "reference", path: "content/instructors.md" },
  { slug: "rooms", title: "Rooms", group: "reference", path: "content/rooms.md" },
  { slug: "terms", title: "Terms", group: "reference", path: "content/terms.md" },
  { slug: "course-rotation", title: "Course Rotation", group: "reference", path: "content/course-rotation.md" },
  { slug: "analytics", title: "Analytics", group: "reference", path: "content/analytics.md" },
  { slug: "import-export", title: "Import & Export", group: "reference", path: "content/import-export.md" },
  { slug: "settings", title: "Settings", group: "reference", path: "content/settings.md" },
  { slug: "conflicts", title: "Conflicts & Validation", group: "reference", path: "content/conflicts.md" },
  { slug: "tips", title: "Tips & Shortcuts", group: "reference", path: "content/tips.md" },
];

const groupLabels = {
  welcome: "Welcome",
  tutorials: "Tutorials",
  reference: "Reference",
};

// ---- State ----
let currentSlug = null;
const contentCache = {};

// ---- DOM refs ----
const sidebarNav = document.getElementById("sidebar-nav");
const article = document.getElementById("article");
const breadcrumbs = document.getElementById("breadcrumbs");
const pageNav = document.getElementById("page-nav");
const searchInput = document.getElementById("search");
const sidebar = document.getElementById("sidebar");
const hamburger = document.getElementById("hamburger");

// ---- Routing ----
function getSlugFromURL() {
  const params = new URLSearchParams(window.location.search);
  return params.get("page") || "getting-started";
}

function navigateTo(slug, pushState = true) {
  if (slug === currentSlug) return;
  currentSlug = slug;
  if (pushState) {
    history.pushState({ slug }, "", `?page=${slug}`);
  }
  loadPage(slug);
  updateSidebarActive(slug);
  sidebar.classList.remove("open");
}

window.addEventListener("popstate", (e) => {
  const slug = e.state?.slug || getSlugFromURL();
  currentSlug = slug;
  loadPage(slug);
  updateSidebarActive(slug);
});

// ---- Sidebar ----
function buildSidebar(filter = "") {
  const lowerFilter = filter.toLowerCase();
  let html = "";
  let lastGroup = null;

  for (const page of pages) {
    if (lowerFilter && !page.title.toLowerCase().includes(lowerFilter)) continue;

    if (page.group !== lastGroup) {
      lastGroup = page.group;
      html += `<div class="sidebar-group">
        <div class="sidebar-group-label">${groupLabels[page.group]}</div>`;
    }
    const activeClass = page.slug === currentSlug ? " active" : "";
    html += `<a href="?page=${page.slug}" class="sidebar-link${activeClass}" data-slug="${page.slug}">${page.title}</a>`;
  }
  // Close last group
  if (lastGroup) html += `</div>`;

  sidebarNav.innerHTML = html;

  // Attach click handlers
  sidebarNav.querySelectorAll(".sidebar-link").forEach((link) => {
    link.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(link.dataset.slug);
    });
  });
}

function updateSidebarActive(slug) {
  sidebarNav.querySelectorAll(".sidebar-link").forEach((link) => {
    link.classList.toggle("active", link.dataset.slug === slug);
  });
}

// ---- Page loading ----
async function loadPage(slug) {
  const page = pages.find((p) => p.slug === slug);
  if (!page) {
    article.innerHTML = `<h1>Page Not Found</h1><p>The page "${slug}" does not exist.</p>`;
    return;
  }

  // Breadcrumbs
  const groupLabel = groupLabels[page.group];
  breadcrumbs.innerHTML = `<a href="?page=getting-started">Docs</a>
    <span class="sep">/</span>
    <span>${groupLabel}</span>
    <span class="sep">/</span>
    <span>${page.title}</span>`;

  // Show loading
  article.innerHTML = `<div class="loading">Loading...</div>`;

  // Fetch content
  let md;
  if (contentCache[slug]) {
    md = contentCache[slug];
  } else {
    try {
      const res = await fetch(page.path);
      if (!res.ok) throw new Error(res.statusText);
      md = await res.text();
      contentCache[slug] = md;
    } catch (err) {
      article.innerHTML = `<h1>Error</h1><p>Could not load ${page.path}: ${err.message}</p>`;
      return;
    }
  }

  // Render markdown
  let html = marked.parse(md);

  // Add heading anchors
  html = html.replace(/<(h[23]) id="([^"]+)">/g, (match, tag, id) => {
    return `<${tag} id="${id}"><a href="?page=${slug}#${id}" class="anchor">#</a>`;
  });

  // Tutorial metadata box
  let metaHtml = "";
  if (page.time || page.difficulty) {
    metaHtml = `<div class="tutorial-meta">`;
    if (page.time) metaHtml += `<div class="tutorial-meta-item"><strong>Time:</strong> ${page.time}</div>`;
    if (page.difficulty) metaHtml += `<div class="tutorial-meta-item"><strong>Level:</strong> ${page.difficulty}</div>`;
    metaHtml += `</div>`;
  }

  article.innerHTML = metaHtml + html;

  // Update page title
  document.title = `${page.title} — The Chair's Desk Docs`;

  // Prev/Next nav
  renderPageNav(slug);

  // Scroll to top (or to hash)
  if (window.location.hash) {
    const el = document.getElementById(window.location.hash.slice(1));
    if (el) { el.scrollIntoView(); return; }
  }
  window.scrollTo(0, 0);
}

// ---- Prev/Next ----
function renderPageNav(slug) {
  const idx = pages.findIndex((p) => p.slug === slug);
  let html = "";

  if (idx > 0) {
    const prev = pages[idx - 1];
    html += `<a href="?page=${prev.slug}" class="prev" data-slug="${prev.slug}">
      <span class="page-nav-label">&larr; Previous</span>
      <span class="page-nav-title">${prev.title}</span>
    </a>`;
  } else {
    html += `<span></span>`;
  }

  if (idx < pages.length - 1) {
    const next = pages[idx + 1];
    html += `<a href="?page=${next.slug}" class="next" data-slug="${next.slug}">
      <span class="page-nav-label">Next &rarr;</span>
      <span class="page-nav-title">${next.title}</span>
    </a>`;
  }

  pageNav.innerHTML = html;
  pageNav.querySelectorAll("a").forEach((a) => {
    a.addEventListener("click", (e) => {
      e.preventDefault();
      navigateTo(a.dataset.slug);
    });
  });
}

// ---- Search ----
searchInput.addEventListener("input", () => {
  buildSidebar(searchInput.value);
});

// ---- Mobile hamburger ----
hamburger.addEventListener("click", () => {
  sidebar.classList.toggle("open");
});

// Close sidebar on outside click (mobile)
document.addEventListener("click", (e) => {
  if (sidebar.classList.contains("open") &&
      !sidebar.contains(e.target) &&
      !hamburger.contains(e.target)) {
    sidebar.classList.remove("open");
  }
});

// ---- Init ----
const initialSlug = getSlugFromURL();
currentSlug = initialSlug;
buildSidebar();
loadPage(initialSlug);
