// Main JavaScript functionality for portfolio website

// Initialize when DOM is loaded
document.addEventListener('DOMContentLoaded', function() {
    initializeAnimations();
    initializeScrollEffects();
    initializeCounters();
    initializeMobileMenu();
    initializeSmoothScroll();
    initializeNetworkBackground();
});

// Typewriter effect for hero section
function initializeAnimations() {
    // Typed.js initialization
    if (document.getElementById('typed-text')) {
        new Typed('#typed-text', {
            strings: [
                'Exploring Threat Intelligence',
                'Researching Malware',
                'Building Security Tools',
                'Automating Security'
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
    
    // Detect touch devices; on touch we keep click-to-persist behavior, on pointer devices hover will open/close
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    skillCards.forEach(card => {
        card.addEventListener('mouseenter', () => {
            const details = card.querySelector('.skill-details');
            if (details && !details.classList.contains('persist')) {
                anime.remove(details);
                // Ensure element is measurable: temporarily show and set height:auto to get scrollHeight
                details.style.display = 'block';
                details.style.height = 'auto';
                const targetHeight = details.scrollHeight;
                // Reset to 0 before animating
                details.style.height = '0px';
                    anime({
                        targets: details,
                        height: ['0px', targetHeight + 'px'],
                        opacity: [0, 1],
                        duration: 300,
                        easing: 'easeOutQuart',
                        begin: () => { details.style.overflow = 'hidden'; },
                        complete: () => { details.style.height = 'auto'; details.style.overflow = ''; details.style.transform = ''; }
                    });
            }
        });
        
        card.addEventListener('mouseleave', () => {
            const details = card.querySelector('.skill-details');
            if (details && !details.classList.contains('persist')) {
                anime.remove(details);
                // Ensure element is measurable
                if (window.getComputedStyle(details).display === 'none') {
                    details.style.display = 'block';
                    details.style.height = 'auto';
                }
                const currH = details.getBoundingClientRect().height || details.scrollHeight || 0;
                    anime({
                        targets: details,
                        height: [currH + 'px', '0px'],
                        opacity: [1, 0],
                        duration: 250,
                        easing: 'easeInQuart',
                        begin: () => { details.style.overflow = 'hidden'; },
                        complete: () => { details.style.height = '0'; details.style.overflow = 'hidden'; details.style.display = 'none'; }
                    });
            }
        });
        
        // Click-to-persist is only enabled on touch devices (useful for mobile)
        if (isTouch) {
            card.addEventListener('click', (e) => {
                // Avoid triggering click from child interactive elements
                if (e.target.closest('a') || e.target.closest('button')) return;
                const details = card.querySelector('.skill-details');
                if (!details) return;

                // Determine current visibility by computed opacity
                const visible = parseFloat(window.getComputedStyle(details).opacity) > 0.1 || details.classList.contains('persist');
                anime.remove(details);
                if (visible) {
                    // turn off persistent mode and collapse
                    details.classList.remove('persist');
                    const currH = details.getBoundingClientRect().height || details.scrollHeight || 0;
                    anime({
                        targets: details,
                        height: [currH + 'px', '0px'],
                        opacity: [1, 0],
                        duration: 250,
                        easing: 'easeInQuart',
                        begin: () => { details.style.overflow = 'hidden'; },
                        complete: () => { details.style.height = '0'; details.style.overflow = 'hidden'; details.style.display = 'none'; }
                    });
                } else {
                    // set persistent mode so touch doesn't hide it
                    details.classList.add('persist');
                    // Make measurable then animate
                    details.style.display = 'block';
                    details.style.height = 'auto';
                    const targetHeight = details.scrollHeight;
                    details.style.height = '0px';
                    anime({
                        targets: details,
                        height: ['0px', targetHeight + 'px'],
                        opacity: [0, 1],
                        duration: 300,
                        easing: 'easeOutQuart',
                        begin: () => { details.style.overflow = 'hidden'; },
                        complete: () => { details.style.height = 'auto'; details.style.overflow = ''; details.style.transform = ''; }
                    });
                }
            });
        }
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
    const isTouch = ('ontouchstart' in window) || navigator.maxTouchPoints > 0;

    // Helper to close other items
    function closeOtherItems(currentItem) {
        timelineItems.forEach(otherItem => {
            if (otherItem === currentItem) return;
            const otherContent = otherItem.querySelector('.timeline-content');
            if (!otherContent) return;

            const otherComputedHeight = parseFloat(window.getComputedStyle(otherContent).height) || 0;
            const otherIsOpen = otherItem.classList.contains('active') || otherComputedHeight > 0;

            if (otherIsOpen) {
                otherItem.classList.remove('active');
                anime.remove(otherContent);
                anime({
                    targets: otherContent,
                    height: [otherContent.scrollHeight + 'px', '0px'],
                    opacity: [1, 0],
                    duration: 300,
                    easing: 'easeInQuart',
                    begin: () => { otherContent.style.overflow = 'hidden'; },
                    complete: () => { otherContent.style.height = '0'; otherContent.style.overflow = 'hidden'; }
                });
            } else {
                otherItem.classList.remove('active');
                otherContent.style.height = '0';
                otherContent.style.overflow = 'hidden';
                otherContent.style.opacity = 0;
            }
        });
    }

    timelineItems.forEach(item => {
        const content = item.querySelector('.timeline-content');

        if (isTouch) {
            // Tap to toggle on touch devices
            item.addEventListener('click', () => {
                const isActive = item.classList.contains('active');
                closeOtherItems(item);

                if (isActive) {
                    anime.remove(content);
                    const currHeight = content.getBoundingClientRect().height || content.scrollHeight || 0;
                    anime({
                        targets: content,
                        height: [currHeight + 'px', '0px'],
                        opacity: [1, 0],
                        duration: 300,
                        easing: 'easeInQuart',
                        begin: () => { content.style.overflow = 'hidden'; },
                        complete: () => {
                            content.style.height = '0';
                            content.style.overflow = 'hidden';
                            content.style.opacity = 0;
                            item.classList.remove('active');
                        }
                    });
                } else {
                    item.classList.add('active');
                    anime.remove(content);
                    const targetHeight = content.scrollHeight;
                    anime({
                        targets: content,
                        height: ['0px', targetHeight + 'px'],
                        opacity: [0, 1],
                        duration: 400,
                        easing: 'easeOutQuart',
                        begin: () => { content.style.overflow = 'hidden'; content.style.display = 'block'; },
                        complete: () => { content.style.height = 'auto'; content.style.overflow = ''; content.style.opacity = 1; }
                    });
                }
            });
        } else {
            // Hover to open on pointer devices
            item.addEventListener('mouseenter', () => {
                if (item.classList.contains('active')) return;
                closeOtherItems(item);
                item.classList.add('active');
                anime.remove(content);
                content.style.display = 'block';
                const targetHeight = content.scrollHeight;
                content.style.height = '0px';
                anime({
                    targets: content,
                    height: ['0px', targetHeight + 'px'],
                    opacity: [0, 1],
                    duration: 400,
                    easing: 'easeOutQuart',
                    begin: () => { content.style.overflow = 'hidden'; },
                    complete: () => { content.style.height = 'auto'; content.style.overflow = ''; content.style.opacity = 1; }
                });
            });

            item.addEventListener('mouseleave', () => {
                if (!item.classList.contains('active')) return;
                anime.remove(content);
                const currHeight = content.getBoundingClientRect().height || content.scrollHeight || 0;
                anime({
                    targets: content,
                    height: [currHeight + 'px', '0px'],
                    opacity: [1, 0],
                    duration: 300,
                    easing: 'easeInQuart',
                    begin: () => { content.style.overflow = 'hidden'; },
                    complete: () => {
                        content.style.height = '0';
                        content.style.overflow = 'hidden';
                        content.style.display = 'none';
                        item.classList.remove('active');
                    }
                });
            });
        }
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