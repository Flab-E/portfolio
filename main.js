// Main JavaScript functionality for portfolio website

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeAnimations();
    initializeScrollEffects();
    initializeCounters();
    initializeMobileMenu();
    initializeSmoothScroll();
    initializeNetworkBackground();
    // initialize skills interactions on pages that include skill cards
    if (typeof initializeSkillsMatrix === 'function') {
        initializeSkillsMatrix();
    }
});

// --- File viewer for blog pages ---
function initializeFileViewer() {
    const viewer = document.getElementById('blog-viewer');
    if (!viewer) return;

    async function loadFile(filename, pushHistory = true) {
        if (!filename) return;
        try {
            let resp = await fetch(filename);
            if (!resp.ok) {
                // Try fallback to filename + '.md' for files that may have been saved as markdown
                if (!filename.toLowerCase().endsWith('.md')) {
                    const alt = filename + '.md';
                    resp = await fetch(alt);
                    if (resp.ok) {
                        filename = alt;
                    }
                }
            }

            if (!resp.ok) {
                viewer.innerHTML = `<div class="blog-content bg-grey-800 p-8 rounded-xl"><p class="text-red-400">Failed to load ${filename}: ${resp.status} ${resp.statusText}</p></div>`;
                return;
            }

            const ext = filename.split('.').pop().toLowerCase();
            const text = await resp.text();

            if (ext === 'md' || ext === 'markdown') {
                // Preprocess wiki-style embeds and links before rendering
                const preprocessed = preprocessWikiLinks(text);
                // render markdown using marked (ensure marked is loaded)
                const html = (typeof marked !== 'undefined') ? marked.parse(preprocessed) : `<pre>${escapeHtml(preprocessed)}</pre>`;
                viewer.innerHTML = `<div class="blog-content bg-grey-800 p-8 rounded-xl">${html}</div>`;
                // After rendering, wire internal hash links inside the rendered markdown
                wireViewerAnchors();
                // Highlight code blocks if Prism is available
                if (typeof Prism !== 'undefined' && Prism.highlightAll) {
                    Prism.highlightAll();
                }
            } else if (ext === 'txt' || ext === 'ps1' || ext === 'log') {
                viewer.innerHTML = `<div class="blog-content bg-grey-800 p-8 rounded-xl"><pre>${escapeHtml(text)}</pre></div>`;
            } else if (ext === 'html') {
                // Parse fetched HTML and extract only the .blog-content element to avoid embedding the full page
                try {
                    const parser = new DOMParser();
                    const doc = parser.parseFromString(text, 'text/html');
                    const content = doc.querySelector('.blog-content');
                    if (content) {
                        // Keep outer wrapper styles consistent
                        viewer.innerHTML = `<div class="blog-content bg-grey-800 p-8 rounded-xl">${content.innerHTML}</div>`;
                        // Wire any anchors inside the extracted HTML
                        wireViewerAnchors();
                        if (typeof Prism !== 'undefined' && Prism.highlightAll) Prism.highlightAll();
                    } else {
                        // fallback: show full HTML inside a pre tag
                        viewer.innerHTML = `<div class="blog-content bg-grey-800 p-8 rounded-xl"><pre>${escapeHtml(text)}</pre></div>`;
                    }
                } catch (e) {
                    viewer.innerHTML = `<div class="blog-content bg-grey-800 p-8 rounded-xl"><pre>${escapeHtml(text)}</pre></div>`;
                }
            } else {
                viewer.innerHTML = `<div class="blog-content bg-grey-800 p-8 rounded-xl"><pre>${escapeHtml(text)}</pre></div>`;
            }

            if (pushHistory) {
                history.pushState({ file: filename }, '', `#${encodeURIComponent(filename)}`);
            }
        } catch (err) {
            viewer.innerHTML = `<div class="blog-content bg-grey-800 p-8 rounded-xl"><p class="text-red-400">Error loading ${filename}: ${escapeHtml(err.message)}</p></div>`;
        }
    }

    // Wire file links (anywhere on the page) that use the file-link class + data-file
    document.querySelectorAll('a.file-link[data-file]').forEach(link => {
        link.addEventListener('click', (e) => {
            const file = link.getAttribute('data-file');
            if (file) {
                // Prevent other global anchor handlers (like smooth-scroll) from intercepting
                e.preventDefault();
                e.stopImmediatePropagation();
                loadFile(file);
            }
        });
    });

    // Handle back/forward navigation
    window.addEventListener('popstate', (e) => {
        const state = e.state;
        if (state && state.file) {
            loadFile(state.file, false);
        } else if (location.hash) {
            const file = decodeURIComponent(location.hash.replace('#', ''));
            if (file) loadFile(file, false);
        } else {
            // no state: reload original content (do nothing)
        }
    });

    // On initial load, if there's a hash, try to load it
    if (location.hash) {
        const file = decodeURIComponent(location.hash.replace('#', ''));
        if (file) loadFile(file, false);
    }

    function escapeHtml(s) {
        return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
    }

    // Convert wiki-style ![[image.png]] and [[file.ext]] links into standard markdown and internal anchors
    function preprocessWikiLinks(text) {
        // Images: ![[...]] -> ![](assets/filename)
        let out = text.replace(/!\[\[(.+?)\]\]/g, (m, p1) => {
            let name = p1.trim();
            // normalize spaces to underscores and lowercase
            name = name.replace(/\s+/g, '_').toLowerCase();
            // if it already has assets/, keep it; else prefix
            if (!name.startsWith('assets/')) name = 'assets/' + name;
            return `![](${name})`;
        });

        // Links: [[file.ext]] -> [file.ext](#file.ext(.md fallback added by loader))
        out = out.replace(/\[\[(.+?)\]\]/g, (m, p1) => {
            const target = p1.trim();
            if (/\./.test(target)) {
                let href = target;
                if (!href.toLowerCase().endsWith('.md')) href = href + '.md';
                return `[${target}](#${encodeURIComponent(href)})`;
            }
            // otherwise return plain text (likely a section title or tag)
            return target;
        });

        return out;
    }

    // Wire anchors inside the viewer so they load files via the viewer instead of navigating the page
    function wireViewerAnchors() {
        const viewerEl = document.getElementById('blog-viewer');
        if (!viewerEl) return;
        viewerEl.querySelectorAll('a[href^="#"]').forEach(a => {
            a.addEventListener('click', (e) => {
                const href = a.getAttribute('href');
                if (!href) return;
                const file = decodeURIComponent(href.replace('#', ''));
                if (file) {
                    e.preventDefault();
                    loadFile(file);
                }
            });
        });
    }
}

