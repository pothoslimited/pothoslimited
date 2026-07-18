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
