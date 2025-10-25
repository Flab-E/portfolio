(function () {
  "use strict";

  // Simple blog renderer (original simpler manifest behavior)
  // - Expects manifest at "blogs/manifest.json" relative to the page
  // - Builds a left-hand tree inside element with id "blogs-tree-root" or "blogs-tree"
  // - Loads markdown/html/txt files into element with id "blog-viewer"
  // - Updates a small metadata area if present (blog-title, blog-summary, blog-author, blog-date)
  //
  // This implementation purposely keeps the manifest fetch and error handling simple.

  // Resolve manifest and blogs base to absolute URLs using the script's src location.
  // This ensures the manifest is fetched from the same directory as this script,
  // avoiding doubled segments like 'blogs/blogs/manifest.json' and making the
  // renderer robust when loaded from /blogs/ or from the site root.
  const _scriptEl =
    document.currentScript ||
    (function () {
      const s = document.getElementsByTagName("script");
      return s[s.length - 1];
    })();

  let MANIFEST_PATH = "blogs/manifest.json";
  let BLOGS_BASE = "blogs/";

  try {
    if (_scriptEl && _scriptEl.src) {
      const scriptUrl = new URL(_scriptEl.src, location.href);
      // Absolute URL to manifest.json next to the script file
      MANIFEST_PATH = new URL("manifest.json", scriptUrl).href;
      // Base URL for blog resources (directory containing the script). Ensure trailing slash.
      BLOGS_BASE = new URL("./", scriptUrl).href;
      if (!BLOGS_BASE.endsWith("/")) BLOGS_BASE = BLOGS_BASE + "/";
    } else {
      // Fallback to site-rooted absolute paths to the blogs directory
      MANIFEST_PATH = new URL("/blogs/manifest.json", location.origin).href;
      BLOGS_BASE = new URL("/blogs/", location.origin).href;
    }
  } catch (e) {
    // Conservative fallback to relative paths
    MANIFEST_PATH = "blogs/manifest.json";
    BLOGS_BASE = "blogs/";
  }

  // Debug logging to help diagnose manifest fetch issues (useful on static hosts)
  if (typeof console !== "undefined" && typeof console.debug === "function") {
    console.debug(
      "blog_renderer: resolved paths:",
      "MANIFEST_PATH=",
      MANIFEST_PATH,
      "BLOGS_BASE=",
      BLOGS_BASE,
    );
  }

  const TREE_IDS = ["blogs-tree-root", "blogs-tree"];
  const VIEWER_ID = "blog-viewer";
  const META_IDS = {
    title: "blog-title",
    summary: "blog-summary",
    author: "blog-author",
    date: "blog-date",
  };
  const RESOURCES_ID = "blog-resources";

  // --- Utilities ---
  async function fetchJson(path) {
    // Force a fresh network load to avoid stale 304 responses from interfering
    // with the renderer. Using cache: 'no-store' ensures the browser requests
    // the resource from the server rather than returning a cached 304.
    const resp = await fetch(path, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Failed to fetch ${path}: ${resp.status}`);
    return resp.json();
  }

  async function fetchText(path) {
    // Force fresh load to prevent 304 responses from causing empty/invalid
    // response bodies. This uses the no-store cache mode.
    const resp = await fetch(path, { cache: "no-store" });
    if (!resp.ok) throw new Error(`Failed to fetch ${path}: ${resp.status}`);
    return resp.text();
  }

  function escapeHtml(s) {
    return String(s)
      .replace(/&/g, "&amp;")
      .replace(/</g, "&lt;")
      .replace(/>/g, "&gt;");
  }

  function el(tag, opts = {}, ...children) {
    const node = document.createElement(tag);
    if (opts.class) node.className = opts.class;
    if (opts.id) node.id = opts.id;
    if (opts.html !== undefined) node.innerHTML = opts.html;
    if (opts.text !== undefined) node.textContent = opts.text;
    if (opts.attrs)
      Object.keys(opts.attrs).forEach((k) =>
        node.setAttribute(k, opts.attrs[k]),
      );
    children.forEach((c) => {
      if (typeof c === "string") node.appendChild(document.createTextNode(c));
      else if (c) node.appendChild(c);
    });
    return node;
  }

  // Very small frontmatter parser (YAML-like single-line keys)
  function parseFrontmatter(md) {
    const out = { meta: {}, body: md, raw: null };
    if (!md.startsWith("---")) return out;
    const match = md.match(/^\s*---\s*[\r\n]+([\s\S]*?)[\r\n]+---[\r\n]*/);
    if (!match) return out;
    out.raw = match[1];
    out.body = md.slice(match[0].length);
    const lines = out.raw.split(/\r?\n/);
    lines.forEach((line) => {
      const m = line.match(/^([A-Za-z0-9_\-]+)\s*:\s*(.*)$/);
      if (m) {
        let key = m[1].trim();
        let val = m[2].trim();
        if (
          (val.startsWith('"') && val.endsWith('"')) ||
          (val.startsWith("'") && val.endsWith("'"))
        ) {
          val = val.slice(1, -1);
        }
        out.meta[key.toLowerCase()] = val;
      }
    });
    return out;
  }

  // derive minimal meta if frontmatter missing and strip metadata lines from body
  function deriveMetaFromMarkdown(body) {
    const meta = { title: null, summary: null, author: null, date: null };
    const titleMatch = body.match(/^\s*#\s+(.+)$/m);
    if (titleMatch) meta.title = titleMatch[1].trim();

    // Find standalone metadata lines
    const authorMatch = body.match(/^\s*Author\s*:\s*(.+)$/im);
    if (authorMatch) meta.author = authorMatch[1].trim();
    const dateMatch = body.match(/^\s*Date\s*:\s*(.+)$/im);
    if (dateMatch) meta.date = dateMatch[1].trim();

    // Strip metadata lines from body to prevent duplication
    let cleanBody = body;
    if (authorMatch) {
      cleanBody = cleanBody.replace(/^\s*Author\s*:\s*.+$/im, "");
    }
    if (dateMatch) {
      cleanBody = cleanBody.replace(/^\s*Date\s*:\s*.+$/im, "");
    }

    // Clean up multiple consecutive newlines
    cleanBody = cleanBody.replace(/\n\s*\n\s*\n/g, "\n\n");

    // Find summary from clean paragraphs
    const paragraphs = cleanBody
      .split(/\r?\n\r?\n/)
      .map((p) => p.trim())
      .filter(Boolean);
    for (let p of paragraphs) {
      if (
        !p.startsWith("#") &&
        !p.startsWith("```") &&
        !/^\s*[-*]\s+/.test(p) &&
        p.length > 10
      ) {
        meta.summary = p.replace(/\r?\n/g, " ").trim();
        break;
      }
    }

    // Return both meta and cleaned body
    meta.cleanBody = cleanBody;
    return meta;
  }

  function deriveMetaFromHtml(html) {
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(html, "text/html");
      const root = doc.querySelector(".blog-content") || doc.body;
      const meta = { title: null, summary: null, author: null, date: null };
      const h1 = root.querySelector("h1");
      if (h1) meta.title = h1.textContent.trim();
      const p = root.querySelector("p");
      if (p) meta.summary = p.textContent.trim();
      const text = root.textContent || "";
      const auth = text.match(/Author\s*[:\-]\s*([^\n]+)/i);
      if (auth) meta.author = auth[1].trim();
      const d = text.match(
        /(Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec|\d{4})[^\n]{0,20}\d{2,4}/i,
      );
      if (d) meta.date = d[0].trim();
      return meta;
    } catch (e) {
      return {};
    }
  }

  function normalizeMeta(candidate) {
    return {
      title: candidate.title || "Untitled",
      summary: candidate.summary || "No summary available.",
      author: candidate.author || "Unknown",
      date: candidate.date || "Unknown",
      blogDir: candidate.blogDir || null,
    };
  }

  // Reset metadata section to default state
  function resetMetaUI() {
    const metaSection = document.getElementById("blog-meta");
    if (metaSection) {
      metaSection.style.display = "block";
    }

    const t = document.getElementById(META_IDS.title);
    const s = document.getElementById(META_IDS.summary);
    const a = document.getElementById(META_IDS.author);
    const d = document.getElementById(META_IDS.date);
    if (t) t.textContent = "Select a Blog Post";
    if (s)
      s.textContent =
        "Choose a blog post from the navigation panel to view its content and resources.";
    if (a) a.textContent = "Author: —";
    if (d) d.textContent = "Date: —";
  }

  // Update UI metadata if present
  function setMetaUI(meta) {
    // Hide the metadata section when a blog is loaded
    const metaSection = document.getElementById("blog-meta");
    if (metaSection) {
      metaSection.style.display = "none";
    }

    // Update page header if blog directory is available
    if (meta.blogDir && window.updatePageHeader) {
      window.updatePageHeader(meta.blogDir, meta);
    }
  }

  /**
   * Find a sensible index path (index.md / index.html) for a blog identifier using the manifest.
   * Returns a URL/path suitable for loadAndRender(), or null if no candidate found.
   *
   * Prefer (in order):
   *  - blog.index from manifest (resolved against BLOGS_BASE if relative)
   *  - BLOGS_BASE + dir + '/index.md'
   *  - BLOGS_BASE + dir + '/index.html'
   *  - BLOGS_BASE + dir (as a fallback; server may redirect / serve index)
   */
  function findIndexPathForBlog(manifest, id) {
    if (!manifest || !Array.isArray(manifest.blogs) || !id) return null;
    // Normalize id for comparison
    const norm = String(id).trim();

    for (const blog of manifest.blogs) {
      const dir = blog.dir || blog.id || blog.slug || "";
      // Compare several candidate identifiers
      const candidates = [
        blog.id,
        blog.dir,
        blog.slug,
        (blog.displayName || "").trim(),
        dir.replace(/^\/*/, ""),
      ].filter(Boolean);

      if (candidates.some((c) => c && String(c).trim() === norm)) {
        // 1) explicit index supplied in manifest
        if (blog.index) {
          try {
            // If blog.index looks absolute (starts with http or /), return as-is
            if (
              /^https?:\/\//i.test(blog.index) ||
              blog.index.startsWith("/")
            ) {
              return blog.index;
            }
            // Otherwise resolve relative to BLOGS_BASE
            return new URL(blog.index, BLOGS_BASE).pathname.startsWith("/")
              ? new URL(blog.index, BLOGS_BASE).href
              : BLOGS_BASE + blog.index;
          } catch (e) {
            // conservative fallback: prefix with BLOGS_BASE
            return BLOGS_BASE + blog.index;
          }
        }

        // 2) try index.md / index.html inside the blog directory
        const baseDir = dir.endsWith("/") ? dir : dir + "/";
        try {
          const candMd = new URL(baseDir + "index.md", BLOGS_BASE).href;
          const candHtml = new URL(baseDir + "index.html", BLOGS_BASE).href;
          // Prefer md first, then html; actual existence will be verified by fetch in loadAndRender
          return candMd || candHtml || new URL(baseDir, BLOGS_BASE).href;
        } catch (e) {
          // fallback string concatenation
          return BLOGS_BASE + baseDir + "index.md";
        }
      }
    }
    return null;
  }

  // Renderers
  async function renderMarkdownIntoViewer(md, srcPath) {
    const viewer = document.getElementById(VIEWER_ID);
    if (!viewer) return;

    // Compute srcBase (directory of the source path) to resolve relative refs.
    let srcBase = "";
    if (srcPath && typeof srcPath === "string") {
      // Extract relative path from full URL if needed
      let relativePath = srcPath;
      if (srcPath.startsWith("http")) {
        try {
          const url = new URL(srcPath);
          relativePath = url.pathname;
        } catch (e) {
          // Fallback to original path
          relativePath = srcPath;
        }
      }
      const idx = relativePath.lastIndexOf("/");
      if (idx !== -1) srcBase = relativePath.substring(0, idx + 1);

      // Ensure srcBase is relative to site root (starts with /)
      if (srcBase && !srcBase.startsWith("/")) {
        srcBase = "/" + srcBase;
      }
    }

    // Helper that resolves a relative reference against the markdown source
    // and returns a normalized absolute pathname (starts with '/').
    function normalizeRef(ref) {
      try {
        // If the ref is already absolute or an external URL, return as-is.
        if (/^https?:\/\//.test(ref) || ref.startsWith("/")) return ref;

        // For relative paths, resolve against the srcBase directory
        if (srcBase) {
          // Concatenate srcBase with the relative ref, ensuring proper slashes
          let resolved;
          if (srcBase.endsWith("/")) {
            resolved = srcBase + ref;
          } else {
            resolved = srcBase + "/" + ref;
          }
          // Ensure the resolved path starts with / (relative to site root)
          return resolved.startsWith("/") ? resolved : "/" + resolved;
        } else {
          // No srcBase, assume relative to /blogs/
          return "/blogs/" + ref;
        }
      } catch (e) {
        // Conservative fallback: prefix with srcBase (if available) and ensure a leading slash
        const candidate = srcBase
          ? srcBase.endsWith("/")
            ? srcBase + ref
            : srcBase + "/" + ref
          : ref;
        return candidate.startsWith("/") ? candidate : "/" + candidate;
      }
    }

    // Preprocess markdown and wiki-style image links.
    // Steps:
    //  - Extract fenced code blocks first (preserve verbatim)
    //  - Perform arrow/list & inline-arrow replacements only on the non-code portions
    //  - Restore fenced code blocks
    //  - Then normalize simple wiki-style image links: ![[name.png]] -> ![](assets/name.png)
    const raw = String(md || "");

    // Extract fenced code blocks (``` ... ```) and replace them with placeholders.
    const __CODE_PLACEHOLDER = "___BLOG_CODE_BLOCK___";
    const __codeChunks = [];
    let temp = raw.replace(/```[\s\S]*?```/g, (m) => {
      const idx = __codeChunks.push(m) - 1;
      return `${__CODE_PLACEHOLDER}${idx}___`;
    });

    // Now operate only on the non-code text (temp contains placeholders)
    // Use a line-by-line pass that is aware of fenced-code placeholders so we never
    // alter code block contents. This is more robust than a single regex replace
    // when handling indentation, blank-line separators, and varied arrow characters.
    (function () {
      const lines = temp.split("\n");
      const out = [];
      for (let i = 0; i < lines.length; i++) {
        const line = lines[i];
        // If this line contains a preserved code-block placeholder, leave it untouched
        if (line.indexOf(__CODE_PLACEHOLDER) !== -1) {
          out.push(line);
          continue;
        }

        // Match leading arrow list markers (->, =>) or their Unicode equivalents (→, ⇒)
        // Also support optional blockquote prefix(es) like '> ' or '>> ' and preserve them.
        // Capture groups:
        //   1 = leading indentation (spaces/tabs)
        //   2 = optional blockquote prefix (one or more '>' plus trailing spaces)
        //   3 = the rest of the list item text after the arrow marker
        const arrowMatch = line.match(
          /^([ \t]*)(>{1,}[ \t]*)?(?:->|=>|⇒|→)[ \t]*(.*)$/,
        );
        if (arrowMatch) {
          // Clamp indentation to at most 3 spaces so we don't accidentally create code blocks
          let indent = (arrowMatch[1] || "").replace(/\t/g, "    ");
          if (indent.length > 3) indent = indent.slice(0, 3);

          // Preserve any blockquote prefix detected (e.g., '> ' or '>> ')
          const quotePrefix = arrowMatch[2] || "";

          // Detect arrow type and create special marker
          const originalLine = line.trim();
          const isDoubleArrow =
            originalLine.startsWith("=>") || originalLine.startsWith("⇒");
          const arrowMarker = isDoubleArrow ? "DOUBLEARROW" : "SINGLEARROW";

          // Ensure a blank line before a list block when the previous output line is non-empty
          if (out.length && out[out.length - 1].trim() !== "") out.push("");

          // Emit the canonical markdown list item with special marker preserved
          out.push(
            indent +
              quotePrefix +
              "- " +
              arrowMarker +
              " " +
              (arrowMatch[3] || ""),
          );
          continue;
        }

        // Also handle cases where existing Markdown list markers are indented 4+ spaces
        // (these would otherwise turn into code blocks). Reduce them to 3 spaces.
        const overIndentedList = line.match(/^([ \t]{4,})([-*+]\s+.*)$/);
        if (overIndentedList) {
          out.push("   " + overIndentedList[2]);
          continue;
        }

        // Default: keep the line as-is
        out.push(line);
      }

      temp = out.join("\n");
    })();

    // 2) Replace inline arrow sequences outside code blocks (but NOT list markers):
    //    Replace '=>' -> '⇒' and '->' -> '→' (perform longer replacement first)
    //    Skip lines that contain our special markers
    temp = temp
      .split("\n")
      .map((line) => {
        if (line.includes("SINGLEARROW") || line.includes("DOUBLEARROW")) {
          return line; // Don't replace arrows in marked list items
        }
        return line.replace(/=>/g, "⇒").replace(/->/g, "→");
      })
      .join("\n");

    // Restore the fenced code blocks back into the text
    let pre = temp.replace(
      new RegExp(__CODE_PLACEHOLDER + "(\\d+)___", "g"),
      (m, n) => {
        return __codeChunks[Number(n)] || m;
      },
    );

    // Note: explicit Unicode-arrow fallback and extra clamping have been removed.
    // The line-by-line pass above normalizes leading '->', '=>', '⇒', and '→' into
    // canonical Markdown list items and clamps indentation to avoid creating code blocks.
    // Debug: log transformed markdown so you can inspect what the renderer will pass to marked.
    try {
      if (
        typeof console !== "undefined" &&
        typeof console.debug === "function"
      ) {
        console.debug(
          "Blog renderer - transformed markdown (truncated):",
          pre.slice(0, 2000),
        );
      }
    } catch (e) {
      // ignore logging failures
    }

    // Finally convert simple wiki-style image links: ![[name.png]] -> ![](assets/name.png)
    // (Resolution to absolute paths is handled later by the renderer.)
    pre = pre.replace(/!\[\[(.+?)\]\]/g, (m, p1) => {
      const name = p1.trim();
      const rel = name.startsWith("assets/") ? name : "assets/" + name;
      return `![](${rel})`;
    });

    // Rewrite relative image URLs that are not absolute (not starting with http(s) or /)
    pre = pre.replace(
      /!\[([^\]]*)\]\((?!https?:\/\/|\/)([^)]+)\)/g,
      (m, alt, url) => {
        const u = url.trim();
        const resolved = normalizeRef(u);
        return `![${alt}](${resolved})`;
      },
    );

    // Rewrite relative normal links as well: [text](relative/path)
    pre = pre.replace(
      /\[([^\]]+)\]\((?!https?:\/\/|\/)([^)]+)\)/g,
      (m, text, url) => {
        const u = url.trim();
        const resolved = normalizeRef(u);
        return `[${text}](${resolved})`;
      },
    );

    // Robust marked usage: configure safely if present and render
    if (typeof marked !== "undefined") {
      try {
        if (typeof marked.setOptions === "function") {
          marked.setOptions({
            gfm: true,
            breaks: false,
            smartLists: true,
            smartypants: false,
            headerIds: false,
            mangle: false,
          });
        } else if (marked.defaults && typeof marked.defaults === "object") {
          Object.assign(marked.defaults, {
            gfm: true,
            breaks: false,
            headerIds: false,
            mangle: false,
          });
        }
      } catch (e) {
        // ignore
      }

      // Use the best available render function on `marked`
      const renderFn = marked.parse || marked || ((s) => s);

      try {
        const maybeHtml = renderFn(pre);
        // Normalize to a single HTML string (await if it's a promise)
        let htmlToRender;
        if (maybeHtml && typeof maybeHtml.then === "function") {
          htmlToRender = await maybeHtml;
        } else {
          htmlToRender = maybeHtml;
        }

        // Inject rendered HTML as usual
        viewer.innerHTML = `<div class="blog-content">${htmlToRender}</div>`;

        // Fallback: if the rendered HTML contains no lists but the original markdown
        // clearly contained list markers, build a simple HTML fallback so lists appear.
        // This handles edge cases where the markdown->HTML step dropped/escaped list
        // markers (e.g. due to odd markup or parser differences).
        (function () {
          try {
            const root =
              viewer.querySelector && viewer.querySelector(".blog-content");
            const hasList =
              root && (root.querySelector("ul") || root.querySelector("ol"));
            const markdownHasList =
              /(^|\n)[ \t]*(?:->|=>|→|⇒|[-*+])[ \t]+/m.test(pre);

            if (!hasList && markdownHasList) {
              // Simple, conservative markdown->HTML converter for plain paragraphs + lists.
              // It purposely only supports:
              // - contiguous lines starting with ->, =>, →, ⇒, - , * , +  -> converted into <ul><li>...</li></ul>
              // - other non-empty lines -> wrapped in <p>...</p>
              // This is a fallback to make lists visible; it does not attempt full Markdown conversion.
              function simpleListHtml(md) {
                const lines = String(md || "").split(/\r?\n/);
                let out = "";
                let inList = false;

                for (let i = 0; i < lines.length; i++) {
                  const ln = lines[i];
                  const m = ln.match(/^[ \t]*(?:->|=>|→|⇒|[-*+])[ \t]+(.*)$/);
                  if (m) {
                    // list item
                    if (!inList) {
                      out += "<ul>";
                      inList = true;
                    }
                    out += "<li>" + escapeHtml(m[1].trim()) + "</li>";
                  } else {
                    // non-list line
                    if (inList) {
                      out += "</ul>";
                      inList = false;
                    }
                    if (ln.trim() !== "") {
                      out += "<p>" + escapeHtml(ln) + "</p>";
                    }
                  }
                }

                if (inList) out += "</ul>";
                return out;
              }

              // Replace viewer contents with the fallback HTML generated from the original markdown.
              viewer.innerHTML = `<div class="blog-content">${simpleListHtml(pre)}</div>`;
            }
          } catch (e) {
            // If anything goes wrong, leave the previously-rendered HTML in place.
          }
        })();
      } catch (e) {
        // Fallback to showing escaped markdown on render error
        viewer.innerHTML = `<div class="blog-content"><pre>${escapeHtml(pre)}</pre></div>`;
      }
    } else {
      // No marked available: show escaped raw markdown
      viewer.innerHTML = `<div class="blog-content"><pre>${escapeHtml(pre)}</pre></div>`;
    }

    // Run Prism highlighting if available and normalize/heuristically detect languages
    if (typeof Prism !== "undefined") {
      // Apply syntax highlighting with Prism if available, preferring element-level highlighting.
      try {
        const codeBlocks = viewer
          ? viewer.querySelectorAll("pre code")
          : document.querySelectorAll("pre code");
        codeBlocks.forEach((codeEl) => {
          try {
            // Normalize explicit language tokens that authors sometimes write (e.g. .NET, NET)
            // If the class contains .NET or NET, prefer csharp highlighting
            const cls = codeEl.className || "";
            if (
              /\b(dotnet|\.net|^net$)\b/i.test(cls) ||
              /\b(dotnet|\.net|^net$)\b/i.test(
                codeEl.getAttribute("data-language") || "",
              )
            ) {
              // ensure a Prism language class
              if (!/\blanguage-/.test(codeEl.className)) {
                codeEl.classList.add("language-csharp");
              } else {
                // replace any odd class with language-csharp where appropriate
                codeEl.className = codeEl.className.replace(
                  /\blanguage-[^\s]+\b/,
                  "language-csharp",
                );
              }
            } else if (!/\blanguage-/.test(cls)) {
              // Heuristic: detect C# by common tokens if no language was provided
              const text = (codeEl.textContent || "").slice(0, 800); // only inspect a prefix
              if (
                /\bnamespace\b|\busing\b|\bclass\b|\bConsole\.|\bSystem\./.test(
                  text,
                )
              ) {
                codeEl.classList.add("language-csharp");
              }
            }
            // If class exists but doesn't start with language-, normalize it
            if (codeEl.className && !/\blanguage-/.test(codeEl.className)) {
              const cleaned = codeEl.className.trim().split(/\s+/)[0];
              codeEl.className = "language-" + cleaned;
            }
            // Use prism's element-level highlight for more deterministic behavior
            if (typeof Prism.highlightElement === "function") {
              Prism.highlightElement(codeEl);
            } else if (typeof Prism.highlightAll === "function") {
              Prism.highlightAll();
            }
          } catch (inner) {
            // ignore per-block failures
          }
        });
      } catch (e) {
        // ignore overall highlighting failures
      }

      // Generate IDs for headings for anchor navigation
      try {
        viewer.querySelectorAll("h1, h2, h3, h4, h5, h6").forEach((heading) => {
          if (!heading.id) {
            const text = heading.textContent.trim();
            const id = text
              .toLowerCase()
              .replace(/[^\w\s-]/g, "")
              .replace(/\s+/g, "-")
              .replace(/--+/g, "-")
              .replace(/^-|-$/g, "");
            heading.id = id;
          }
        });
      } catch (e) {
        // ignore heading ID generation failures
      }

      // Handle custom bullet points and distinguish from regular lists (moved to end)

      // Post-process links for navigation
      try {
        viewer.querySelectorAll("a[href]").forEach((linkEl) => {
          const href = linkEl.getAttribute("href");
          if (!href) return;

          if (href.startsWith("#")) {
            // Handle anchor links for table of contents
            linkEl.addEventListener("click", (e) => {
              e.preventDefault();
              const targetId = href.slice(1);
              const targetElement = viewer.querySelector(
                `#${targetId}, [id="${targetId}"]`,
              );
              if (targetElement) {
                // Scroll to element using window scroll since viewer is no longer constrained
                targetElement.scrollIntoView({
                  behavior: "smooth",
                  block: "start",
                });
              }
            });
          } else if (!href.startsWith("http") && !href.startsWith("/")) {
            // This is a relative internal link - check if it matches a blog resource
            linkEl.addEventListener("click", (e) => {
              e.preventDefault();
              handleInternalLinkClick(href);
            });
            // Add CSS class and attributes for internal link styling
            linkEl.classList.add("internal-link");
            linkEl.title = "Click to view resource";
          }
        });
      } catch (e) {
        // ignore link processing failures
      }

      // Handle custom bullet points by looking for arrow patterns in HTML content
      try {
        const listsWithCustomArrows = new Set();

        viewer.querySelectorAll("li").forEach((li) => {
          // Get the text content to check for arrow markers
          const textContent = li.textContent.trim();
          const innerHTML = li.innerHTML;

          // Check for our special arrow markers
          if (
            innerHTML.includes("SINGLEARROW") ||
            innerHTML.includes("DOUBLEARROW")
          ) {
            const isDoubleArrow = innerHTML.includes("DOUBLEARROW");

            // Create arrow span
            const arrowSpan = document.createElement("span");
            arrowSpan.textContent = isDoubleArrow ? "⇒" : "→";
            arrowSpan.style.cssText =
              "color: #14b8a6; font-weight: bold; margin-right: 0.5rem; white-space: nowrap; display: inline-block;";

            // Get the content after removing the marker
            const marker = isDoubleArrow ? "DOUBLEARROW " : "SINGLEARROW ";
            let newContent = innerHTML.replace(marker, "").trim();

            // Replace the content
            li.innerHTML = "";
            li.appendChild(arrowSpan);

            // Create a span for the remaining content and set its innerHTML to preserve any markup
            const textSpan = document.createElement("span");
            textSpan.innerHTML = newContent;
            textSpan.style.cssText = "display: inline; word-break: break-word;";
            li.appendChild(textSpan);

            // Remove list bullet and mark parent list
            li.style.listStyleType = "none";
            li.style.display = "flex";
            li.style.alignItems = "flex-start";
            li.style.gap = "0.25rem";
            const parentList = li.closest("ul, ol");
            if (parentList) {
              listsWithCustomArrows.add(parentList);
            }
          }
        });

        // Mark lists with custom arrows
        listsWithCustomArrows.forEach((list) => {
          list.classList.add("custom-arrows");
        });
      } catch (e) {
        console.warn("Bullet processing failed:", e);
      }
    }
  }

  function renderHtmlIntoViewer(htmlText) {
    const viewer = document.getElementById(VIEWER_ID);
    if (!viewer) return;
    try {
      const parser = new DOMParser();
      const doc = parser.parseFromString(htmlText, "text/html");
      const content = doc.querySelector(".blog-content") || doc.body;
      viewer.innerHTML = `<div class="blog-content">${content.innerHTML}</div>`;
    } catch (e) {
      viewer.innerHTML = `<div class="blog-content"><pre>${escapeHtml(htmlText)}</pre></div>`;
    }
    // Run Prism highlighting per-code-block to ensure normalization logic runs
    if (typeof Prism !== "undefined") {
      try {
        const codeBlocks = viewer.querySelectorAll("pre code");
        codeBlocks.forEach((codeEl) => {
          try {
            // If code block already has language specified like `.NET` or `NET`, normalize to csharp
            const cls = codeEl.className || "";
            if (
              /\b(dotnet|\.net|^net$)\b/i.test(cls) ||
              /\b(dotnet|\.net|^net$)\b/i.test(
                codeEl.getAttribute("data-language") || "",
              )
            ) {
              if (!/\blanguage-/.test(codeEl.className)) {
                codeEl.classList.add("language-csharp");
              } else {
                codeEl.className = codeEl.className.replace(
                  /\blanguage-[^\s]+\b/,
                  "language-csharp",
                );
              }
            } else if (!/\blanguage-/.test(cls)) {
              const text = (codeEl.textContent || "").slice(0, 800);
              if (
                /\bnamespace\b|\busing\b|\bclass\b|\bConsole\.|\bSystem\./.test(
                  text,
                )
              ) {
                codeEl.classList.add("language-csharp");
              }
            }
            if (codeEl.className && !/\blanguage-/.test(codeEl.className)) {
              const cleaned = codeEl.className.trim().split(/\s+/)[0];
              codeEl.className = "language-" + cleaned;
            }
            if (typeof Prism.highlightElement === "function") {
              Prism.highlightElement(codeEl);
            } else if (typeof Prism.highlightAll === "function") {
              Prism.highlightAll();
            }
          } catch (inner) {}
        });
      } catch (e) {}
    }
  }

  function renderTextIntoViewer(text) {
    const viewer = document.getElementById(VIEWER_ID);
    if (!viewer) return;
    viewer.innerHTML = `<div class="blog-content"><pre>${escapeHtml(text)}</pre></div>`;
  }

  // Load and render a given path (absolute or relative)
  async function loadAndRender(path, options = { updateMeta: false }) {
    const viewer = document.getElementById(VIEWER_ID);
    if (!viewer) return;
    try {
      // Ensure we bypass any cached 304 responses so the renderer always
      // receives a current response body.
      const resp = await fetch(path, { cache: "no-store" });
      if (!resp.ok) throw new Error(`${resp.status} ${resp.statusText}`);
      const respUrl = resp && resp.url ? resp.url : path;

      // Guard: avoid rendering the reader page (self) into the viewer. Compare pathnames instead of raw URLs
      // so we catch equivalent URLs that differ only by origin or trailing slashes.
      try {
        const respPath = new URL(respUrl, location.href).pathname;
        const currentPath = location.pathname;
        let readerPath = null;
        try {
          // Resolve the reader's index.html pathname under BLOGS_BASE if possible
          readerPath = BLOGS_BASE
            ? new URL("index.html", BLOGS_BASE).pathname
            : "/blogs/index.html";
        } catch (e) {
          readerPath = "/blogs/index.html";
        }
        if (
          respPath === currentPath ||
          (readerPath && respPath === readerPath)
        ) {
          viewer.innerHTML = `<div class="blog-content"><p class="text-red-400">Refused to render the blog reader page (${escapeHtml(respUrl)}) inside the viewer.</p></div>`;
          return;
        }
      } catch (e) {
        // ignore URL constructor errors and continue
      }

      const text = await resp.text();

      // Basic extension inference from requested path (may be a directory with no extension).
      const ext = (path.split(".").pop() || "").toLowerCase();

      // Detect whether the fetched text is HTML even when the path lacks an .html extension.
      const looksLikeHtml =
        /\<\!doctype|\<html|\<head|\<body|\<title|\<h1/i.test(text);

      // If we received HTML for a path that is likely a directory (no html/md ext),
      // try to detect a directory listing that contains a link to index.md or index.html.
      // If such a link exists, follow it and render that file instead. Otherwise treat
      // the response as HTML and render it via renderHtmlIntoViewer.
      if (
        looksLikeHtml &&
        !/^(md|markdown|html|htm)$/i.test(ext) &&
        !options.skipDirectoryDetection
      ) {
        try {
          // Parse fetched HTML and look for links to index.md / index.html
          const parser = new DOMParser();
          const doc = parser.parseFromString(text, "text/html");
          // Look for anchors whose href ends with index.md / index.html (case-insensitive)
          const anchors = Array.from(doc.querySelectorAll("a[href]"));
          let indexHref = null;
          for (const a of anchors) {
            const href = a.getAttribute("href") || "";
            if (/index\.(md|html|htm)$/i.test(href)) {
              indexHref = href;
              break;
            }
          }
          if (indexHref) {
            // Resolve the found index href relative to the fetched response URL (resp.url) if available,
            // otherwise resolve relative to the requested path.
            let resolved = null;
            try {
              const baseForResolve = resp && resp.url ? resp.url : path;
              resolved = new URL(indexHref, baseForResolve).href;
            } catch (e) {
              // fallback: join with BLOGS_BASE if indexHref looks relative
              try {
                resolved = new URL(indexHref, BLOGS_BASE).href;
              } catch (e2) {
                resolved = (BLOGS_BASE || "") + indexHref;
              }
            }
            // Follow the index file and render it (update meta by default)
            await loadAndRender(resolved, {
              updateMeta: true,
              skipDirectoryDetection: true,
            });
            return;
          } else {
            // No index link found — render the HTML directly (extract .blog-content if present)
            if (options.updateMeta) {
              const metaCandidate = deriveMetaFromHtml(text);
              setMetaUI(normalizeMeta(metaCandidate));
            }
            renderHtmlIntoViewer(text);
            return;
          }
        } catch (e) {
          // If anything fails while handling the HTML directory listing, fall through
          // and continue with other heuristics below.
        }
      }

      // Normal handling by explicit extension (or fallback)
      if (ext === "md" || ext === "markdown") {
        const fm = parseFrontmatter(text);
        let meta = {};

        // Try to load meta.json file first
        try {
          // Extract directory from path
          const pathParts = path.split("/");
          pathParts.pop(); // Remove filename
          const metaPath = pathParts.join("/") + "/meta.json";

          const metaResp = await fetch(metaPath, { cache: "no-store" });
          if (metaResp.ok) {
            const metaJson = await metaResp.json();
            meta = normalizeMeta(metaJson);
          } else {
            throw new Error("meta.json not found");
          }
        } catch (e) {
          // Fallback to frontmatter or inline metadata
          if (Object.keys(fm.meta).length) {
            meta = normalizeMeta(fm.meta);
          } else {
            meta = normalizeMeta(deriveMetaFromMarkdown(fm.body));
          }
        }

        // Always render the clean markdown content without metadata
        renderMarkdownIntoViewer(fm.body || text, path);

        // Extract blog directory from path and use displayName if available
        if (options.updateMeta && options.blogDisplayName) {
          meta.blogDir = options.blogDisplayName;
        } else if (options.updateMeta && options.blogDir) {
          meta.blogDir = options.blogDir;
        }
        if (options.updateMeta) {
          setMetaUI(meta);
          // Update page header with blog name and metadata
          if (typeof window.updatePageHeader === "function") {
            window.updatePageHeader(
              options.blogDisplayName || options.blogDir,
              meta,
            );
          }
        }
      } else if (ext === "html" || looksLikeHtml) {
        const metaCandidate = deriveMetaFromHtml(text);
        const meta = normalizeMeta(metaCandidate);
        if (options.updateMeta && options.blogDisplayName) {
          meta.blogDir = options.blogDisplayName;
        } else if (options.updateMeta && options.blogDir) {
          meta.blogDir = options.blogDir;
        }
        if (options.updateMeta) {
          setMetaUI(meta);
          // Update page header with blog name and metadata
          if (typeof window.updatePageHeader === "function") {
            window.updatePageHeader(
              options.blogDisplayName || options.blogDir,
              meta,
            );
          }
        }
        renderHtmlIntoViewer(text);
      } else if (ext === "txt" || ext === "log" || ext === "ps1") {
        if (options.updateMeta) {
          const meta = normalizeMeta({
            title: path,
            summary: "Resource file",
            author: "—",
            date: "—",
          });
          if (options.blogDisplayName) {
            meta.blogDir = options.blogDisplayName;
          } else if (options.blogDir) {
            meta.blogDir = options.blogDir;
          }
          setMetaUI(meta);
        }
        renderTextIntoViewer(text);
      } else {
        // Unknown extension and not HTML: show as plain text
        viewer.innerHTML = `<div class="blog-content"><pre>${escapeHtml(text)}</pre></div>`;
      }
    } catch (err) {
      viewer.innerHTML = `<div class="blog-content"><p style="color:#f87171">Error loading ${escapeHtml(path)}: ${escapeHtml(String(err.message))}</p></div>`;
    }
  }

  // Resolve a relative file against a base file path
  function resolvePath(base, ref) {
    if (/^https?:\/\//.test(ref) || ref.startsWith("/")) return ref;
    const baseDir = base.substring(0, base.lastIndexOf("/") + 1);
    return baseDir + ref;
  }

  // Build the left-hand tree UI from manifest
  function buildTree(manifest) {
    let container = null;
    for (const id of TREE_IDS) {
      const elc = document.getElementById(id);
      if (elc) {
        container = elc;
        break;
      }
    }
    if (!container) return;
    container.innerHTML = "";

    // Inject minimal CSS for ASCII tree prefixes (only once)
    if (!document.getElementById("blog-tree-ascii-style")) {
      const style = document.createElement("style");
      style.id = "blog-tree-ascii-style";
      style.innerText = `
#blogs-tree .tree-prefix { color: #9ca3af; display: inline-block; width: 1.2em; text-align: left; }
#blogs-tree .tree-item { display: flex; align-items: center; gap: 0.35rem; padding: 2px 0; }
#blogs-tree .tree-label { white-space: nowrap; }
#blogs-tree .resource-list { padding-left: 0; margin: 0; }
#blogs-tree .tree-folder .tree-prefix { font-weight: 600; }
`;
      document.head.appendChild(style);
    }

    const blogs = manifest.blogs || [];
    if (!blogs.length) {
      container.textContent = "No blogs found in manifest.";
      return;
    }

    blogs.forEach((blog) => {
      const dir = blog.dir || blog.id || blog.slug;
      const display =
        blog.displayName || blog.display || dir.replace(/_/g, " ");
      const node = el("div", { class: "blog-node" });

      // create a folder button that contains an ASCII prefix span and a label span
      const prefix = el("span", { class: "tree-prefix" }, "▸");
      const label = el("span", { class: "tree-label" }, " " + display);
      const btn = el(
        "button",
        {
          class: "tree-item tree-folder",
          attrs: {
            "aria-expanded": "false",
            "data-blog-id": blog.id || blog.dir || blog.slug,
          },
        },
        prefix,
        label,
      );
      node.appendChild(btn);

      const resources = el("div", { class: "resource-list ml-4" });

      // When folder clicked, attempt to open its index (prefer manifest.index then common names)
      btn.addEventListener("click", async () => {
        let indexPath = blog.index ? blog.index : null;
        if (!indexPath) {
          const dirPrefix = dir.endsWith("/") ? dir : dir + "/";
          const attempts = [dirPrefix + "index.md", dirPrefix + "index.html"];
          if (Array.isArray(blog.resources)) {
            for (const r of blog.resources) {
              if (/index\.(md|html|htm)$/i.test(r))
                attempts.unshift(dirPrefix + r);
            }
            for (const r of blog.resources) {
              if (/\.md$/i.test(r)) {
                attempts.push(dirPrefix + r);
                break;
              }
            }
          }
          for (const candidate of attempts) {
            try {
              // Use no-store to avoid receiving a 304 that might not include
              // a usable body in the context of programmatic checks.
              const resp = await fetch(BLOGS_BASE + candidate, {
                cache: "no-store",
              });
              if (resp && resp.ok) {
                indexPath = BLOGS_BASE + candidate;
                break;
              }
            } catch (e) {}
          }
        } else {
          // ensure indexPath is relative to BLOGS_BASE if it isn't already
          if (
            !indexPath.startsWith(BLOGS_BASE) &&
            indexPath.indexOf("/") === -1
          ) {
            indexPath =
              BLOGS_BASE + (dir.endsWith("/") ? dir : dir + "/") + indexPath;
          } else if (!indexPath.startsWith(BLOGS_BASE)) {
            // if index declared as 'dir/index.html' leave it as is and prefix BLOGS_BASE
            indexPath = BLOGS_BASE + indexPath;
          }
        }

        if (!indexPath) {
          const viewer = document.getElementById(VIEWER_ID);
          if (viewer)
            viewer.innerHTML = `<div class="blog-content"><p class="text-red-400">Could not locate index for ${escapeHtml(display)}</p></div>`;
          return;
        }

        // update UI selection
        updateTreeSelection(container, btn);

        // Load index (update meta) and pass blog directory and display name
        await loadAndRender(indexPath, {
          updateMeta: true,
          blogDir: dir,
          blogDisplayName: blog.displayName || display,
        });
        // populate resources list
        renderResources(blog, resources, dir);
      });

      node.appendChild(resources);
      container.appendChild(node);

      // populate resources leaves initially
      renderResources(blog, resources, dir);
    });
  }

  // Expose a small helper so other pages/scripts can open a blog by id.
  // This relies on folder buttons carrying `data-blog-id` (set above).
  // Usage: window.openBlogById('AgentTesla_Analysis')
  window.openBlogById = function (id) {
    if (!id) return false;
    try {
      // Exact match by data attribute
      const sel = '#blogs-tree button[data-blog-id="' + id + '"]';
      const btn = document.querySelector(sel);
      if (btn) {
        btn.click();
        return true;
      }

      // Fallback: try to find by visible label text (looser match)
      const buttons = Array.from(
        document.querySelectorAll("#blogs-tree button.tree-folder"),
      );
      for (const b of buttons) {
        const labelEl = b.querySelector(".tree-label");
        const text = labelEl
          ? labelEl.textContent.trim()
          : b.textContent.trim();
        if (text === id || text === " " + id || text.includes(id)) {
          b.click();
          return true;
        }
      }

      console.warn("openBlogById: no matching blog found for", id);
    } catch (e) {
      console.warn("openBlogById error", e);
    }
    return false;
  };

  // Expose helper to open a file directly (absolute URL or path relative to BLOGS_BASE).
  // Enhanced: when passed a directory or a path without an extension, try common index files
  // (index.md, index.html) and prefer the first one that actually exists.
  // Usage: window.openBlogByFile('/blogs/AgentTesla_Analysis/index.md') or window.openBlogByFile('blogs/AgentTesla_Analysis')
  window.openBlogByFile = async function (fileUrl) {
    if (!fileUrl) return false;
    try {
      // Resolve the provided value to an absolute URL if possible, otherwise try to resolve relative to BLOGS_BASE.
      let resolved = null;
      try {
        // This will handle absolute URLs and relative ones against the current document
        resolved = new URL(fileUrl, location.href).href;
      } catch (e) {
        // If URL construction fails, fall back to BLOGS_BASE prefix
        if (typeof BLOGS_BASE === "string") {
          try {
            resolved = new URL(fileUrl, BLOGS_BASE).href;
          } catch (e2) {
            resolved = (BLOGS_BASE || "") + fileUrl;
          }
        } else {
          resolved = fileUrl;
        }
      }

      // Helper: build candidate index URLs when the path looks like a directory or lacks an extension
      function makeCandidates(urlStr) {
        try {
          const u = new URL(urlStr, location.href);
          const origin = u.origin;
          let path = u.pathname || "/";
          // Ensure path ends without double slashes
          if (!path.endsWith("/")) {
            // If there is no extension, consider it a directory candidate
            const hasExt = /\.[a-z0-9]+$/i.test(path.split("/").pop());
            if (!hasExt) path = path + "/";
          }
          const base = origin + path.replace(/^\//, "/");
          // Common index filenames (prefer markdown)
          return [base + "index.md", base + "index.html", urlStr];
        } catch (e) {
          // Fallback string-based candidates (prefix with BLOGS_BASE if available)
          const clean = String(urlStr);
          const trailing = clean.endsWith("/") ? clean : clean + "/";
          const b = typeof BLOGS_BASE === "string" ? BLOGS_BASE : "";
          return [
            b + trailing + "index.md",
            b + trailing + "index.html",
            clean,
          ];
        }
      }

      // Determine whether the resolved value looks like a plain file (has extension) or a directory / id
      let candidates = [resolved];
      try {
        const p = new URL(resolved, location.href).pathname;
        const lastSeg = p.split("/").pop() || "";
        const hasExt = /\.[a-z0-9]+$/i.test(lastSeg);
        if (resolved.endsWith("/") || !hasExt) {
          candidates = makeCandidates(resolved);
        }
      } catch (e) {
        // If URL parsing fails, still attempt reasonable candidates using BLOGS_BASE
        if (typeof BLOGS_BASE === "string") {
          const baseGuess =
            (BLOGS_BASE || "") + fileUrl.toString().replace(/^\//, "");
          candidates = [
            baseGuess + "/index.md",
            baseGuess + "/index.html",
            baseGuess,
          ];
        }
      }

      // Try each candidate (prefer HEAD check to avoid large payloads), fall back to GET if HEAD not allowed
      for (const cand of candidates) {
        try {
          // Use HEAD first to quickly check existence; some static hosts respond to HEAD consistently.
          let resp = null;
          try {
            resp = await fetch(cand, { method: "HEAD", cache: "no-store" });
          } catch (headErr) {
            // HEAD failed — try GET as fallback
            resp = await fetch(cand, { method: "GET", cache: "no-store" });
          }
          if (resp && (resp.ok || resp.status === 200)) {
            const finalUrl = resp.url || cand;
            if (typeof loadAndRender === "function") {
              await loadAndRender(finalUrl, { updateMeta: true });
              return true;
            } else {
              try {
                location.hash = "#" + encodeURIComponent(finalUrl);
                return true;
              } catch (e) {
                return false;
              }
            }
          }
        } catch (e) {
          // ignore and try next candidate
        }
      }

      // If none of the candidates succeeded, fall back to rendering the originally resolved value
      if (typeof loadAndRender === "function") {
        await loadAndRender(resolved, { updateMeta: true });
        return true;
      }

      // As a final fallback, set the hash so other handlers may load the requested file
      try {
        location.hash = "#" + encodeURIComponent(resolved);
      } catch (e) {
        // noop
      }
      return true;
    } catch (e) {
      console.warn("openBlogByFile error", e);
      return false;
    }
  };

  // Helper function to handle internal link clicks
  function handleInternalLinkClick(filename) {
    // First, try to find exact match with .md extension
    let targetFilename = filename;
    if (!filename.endsWith(".md")) {
      targetFilename = filename + ".md";
    }

    // Look for the filename in the current blog's resources
    const resourceLinks = document.querySelectorAll(
      ".resource-item a[data-path]",
    );

    for (const link of resourceLinks) {
      const path = link.getAttribute("data-path");
      if (!path) continue;

      const pathFilename = path.split("/").pop();

      // Try multiple matching strategies
      if (
        pathFilename === targetFilename ||
        pathFilename === filename ||
        (pathFilename.endsWith(".md") && pathFilename.slice(0, -3) === filename)
      ) {
        // Found matching resource - click it to load and update selection
        link.click();
        return;
      }
    }

    // If not found in resources, try to construct the path and load directly
    try {
      // Extract current blog directory from URL or current state
      const urlParams = new URLSearchParams(window.location.search);
      const fileParam = urlParams.get("file");
      let basePath = "";

      if (fileParam) {
        const pathParts = fileParam.split("/");
        if (pathParts.length > 1) {
          basePath = pathParts.slice(0, -1).join("/") + "/";
        }
      }

      if (basePath) {
        const fullPath = basePath + targetFilename;
        // Load the file and update tree selection
        loadAndRender(fullPath, { updateMeta: false }).then(() => {
          // Find and update the selection state for the loaded resource
          const resourceLinks = document.querySelectorAll(
            ".resource-item a[data-path]",
          );
          for (const link of resourceLinks) {
            const path = link.getAttribute("data-path");
            if (path && path.endsWith(targetFilename)) {
              const treeContainer = document.getElementById("blogs-tree-root");
              updateTreeSelection(treeContainer, link);
              break;
            }
          }
        });
      }
    } catch (e) {
      console.warn("Failed to load internal link:", filename, e);
    }
  }

  // Helper function to update tree selection state
  function updateTreeSelection(treeContainer, selectedElement) {
    // Clear all selections in the tree
    treeContainer
      .querySelectorAll(".blog-node button, .resource-item a")
      .forEach((el) => {
        if (el.tagName === "BUTTON") {
          el.setAttribute("aria-expanded", "false");
        } else {
          el.classList.remove("selected");
        }
      });

    // Set the selected element
    if (selectedElement) {
      if (selectedElement.tagName === "BUTTON") {
        selectedElement.setAttribute("aria-expanded", "true");
      } else {
        selectedElement.classList.add("selected");
      }
    }
  }

  function renderResources(blog, container, dir) {
    if (!container) return;
    container.innerHTML = "";
    const dirPrefix = dir.endsWith("/") ? dir : dir + "/";
    const resources = Array.isArray(blog.resources) ? blog.resources : [];
    const filtered = resources.filter(
      (f) => !/^index\.(md|html|htm)$/i.test(f),
    );

    if (!filtered.length) {
      container.appendChild(el("div", { text: "No resource files." }));
      return;
    }

    filtered.forEach((fname, idx) => {
      const item = el("div", { class: "resource-item tree-item tree-file" });

      // ASCII prefix: use branch characters, make last item use corner
      const isLast = idx === filtered.length - 1;
      const marker = isLast ? "└─" : "├─";
      const prefix = el("span", { class: "tree-prefix" }, marker);

      const a = el("a", {
        attrs: { href: "#", "data-path": BLOGS_BASE + dirPrefix + fname },
      });
      // label span keeps content after the prefix, useful for wrapping styling
      const label = el("span", { class: "tree-label" }, " " + fname);
      a.appendChild(label);

      a.addEventListener("click", (e) => {
        e.preventDefault();
        const url = a.getAttribute("data-path");
        if (url) {
          // Update selection state when resource is clicked
          const treeContainer = document.getElementById("blogs-tree-root");
          updateTreeSelection(treeContainer, a);
          loadAndRender(url, { updateMeta: false });
        }
      });
      a.addEventListener("keydown", (e) => {
        if (e.key === "Enter" || e.key === " ") {
          e.preventDefault();
          a.click();
        }
      });

      item.appendChild(prefix);
      item.appendChild(a);
      container.appendChild(item);
    });
  }

  // --- Initialization ---
  // Initialize default view state
  function initializeDefaultView() {
    resetMetaUI();
    const viewer = document.getElementById(VIEWER_ID);
    if (viewer) {
      viewer.innerHTML = `
        <div class="text-center py-12">
          <div class="text-grey-600 text-6xl mb-4">📚</div>
          <p class="text-grey-400">No blog post selected.</p>
          <p class="text-grey-500 text-sm mt-2">Select a post from the sidebar to start reading.</p>
        </div>
      `;
    }
  }

  async function init() {
    // Initialize default view state
    initializeDefaultView();

    // ensure we are on a page with the expected DOM nodes
    let treeContainer = null;
    for (const id of TREE_IDS) {
      const n = document.getElementById(id);
      if (n) {
        treeContainer = n;
        break;
      }
    }
    const viewer = document.getElementById(VIEWER_ID);
    if (!treeContainer || !viewer) {
      // nothing to do
      return;
    }

    try {
      // Try multiple manifest locations (in order) so the renderer is robust on different hosting setups.
      // Prefer a manifest located next to the current page (./manifest.json) so /blogs/index.html resolves to /blogs/manifest.json
      // Then fall back to the script-derived MANIFEST_PATH, the BLOGS_BASE location, and site-level /blogs/manifest.json.
      const manifestCandidates = [];
      try {
        // Prefer manifest next to current page
        manifestCandidates.push(new URL("manifest.json", location.href).href);
      } catch (e) {}
      try {
        manifestCandidates.push(MANIFEST_PATH);
      } catch (e) {}
      try {
        if (typeof BLOGS_BASE === "string") {
          manifestCandidates.push(new URL("manifest.json", BLOGS_BASE).href);
        }
      } catch (e) {}
      try {
        manifestCandidates.push(
          new URL("/blogs/manifest.json", location.origin).href,
        );
      } catch (e) {}
      manifestCandidates.push("manifest.json");

      let manifest = null;
      let lastErr = null;
      for (const candidate of manifestCandidates) {
        try {
          if (typeof console !== "undefined" && console.debug)
            console.debug(
              "[blog_renderer] attempting to load manifest:",
              candidate,
            );
          manifest = await fetchJson(candidate);
          if (typeof console !== "undefined" && console.debug)
            console.debug("[blog_renderer] manifest loaded from:", candidate);
          break;
        } catch (e) {
          lastErr = e;
          if (typeof console !== "undefined" && console.warn)
            console.warn(
              "[blog_renderer] manifest load failed for:",
              candidate,
              e && e.message ? e.message : e,
            );
        }
      }

      if (!manifest) {
        // no candidate succeeded
        throw (
          lastErr ||
          new Error("Failed to load manifest from any known location")
        );
      }

      buildTree(manifest);
      // Keep a reference to the loaded manifest globally so popstate / hash handlers
      // can resolve blog ids into index paths without re-fetching or treating the id
      // as a directory URL (which may return a raw directory listing).
      try {
        window.blogsManifest = manifest;
      } catch (e) {
        // ignore if environment disallows assigning to window
      }

      // auto-open first blog if present
      const first = manifest.blogs && manifest.blogs[0];
      if (first) {
        const firstBtn = treeContainer.querySelector(".blog-node button");
        if (firstBtn) firstBtn.click();
      }

      // handle initial hash
      if (location.hash) {
        const raw = decodeURIComponent(location.hash.replace("#", "")).trim();
        if (raw) {
          let targetUrl = null;
          // If the fragment already looks like a path (contains a slash or an extension), use it as a file/path
          if (raw.includes("/") || /\.\w+$/.test(raw)) {
            targetUrl = raw.includes("/") ? raw : BLOGS_BASE + raw;
          } else {
            // Try to resolve as a blog id using the loaded manifest
            const idx = findIndexPathForBlog(manifest, raw);
            if (idx) {
              targetUrl = idx;
            } else {
              // fallback: treat as a file under BLOGS_BASE
              targetUrl = BLOGS_BASE + raw;
            }
          }
          if (targetUrl) {
            await loadAndRender(targetUrl, { updateMeta: true });
          }
        }
      }
    } catch (err) {
      treeContainer.innerHTML = `<div class="text-red-400">Failed to load blog manifest: ${escapeHtml(String((err && err.message) || err))}</div>`;
      console.warn("Blog manifest fetch error:", err);
    }
  }

  window.addEventListener("popstate", (e) => {
    const state = e.state;
    if (state && state.file) {
      loadAndRender(state.file, { updateMeta: true });
    } else if (location.hash) {
      const raw = decodeURIComponent(location.hash.replace("#", "")).trim();
      if (raw) {
        let target = null;
        // If the fragment is a path-like token, treat as a path
        if (raw.includes("/") || /\.\w+$/.test(raw)) {
          target = raw.includes("/") ? raw : BLOGS_BASE + raw;
        } else {
          // Attempt to resolve the id to an index path using the manifest cached on window
          const manifest = window.blogsManifest || null;
          const idx = manifest ? findIndexPathForBlog(manifest, raw) : null;
          if (idx) target = idx;
          else target = BLOGS_BASE + raw;
        }
        if (target) loadAndRender(target, { updateMeta: true });
      }
    }
  });

  if (document.readyState === "loading")
    document.addEventListener("DOMContentLoaded", init);
  else init();
})();
