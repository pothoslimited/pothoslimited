"use strict";

const navigationLinks = Array.from(
    document.querySelectorAll(".nav-link")
);

const observedSections = navigationLinks
    .map((link) => {
        const sectionId = link.getAttribute("href");

        if (!sectionId || !sectionId.startsWith("#")) {
            return null;
        }

        return document.querySelector(sectionId);
    })
    .filter(Boolean);

function setActiveNavigation(sectionId) {
    navigationLinks.forEach((link) => {
        const isActive = link.getAttribute("href") === `#${sectionId}`;

        link.classList.toggle("active", isActive);

        if (isActive) {
            link.setAttribute("aria-current", "location");
        } else {
            link.removeAttribute("aria-current");
        }
    });
}

const siteNavigation = document.querySelector(".site-nav");
let navigationFramePending = false;

function updateHeaderHeight() {
    if (siteNavigation) {
        document.documentElement.style.setProperty(
            "--header-height",
            `${siteNavigation.getBoundingClientRect().height}px`
        );
    }
    scheduleNavigationUpdate();
}

updateHeaderHeight();
if ("ResizeObserver" in window && siteNavigation) {
    new ResizeObserver(updateHeaderHeight).observe(siteNavigation);
}
window.addEventListener("resize", updateHeaderHeight);


function updateActiveNavigation() {
    // Track the section below the sticky header, independent of section height.
    const activationLine = (siteNavigation?.getBoundingClientRect().bottom || 0) + 24;
    const activeSection = observedSections.find((section) => {
        const bounds = section.getBoundingClientRect();
        return bounds.top <= activationLine && bounds.bottom > activationLine;
    });
    const atPageEnd = window.scrollY > 0 &&
        window.scrollY + window.innerHeight >= document.documentElement.scrollHeight - 2;
    setActiveNavigation(atPageEnd ? observedSections.at(-1)?.id : activeSection?.id);
    navigationFramePending = false;
}

function scheduleNavigationUpdate() {
    if (!navigationFramePending) {
        navigationFramePending = true;
        window.requestAnimationFrame(updateActiveNavigation);
    }
}

window.addEventListener("scroll", scheduleNavigationUpdate, { passive: true });
window.addEventListener("resize", scheduleNavigationUpdate);
window.addEventListener("load", scheduleNavigationUpdate);
updateActiveNavigation();

navigationLinks.forEach((link) => {
    link.addEventListener("click", () => {
        const sectionId = link.getAttribute("href")?.replace("#", "");

        if (sectionId) {
            setActiveNavigation(sectionId);
        }
    });
});

const currentYearElement = document.getElementById("current-year");

if (currentYearElement) {
    currentYearElement.textContent = String(new Date().getFullYear());
}

const projectLightbox = document.getElementById("project-lightbox");

