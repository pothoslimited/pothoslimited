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
    const observer = new IntersectionObserver(
        (entries) => {
            const visibleEntries = entries
                .filter((entry) => entry.isIntersecting)
                .sort(
                    (firstEntry, secondEntry) =>
                        secondEntry.intersectionRatio -
                        firstEntry.intersectionRatio
                );

            if (visibleEntries.length > 0) {
                setActiveNavigation(visibleEntries[0].target.id);
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

        lightboxImage.src = image.currentSrc || image.src;
        lightboxImage.alt = image.alt;
        lightboxCaption.textContent = `${projectName || "Project"} - ${activePhotoIndex + 1} of ${activePhotos.length}`;
    }

    function openLightbox(photo) {
        activePhotos = Array.from(
            photo.closest(".project-gallery")?.querySelectorAll(".project-photo") || []
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
        photo.setAttribute("role", "button");
        photo.setAttribute("tabindex", "0");
        photo.setAttribute("aria-haspopup", "dialog");

        photo.addEventListener("click", () => openLightbox(photo));
        photo.addEventListener("keydown", (event) => {
            if (event.key === "Enter" || event.key === " ") {
                event.preventDefault();
                openLightbox(photo);
            }
        });
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
    });
}