// Initialize viewer after DOM is ready
document.addEventListener('DOMContentLoaded', initializeFileViewer);

// Typewriter effect for hero section
function initializeAnimations() {
    // Typed.js initialization
    if (document.getElementById('typed-text')) {
        new Typed('#typed-text', {
            strings: [
                'Threat Researcher',
                'Malware Analyst', 
                'Security Expert',
                'Automation Specialist'
            ],
            typeSpeed: 80,
            backSpeed: 50,
            backDelay: 2000,
            loop: true,
            showCursor: true,
            cursorChar: '|'
        });
    }

    // Splitting.js for text animations
    if (typeof Splitting !== 'undefined') {
        Splitting();
    }
}

// Scroll reveal animations
function initializeScrollEffects() {
    const observerOptions = {
        threshold: 0.1,
        rootMargin: '0px 0px -50px 0px'
    };

    const observer = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                entry.target.classList.add('revealed');
            }
        });
    }, observerOptions);

    // Observe all scroll-reveal elements
    document.querySelectorAll('.scroll-reveal').forEach(el => {
        observer.observe(el);
    });
}

// Animated counters for skills section
function initializeCounters() {
    const counters = document.querySelectorAll('.skill-counter');
    
    const counterObserver = new IntersectionObserver((entries) => {
        entries.forEach(entry => {
            if (entry.isIntersecting) {
                const counter = entry.target;
                const target = parseInt(counter.getAttribute('data-target'));
                animateCounter(counter, target);
                counterObserver.unobserve(counter);
            }
        });
    }, { threshold: 0.5 });

    counters.forEach(counter => {
        counterObserver.observe(counter);
    });
}

function animateCounter(element, target) {
    let current = 0;
    const increment = target / 50;
    const timer = setInterval(() => {
        current += increment;
        if (current >= target) {
            current = target;
            clearInterval(timer);
        }
        element.textContent = Math.floor(current);
    }, 40);
}

