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

if ("IntersectionObserver" in window) {
    const visibleSections = new Map();
    const observer = new IntersectionObserver(
        (entries) => {
            entries.forEach((entry) => {
                if (entry.isIntersecting) {
                    visibleSections.set(entry.target, entry.intersectionRatio);
                } else {
                    visibleSections.delete(entry.target);
                }
            });

            const visibleEntries = Array.from(visibleSections)
                .sort(
                    (firstEntry, secondEntry) =>
                        secondEntry[1] - firstEntry[1]
                );

            if (visibleEntries.length > 0) {
                setActiveNavigation(visibleEntries[0][0].id);
            }
        },
        {
            rootMargin: "-30% 0px -55% 0px",
            threshold: [0.05, 0.2, 0.5]
        }
    );

    observedSections.forEach((section) => {
        observer.observe(section);
    });
}

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
    const projectPhotos = Array.from(document.querySelectorAll(".project-photo"));
    let activePhotos = [];
    let activePhotoIndex = 0;

    function markPhotoUnavailable(photo, image) {
        if (photo.classList.contains("is-unavailable")) {
            return;
        }

        const placeholder = document.createElement("span");
        placeholder.className = "project-photo-placeholder";
        placeholder.textContent = "Project photo coming soon";

        photo.classList.add("is-unavailable");
        photo.disabled = true;
        photo.setAttribute("aria-label", `Photo unavailable: ${image.alt}`);
        photo.append(placeholder);
    }

    function renderActivePhoto() {
        const photo = activePhotos[activePhotoIndex];
        const image = photo?.querySelector(".project-image");
        const projectName = photo
            ?.closest(".project-card")
            ?.querySelector("h3")
            ?.textContent.trim();

        if (!image || !lightboxImage || !lightboxCaption) {
            return;
        }

        lightboxImage.src = image.src;
        lightboxImage.alt = image.alt;
        lightboxCaption.textContent = `${projectName || "Project"} - ${activePhotoIndex + 1} of ${activePhotos.length}`;
    }

    function openLightbox(photo) {
        if (projectLightbox.open) {
            return;
        }

        activePhotos = Array.from(
            photo.closest(".project-gallery")?.querySelectorAll(
                ".project-photo:not(.is-unavailable)"
            ) || []
        );
        activePhotoIndex = activePhotos.indexOf(photo);

        if (activePhotoIndex < 0) {
            return;
        }

        renderActivePhoto();
        document.body.classList.add("lightbox-open");
        projectLightbox.showModal();
    }

    function showAdjacentPhoto(direction) {
        activePhotoIndex =
            (activePhotoIndex + direction + activePhotos.length) %
            activePhotos.length;
        renderActivePhoto();
    }

    projectPhotos.forEach((photo) => {
        const image = photo.querySelector(".project-image");

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
            showAdjacentPhoto(-1);
        } else if (event.key === "ArrowRight") {
            showAdjacentPhoto(1);
        }
    });

    projectLightbox.addEventListener("close", () => {
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