if (projectLightbox) {
    const lightboxImage = projectLightbox.querySelector(".lightbox-image");
    const lightboxCaption = projectLightbox.querySelector(".lightbox-caption");
    const closeButton = projectLightbox.querySelector(".lightbox-close");
    const previousButton = projectLightbox.querySelector(".lightbox-previous");
    const nextButton = projectLightbox.querySelector(".lightbox-next");
    const projectPhotos = Array.from(document.querySelectorAll(".project-photo, .gallery-item"));
    let activePhotos = [];
    let activePhotoIndex = 0;
    let photoRequest = 0;
    let swipeStart = null;
    const lightboxStatus = projectLightbox.querySelector(".lightbox-status");
    const retryButton = projectLightbox.querySelector(".lightbox-retry");
    const lightboxFigure = projectLightbox.querySelector(".lightbox-figure");

    function markPhotoUnavailable(photo, image) {
        if (photo.classList.contains("is-unavailable")) {
            return;
        }

        const placeholder = document.createElement("span");
        placeholder.className = "project-photo-placeholder";
        placeholder.textContent = "Photo coming soon";

        photo.classList.add("is-unavailable");
        photo.disabled = true;
        photo.setAttribute("aria-label", `Photo unavailable: ${image.alt}`);
        photo.append(placeholder);
    }

    async function renderActivePhoto() {
        const photo = activePhotos[activePhotoIndex];
        const image = photo?.querySelector(".project-image, .gallery-image");
        const projectName = photo
            ?.closest(".project-card")
            ?.querySelector("h3")
            ?.textContent.trim();

        if (!image || !lightboxImage || !lightboxCaption) {
            return;
        }

        const request = ++photoRequest;
        const caption = `${projectName || image.alt} - ${activePhotoIndex + 1} of ${activePhotos.length}`;
        const pendingImage = new Image();
        lightboxImage.classList.add("is-pending");
        lightboxImage.setAttribute("aria-busy", "true");
        lightboxCaption.textContent = "";
        lightboxStatus.textContent = "Loading photo…";
        retryButton.hidden = true;
        pendingImage.src = image.src;

        try {
            await pendingImage.decode();
            // Ignore old requests after another navigation, close, or reopen.
            if (request !== photoRequest || !projectLightbox.open) return;
            lightboxImage.src = pendingImage.src;
            lightboxImage.alt = image.alt;
            lightboxImage.classList.remove("is-pending");
            lightboxCaption.textContent = caption;
            lightboxStatus.textContent = "";
            if (document.activeElement === retryButton) closeButton?.focus();
        } catch {
            if (request !== photoRequest || !projectLightbox.open) return;
            lightboxStatus.textContent = "This photo couldn’t load. Try again or choose another photo.";
            retryButton.hidden = false;
        } finally {
            if (request === photoRequest) lightboxImage.removeAttribute("aria-busy");
        }
    }

    function openLightbox(photo) {
        if (projectLightbox.open) {
            return;
        }

        activePhotos = Array.from(
            photo.closest(".project-gallery, .gallery-grid")?.querySelectorAll(
                ".project-photo:not(.is-unavailable), .gallery-item:not(.is-unavailable)"
            ) || []
        );
        activePhotoIndex = activePhotos.indexOf(photo);

        if (activePhotoIndex < 0) {
            return;
        }

        document.body.classList.add("lightbox-open");
        projectLightbox.showModal();
        renderActivePhoto();
    }

    function showAdjacentPhoto(direction) {
        if (!projectLightbox.open || activePhotos.length === 0) return;
        activePhotoIndex =
            (activePhotoIndex + direction + activePhotos.length) %
            activePhotos.length;
        renderActivePhoto();
    }

    projectPhotos.forEach((photo) => {
        const image = photo.querySelector(".project-image, .gallery-image");

        photo.setAttribute("aria-controls", projectLightbox.id);
        photo.setAttribute("aria-haspopup", "dialog");

        if (image) {
            photo.setAttribute("aria-label", `View larger: ${image.alt}`);
            image.addEventListener("error", () => markPhotoUnavailable(photo, image));

            if (image.complete && image.naturalWidth === 0) {
                markPhotoUnavailable(photo, image);
            }
        }

        photo.addEventListener("click", () => openLightbox(photo));
    });

    retryButton.addEventListener("click", () => {
        // Keep keyboard focus on a visible control while the retry loads.
        closeButton?.focus();
        renderActivePhoto();
    });

    lightboxFigure.addEventListener("touchstart", (event) => {
        swipeStart = event.touches.length === 1 &&
            !event.target.closest("button") && (window.visualViewport?.scale || 1) <= 1
            ? { x: event.touches[0].clientX, y: event.touches[0].clientY }
            : null;
    }, { passive: true });

    lightboxFigure.addEventListener("touchend", (event) => {
        const start = swipeStart;
        swipeStart = null;
        if (!start || event.touches.length || event.changedTouches.length !== 1) return;
        const horizontal = event.changedTouches[0].clientX - start.x;
        const vertical = event.changedTouches[0].clientY - start.y;
        if (Math.abs(horizontal) >= 50 && Math.abs(horizontal) > Math.abs(vertical) * 1.5) {
            showAdjacentPhoto(horizontal < 0 ? 1 : -1);
        }
    }, { passive: true });

    lightboxFigure.addEventListener("touchcancel", () => { swipeStart = null; }, { passive: true });

    closeButton?.addEventListener("click", () => projectLightbox.close());
    previousButton?.addEventListener("click", () => showAdjacentPhoto(-1));
    nextButton?.addEventListener("click", () => showAdjacentPhoto(1));

    projectLightbox.addEventListener("click", (event) => {
        if (event.target === projectLightbox) {
            projectLightbox.close();
        }
    });

    projectLightbox.addEventListener("keydown", (event) => {
        if (event.key === "ArrowLeft") {
            event.preventDefault();
            showAdjacentPhoto(-1);
        } else if (event.key === "ArrowRight") {
            event.preventDefault();
            showAdjacentPhoto(1);
        }
    });

    projectLightbox.addEventListener("close", () => {
        ++photoRequest;
        swipeStart = null;
        lightboxStatus.textContent = "";
        retryButton.hidden = true;
        lightboxImage?.classList.remove("is-pending");
        lightboxImage?.removeAttribute("aria-busy");
        document.body.classList.remove("lightbox-open");
        lightboxImage?.removeAttribute("src");
        lightboxImage?.removeAttribute("alt");

        if (lightboxCaption) {
            lightboxCaption.textContent = "";
        }

        activePhotos = [];
        activePhotoIndex = 0;
    });
}