// Mobile menu functionality
function initializeMobileMenu() {
    const mobileMenuBtn = document.getElementById('mobile-menu-btn');
    const nav = document.querySelector('nav');
    
    if (mobileMenuBtn) {
        mobileMenuBtn.addEventListener('click', () => {
            // Create mobile menu if it doesn't exist
            let mobileMenu = document.getElementById('mobile-menu');
            if (!mobileMenu) {
                mobileMenu = document.createElement('div');
                mobileMenu.id = 'mobile-menu';
                mobileMenu.className = 'md:hidden bg-primary-dark border-t border-grey-800 py-4';
                mobileMenu.innerHTML = `
                    <div class="flex flex-col space-y-4 px-6">
                        <a href="#home" class="text-primary-light hover:text-accent-teal transition-colors">Home</a>
                        <a href="about.html" class="text-primary-light hover:text-accent-teal transition-colors">About</a>
                        <a href="projects.html" class="text-primary-light hover:text-accent-teal transition-colors">Projects</a>
                        <a href="contact.html" class="text-primary-light hover:text-accent-teal transition-colors">Contact</a>
                    </div>
                `;
                nav.appendChild(mobileMenu);
            }
            
            mobileMenu.classList.toggle('hidden');
        });
    }
}

// Smooth scroll navigation
function initializeSmoothScroll() {
    document.querySelectorAll('a[href^="#"]').forEach(anchor => {
        anchor.addEventListener('click', function (e) {
            e.preventDefault();
            const target = document.querySelector(this.getAttribute('href'));
            if (target) {
                const offsetTop = target.offsetTop - 80; // Account for fixed nav
                window.scrollTo({
                    top: offsetTop,
                    behavior: 'smooth'
                });
            }
        });
    });
}

// Network background animation using p5.js
function initializeNetworkBackground() {
    if (document.getElementById('network-canvas')) {
        new p5((p) => {
            let nodes = [];
            let connections = [];
            const numNodes = 50;
            
            p.setup = () => {
                const canvas = p.createCanvas(p.windowWidth, p.windowHeight);
                canvas.parent('network-canvas');
                
                // Create nodes
                for (let i = 0; i < numNodes; i++) {
                    nodes.push({
                        x: p.random(p.width),
                        y: p.random(p.height),
                        vx: p.random(-0.5, 0.5),
                        vy: p.random(-0.5, 0.5),
                        size: p.random(2, 6)
                    });
                }
            };
            
            p.draw = () => {
                p.clear();
                
                // Update and draw nodes
                nodes.forEach((node, i) => {
                    // Update position
                    node.x += node.vx;
                    node.y += node.vy;
                    
                    // Bounce off edges
                    if (node.x < 0 || node.x > p.width) node.vx *= -1;
                    if (node.y < 0 || node.y > p.height) node.vy *= -1;
                    
                    // Draw node
                    p.fill(20, 184, 166, 100);
                    p.noStroke();
                    p.ellipse(node.x, node.y, node.size);
                    
                    // Draw connections
                    nodes.forEach((otherNode, j) => {
                        if (i !== j) {
                            const distance = p.dist(node.x, node.y, otherNode.x, otherNode.y);
                            if (distance < 100) {
                                const alpha = p.map(distance, 0, 100, 50, 0);
                                p.stroke(20, 184, 166, alpha);
                                p.strokeWeight(0.5);
                                p.line(node.x, node.y, otherNode.x, otherNode.y);
                            }
                        }
                    });
                });
            };
            
            p.windowResized = () => {
                p.resizeCanvas(p.windowWidth, p.windowHeight);
            };
        });
    }
}

// Project filtering functionality (for projects page)
function initializeProjectFiltering() {
    const filterButtons = document.querySelectorAll('.filter-btn');
    const projectCards = document.querySelectorAll('.project-card');
    
    filterButtons.forEach(button => {
        button.addEventListener('click', () => {
            const filter = button.getAttribute('data-filter');
            
            // Update active button
            filterButtons.forEach(btn => btn.classList.remove('active'));
            button.classList.add('active');
            
            // Filter projects
            projectCards.forEach(card => {
                const categories = card.getAttribute('data-categories').split(',');
                if (filter === 'all' || categories.includes(filter)) {
                    card.style.display = 'block';
                    anime({
                        targets: card,
                        opacity: [0, 1],
                        translateY: [20, 0],
                        duration: 500,
                        easing: 'easeOutQuart'
                    });
                } else {
                    anime({
                        targets: card,
                        opacity: 0,
                        translateY: -20,
                        duration: 300,
                        easing: 'easeInQuart',
                        complete: () => {
                            card.style.display = 'none';
                        }
                    });
                }
            });
        });
    });
}

