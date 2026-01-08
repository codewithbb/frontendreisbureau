// /assets/js/nav-reis.js
fetch("/partials/nav-reis.html")
    .then(response => {
        if (!response.ok) {
            throw new Error("Kon nav-reis.html niet laden");
        }
        return response.text();
    })
    .then(html => {
        document.getElementById("nav-placeholder").innerHTML = html;
        highlightActiveNavLink();
    })
    .catch(error => {
        console.error(error);
    });

function highlightActiveNavLink() {
    const currentPath = window.location.pathname;
    const links = document.querySelectorAll(".navbar a");

    links.forEach(link => {
        if (link.getAttribute("href") === currentPath) {
            link.classList.add("active");
        }
    });
}