// Skills matrix interaction (for about page)
function initializeSkillsMatrix() {
    const skillCards = document.querySelectorAll('.skill-card');
    
    skillCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            const details = card.querySelector('.skill-details');
            if (details) {
                anime({
                    targets: details,
                    opacity: [0, 1],
                    translateY: [10, 0],
                    duration: 300,
                    easing: 'easeOutQuart'
                });
            }
        });
        
        card.addEventListener('mouseleave', () => {
            const details = card.querySelector('.skill-details');
            if (details) {
                anime({
                    targets: details,
                    opacity: 0,
                    translateY: 10,
                    duration: 200,
                    easing: 'easeInQuart'
                });
            }
        });
    });
}

// Contact form validation (for contact page)
function initializeContactForm() {
    const form = document.getElementById('contact-form');
    
    if (form) {
        form.addEventListener('submit', (e) => {
            e.preventDefault();
            
            // Get form data
            const formData = new FormData(form);
            const data = Object.fromEntries(formData);
            
            // Validate form
            if (validateContactForm(data)) {
                // Show success message
                showFormMessage('Message sent successfully!', 'success');
                form.reset();
            } else {
                showFormMessage('Please fill in all required fields correctly.', 'error');
            }
        });
    }
}

function validateContactForm(data) {
    const emailRegex = /^[^\s@]+@[^\s@]+\.[^\s@]+$/;
    
    return (
        data.name && 
        data.name.trim().length >= 2 &&
        data.email &&
        emailRegex.test(data.email) &&
        data.message &&
        data.message.trim().length >= 10
    );
}

function showFormMessage(message, type) {
    const messageDiv = document.createElement('div');
    messageDiv.className = `fixed top-20 right-6 p-4 rounded-lg z-50 ${
        type === 'success' ? 'bg-green-600' : 'bg-red-600'
    } text-white`;
    messageDiv.textContent = message;
    
    document.body.appendChild(messageDiv);
    
    // Animate in
    anime({
        targets: messageDiv,
        translateX: [300, 0],
        opacity: [0, 1],
        duration: 300,
        easing: 'easeOutQuart'
    });
    
    // Remove after 3 seconds
    setTimeout(() => {
        anime({
            targets: messageDiv,
            translateX: 300,
            opacity: 0,
            duration: 300,
            easing: 'easeInQuart',
            complete: () => {
                messageDiv.remove();
            }
        });
    }, 3000);
}

// Timeline interaction (for about page)
function initializeTimeline() {
    const timelineItems = document.querySelectorAll('.timeline-item');
    // Ensure each timeline content starts in a deterministic closed/open state.
    timelineItems.forEach(item => {
        const content = item.querySelector('.timeline-content');
        if (!content) return;
        if (item.classList.contains('active')) {
            // If markup marked it active, keep it open
            content.style.height = 'auto';
            content.style.opacity = '1';
        } else {
            // Force closed state explicitly so measurements are predictable
            content.style.height = '0px';
            content.style.opacity = '0';
        }
    });

    timelineItems.forEach(item => {
        item.addEventListener('click', () => {
            const content = item.querySelector('.timeline-content');
            if (!content) return;
            const isActive = item.classList.contains('active');

            // Close only other items that are explicitly marked active. This avoids
            // using transient layout measurements (which can be non-zero) to decide
            // whether to animate unrelated items.
            timelineItems.forEach(otherItem => {
                if (otherItem === item) return;
                if (!otherItem.classList.contains('active')) return;
                const otherContent = otherItem.querySelector('.timeline-content');
                if (!otherContent) return;
                // Measure an explicit pixel height and apply it so the animation
                // starts from a concrete numeric value instead of 'auto'. This
                // prevents short/snappy closes caused by inconsistent measurements.
                const otherHeight = otherContent.scrollHeight || otherContent.offsetHeight || 0;
                otherContent.style.height = otherHeight + 'px';
                // force layout so the browser registers the explicit height
                // before anime starts
                /* eslint-disable no-unused-expressions */
                otherContent.offsetHeight;
                /* eslint-enable no-unused-expressions */
                anime.remove(otherContent);
                anime({
                    targets: otherContent,
                    height: [otherHeight, 0],
                    opacity: [1, 0],
                    duration: 400,
                    easing: 'easeInOutQuart',
                    complete: () => {
                        otherContent.style.height = '0px';
                        otherContent.style.opacity = '0';
                        otherItem.classList.remove('active');
                    }
                });
            });

            // Toggle current item
            if (isActive) {
                // Ensure a concrete start height (not 'auto') so the close
                // animation is smooth and consistent.
                const from = content.scrollHeight || content.offsetHeight || 0;
                content.style.height = from + 'px';
                /* force layout */
                content.offsetHeight;
                anime.remove(content);
                anime({
                    targets: content,
                    height: [from, 0],
                    opacity: [1, 0],
                    duration: 400,
                    easing: 'easeInOutQuart',
                    complete: () => {
                        content.style.height = '0px';
                        content.style.opacity = '0';
                        item.classList.remove('active');
                    }
                });
            } else {
                // measure full height
                content.style.height = 'auto';
                const full = content.scrollHeight;
                content.style.height = '0px';
                content.style.opacity = '0';
                anime.remove(content);
                anime({
                    targets: content,
                    height: [0, full],
                    opacity: [0, 1],
                    duration: 400,
                    easing: 'easeOutQuart',
                    begin: () => {
                        // mark active so other clicks know this is opening
                        item.classList.add('active');
                    },
                    complete: () => {
                        content.style.height = 'auto';
                        content.style.opacity = '1';
                    }
                });
            }
        });
    });
}

// Utility functions
function debounce(func, wait) {
    let timeout;
    return function executedFunction(...args) {
        const later = () => {
            clearTimeout(timeout);
            func(...args);
        };
        clearTimeout(timeout);
        timeout = setTimeout(later, wait);
    };
}

// Back to top button
function initializeBackToTop() {
    const backToTopBtn = document.createElement('button');
    backToTopBtn.innerHTML = '↑';
    backToTopBtn.className = 'fixed bottom-6 right-6 w-12 h-12 bg-accent-teal text-white rounded-full shadow-lg opacity-0 transition-all duration-300 z-40';
    backToTopBtn.style.transform = 'translateY(100px)';
    document.body.appendChild(backToTopBtn);
    
    const toggleBackToTop = debounce(() => {
        if (window.scrollY > 300) {
            backToTopBtn.style.opacity = '1';
            backToTopBtn.style.transform = 'translateY(0)';
        } else {
            backToTopBtn.style.opacity = '0';
            backToTopBtn.style.transform = 'translateY(100px)';
        }
    }, 100);
    
    window.addEventListener('scroll', toggleBackToTop);
    
    backToTopBtn.addEventListener('click', () => {
        window.scrollTo({
            top: 0,
            behavior: 'smooth'
        });
    });
}

// Initialize back to top button
initializeBackToTop();

// Ensure directory tree links open correctly and are keyboard accessible
function initializeDirectoryTreeLinks() {
    const fileLinks = document.querySelectorAll('.directory-tree a.file-link');
    if (!fileLinks || fileLinks.length === 0) return;

    fileLinks.forEach(link => {
        // If JavaScript is available, ensure Enter key opens the link when focused
        link.addEventListener('keydown', (e) => {
            if (e.key === 'Enter' || e.key === ' ') {
                e.preventDefault();
                // open in new tab if target=_blank, else navigate
                const target = link.getAttribute('target');
                const href = link.getAttribute('href');
                if (target === '_blank') {
                    window.open(href, '_blank', 'noopener');
                } else {
                    window.location.href = href;
                }
            }
        });

        // For older browsers that may block target=_blank, provide a click fallback
        link.addEventListener('click', (e) => {
            // Allow normal behavior, but ensure noopener is used
            const target = link.getAttribute('target');
            if (target === '_blank') {
                e.preventDefault();
                window.open(link.getAttribute('href'), '_blank', 'noopener');
            }
        });
    });
}

// Run after DOM ready
document.addEventListener('DOMContentLoaded', initializeDirectoryTreeLinks);